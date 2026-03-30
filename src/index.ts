import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, DiscoverRequest, CallReport } from "./types.js";
import { searchServices } from "./discover.js";
import { validateApiKey, incrementUsage, getRateLimit, getServiceCount, insertCallReport, getServicesPaginated, getSystemStats, createApiKey, getKeyCountByEmail, logRequest, getRequestStats, aggregateDailyStats, getServiceDetail, getServiceHealth, getHealthOverview, cleanupOldHealthChecks } from "./db.js";
import { crawlSmithery, crawlAwesomeMcp, crawlMcpRegistry, enrichGitHubStars, embedAndIndex } from "./crawl.js";
import { runHealthChecks } from "./health.js";
import { runCooccurrenceAggregation, getCooccurrences } from "./cooccurrence.js";
import { enrichServices } from "./enrich.js";
import { runSignalAggregation } from "./signals.js";
import { getAllServices } from "./db.js";
import { DisvrMcpAgent } from "./mcp.js";
import { landingPageHtml } from "./landing.js";
import { registryPageHtml } from "./pages/registry.js";
import { explorerPageHtml } from "./pages/explorer.js";
import { analyticsPageHtml } from "./pages/analytics.js";
import { keysPageHtml } from "./pages/keys.js";
import { FAVICON_32_B64, APPLE_TOUCH_B64, ICON_192_B64 } from "./icons.js";

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use("*", cors());

// Favicon & icons
app.get("/favicon.ico", (c) => {
  const buf = Uint8Array.from(atob(FAVICON_32_B64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" });
});
app.get("/favicon.png", (c) => {
  const buf = Uint8Array.from(atob(FAVICON_32_B64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" });
});
app.get("/apple-touch-icon.png", (c) => {
  const buf = Uint8Array.from(atob(APPLE_TOUCH_B64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" });
});
app.get("/icon-192.png", (c) => {
  const buf = Uint8Array.from(atob(ICON_192_B64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" });
});

// Landing page
app.get("/", (c) => {
  return c.html(landingPageHtml);
});

// Pages
app.get("/registry", (c) => c.html(registryPageHtml));
app.get("/explorer", (c) => c.html(explorerPageHtml));
app.get("/analytics", (c) => c.html(analyticsPageHtml));
app.get("/keys", (c) => c.html(keysPageHtml));

// Health check
app.get("/health", async (c) => {
  const count = await getServiceCount(c.env.DB);
  return c.json({ status: "ok", services_indexed: count });
});

// Auth middleware for /discover
app.use("/discover", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: "unauthorized", message: "Missing or invalid Authorization header. Use: Bearer <api-key>" },
      401
    );
  }

  const token = authHeader.slice(7);
  const keyHash = await hashKey(token);
  const apiKey = await validateApiKey(c.env.DB, keyHash);

  if (!apiKey) {
    return c.json(
      { error: "unauthorized", message: "Invalid API key." },
      401
    );
  }

  const limit = getRateLimit(apiKey.tier);
  if (apiKey.daily_usage >= limit) {
    return c.json(
      {
        error: "rate_limited",
        message: `Daily limit of ${limit} requests exceeded. Resets at midnight UTC.`,
        retry_after_seconds: secondsUntilMidnight(),
      },
      429
    );
  }

  // Increment usage
  await incrementUsage(c.env.DB, keyHash);
  await next();
});

// Main discovery endpoint
app.post("/discover", async (c) => {
  const startTime = Date.now();

  let body: DiscoverRequest;
  try {
    body = await c.req.json<DiscoverRequest>();
  } catch {
    return c.json(
      { error: "invalid_json", message: "Request body must be valid JSON." },
      400
    );
  }

  if (!body.need || typeof body.need !== "string" || body.need.trim().length < 5) {
    return c.json(
      {
        error: "need_too_vague",
        message: "Please provide a more specific description of what you need (min 5 characters).",
      },
      400
    );
  }

  const result = await searchServices(c.env, {
    need: body.need.trim(),
    max_price_per_call: body.max_price_per_call,
    max_latency_ms: body.max_latency_ms,
    min_reputation: body.min_reputation,
    min_success_rate: body.min_success_rate,
    budget_usd: body.budget_usd,
    task_context: body.task_context,
  });

  // Log request (non-blocking)
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.slice(7);
  const keyHash = await hashKey(token);
  c.executionCtx.waitUntil(
    logRequest(c.env.DB, {
      api_key_hash: keyHash,
      endpoint: "/discover",
      need: body.need.trim(),
      response_service_ids: result.recommendations?.map((r) => r.service_id) ?? [],
      query_id: result.query_id,
      status_code: 200,
      latency_ms: Date.now() - startTime,
    })
  );

  return c.json(result);
});

// ─── Feedback Loop: Call Report ───
// Agents report back how a tool performed → feeds into quality scores → improves next recommendation
// This is the real moat: closed-loop machine signal, not human reviews

app.post("/report", async (c) => {
  // Auth check
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized", message: "Missing API key." }, 401);
  }
  const token = authHeader.slice(7);
  const keyHash = await hashKey(token);
  const apiKey = await validateApiKey(c.env.DB, keyHash);
  if (!apiKey) {
    return c.json({ error: "unauthorized", message: "Invalid API key." }, 401);
  }

  let body: CallReport;
  try {
    body = await c.req.json<CallReport>();
  } catch {
    return c.json({ error: "invalid_json", message: "Request body must be valid JSON." }, 400);
  }

  if (!body.service_id || !body.query_id) {
    return c.json({ error: "missing_fields", message: "service_id and query_id are required." }, 400);
  }

  const reportStartTime = Date.now();
  await insertCallReport(c.env.DB, body, keyHash);

  // Log report request (non-blocking)
  c.executionCtx.waitUntil(
    logRequest(c.env.DB, {
      api_key_hash: keyHash,
      endpoint: "/report",
      query_id: body.query_id,
      status_code: 200,
      latency_ms: Date.now() - reportStartTime,
    })
  );

  return c.json({ status: "ok", message: "Call report recorded. Thank you for improving recommendations." });
});

// ─── Public API: Service Listing & Stats ───

app.get("/api/services", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "20") || 1));
  const search = c.req.query("search") || undefined;
  const platform = c.req.query("platform") || undefined;
  const sort = c.req.query("sort") || undefined;
  const result = await getServicesPaginated(c.env.DB, { page, limit, search, platform, sort });
  return c.json(result);
});

app.get("/api/services/:id", async (c) => {
  const service = await getServiceDetail(c.env.DB, c.req.param("id"));
  if (!service) {
    return c.json({ error: "not_found", message: "Service not found" }, 404);
  }
  return c.json({
    service: {
      id: service.id,
      name: service.name,
      description: service.description,
      type: service.service_type ?? "mcp_server",
      install: service.install ?? null,
      required_env: service.required_env ?? [],
      tools_provided: service.tools_provided ?? [],
      metrics: {
        reputation_score: service.reputation_score,
        success_rate: service.success_rate,
        uptime_30d: service.uptime_30d,
        latency_p95_ms: service.latency_p95_ms,
        total_calls: service.total_calls,
        retry_rate: service.retry_rate,
      },
      platform: service.platform,
      source_url: service.source_url,
    },
  });
});

app.get("/api/stats", async (c) => {
  const stats = await getSystemStats(c.env.DB);
  return c.json(stats);
});

app.get("/api/analytics", async (c) => {
  const days = Math.min(90, Math.max(1, parseInt(c.req.query("days") || "7") || 7));
  const stats = await getRequestStats(c.env.DB, days);
  return c.json(stats);
});

// ─── API Key Registration ───

app.post("/api/register", async (c) => {
  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json", message: "Request body must be valid JSON." }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "invalid_email", message: "Please provide a valid email address." }, 400);
  }

  // Limit: max 3 keys per email
  const existingCount = await getKeyCountByEmail(c.env.DB, email);
  if (existingCount >= 3) {
    return c.json(
      { error: "limit_reached", message: "Maximum 3 API keys per email. Contact us for more." },
      429
    );
  }

  // Generate key: dsvr_ prefix + 32 random hex chars
  const rawBytes = new Uint8Array(16);
  crypto.getRandomValues(rawBytes);
  const apiKey = "dsvr_" + Array.from(rawBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const keyHash = await hashKey(apiKey);
  await createApiKey(c.env.DB, email, keyHash);

  return c.json({
    status: "ok",
    api_key: apiKey,
    tier: "free",
    daily_limit: 1000,
    message: "Save this key — it will not be shown again.",
  });
});

// ─── Health API: Public Endpoints ───

app.get("/api/health/summary", async (c) => {
  const overview = await getHealthOverview(c.env.DB);
  return c.json({ success: true, data: overview });
});

app.get("/api/health/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");
  const health = await getServiceHealth(c.env.DB, serviceId);
  if (!health.summary) {
    return c.json({ error: "not_found", message: "No health data for this service" }, 404);
  }
  return c.json({ success: true, data: health });
});

// ─── Co-occurrence API ───

app.get("/api/cooccurrence/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");
  const results = await getCooccurrences(c.env.DB, serviceId);
  return c.json({ success: true, data: results });
});

// Admin auth middleware — requires ADMIN_KEY env var
app.use("/admin/*", async (c, next) => {
  const adminKey = (c.env as any).ADMIN_KEY;
  if (adminKey) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== adminKey) {
      return c.json({ error: "unauthorized", message: "Admin access requires valid ADMIN_KEY." }, 401);
    }
  }
  await next();
});

// Admin: trigger crawl manually
app.post("/admin/crawl", async (c) => {
  const source = c.req.query("source") || "all";
  if (source === "smithery") {
    const count = await crawlSmithery(c.env);
    return c.json({ status: "ok", source: "smithery", services_crawled: count });
  }
  if (source === "github") {
    const count = await crawlAwesomeMcp(c.env);
    return c.json({ status: "ok", source: "github", services_crawled: count });
  }
  if (source === "mcp_registry") {
    const count = await crawlMcpRegistry(c.env);
    return c.json({ status: "ok", source: "mcp_registry", services_crawled: count });
  }
  const [smitheryCount, githubCount, mcpRegCount] = await Promise.all([
    crawlSmithery(c.env),
    crawlAwesomeMcp(c.env),
    crawlMcpRegistry(c.env),
  ]);
  return c.json({ status: "ok", source: "all", smithery: smitheryCount, github: githubCount, mcp_registry: mcpRegCount, total: smitheryCount + githubCount + mcpRegCount });
});

// Admin: reindex existing services into Vectorize
app.post("/admin/reindex", async (c) => {
  const services = await getAllServices(c.env.DB);
  if (services.length === 0) {
    return c.json({ status: "ok", message: "No services to index." });
  }
  await embedAndIndex(c.env, services);
  return c.json({ status: "ok", services_indexed: services.length });
});

// Admin: rebuild FTS5 index
app.post("/admin/rebuild-fts", async (c) => {
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM services_fts"),
    c.env.DB.prepare(
      "INSERT INTO services_fts(rowid, id, name, description, capabilities) SELECT rowid, id, name, description, capabilities FROM services"
    ),
  ]);
  const count = await c.env.DB.prepare("SELECT count(*) as c FROM services_fts").first<{ c: number }>();
  return c.json({ status: "ok", fts_entries: count?.c ?? 0 });
});

// Admin: enrich GitHub services with star counts
app.post("/admin/enrich", async (c) => {
  const count = await enrichGitHubStars(c.env);
  return c.json({ status: "ok", services_enriched: count });
});

// Admin: enrich services with README-extracted metadata (install, env vars, tools)
app.post("/admin/enrich-readme", async (c) => {
  let body: { limit?: number; force?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    // use defaults
  }
  const limit = Math.min(Number(body.limit) || 20, 50);
  const forceRefresh = body.force === true;

  const result = await enrichServices(c.env.DB, c.env.OPENAI_API_KEY, {
    limit,
    forceRefresh,
  });

  return c.json(result);
});

// Admin: run health checks
app.post("/admin/health-check", async (c) => {
  const githubToken = (c.env as any).GITHUB_TOKEN;
  const [healthResult, cleanedCount] = await Promise.all([
    runHealthChecks(c.env.DB, 50, githubToken),
    cleanupOldHealthChecks(c.env.DB),
  ]);
  return c.json({
    status: "ok",
    ...healthResult,
    old_records_cleaned: cleanedCount,
  });
});

// Admin: trigger co-occurrence aggregation
app.post("/admin/cooccurrence", async (c) => {
  const result = await runCooccurrenceAggregation(c.env.DB);
  return c.json({ success: true, data: result });
});

// MCP Server endpoint (Streamable HTTP via Durable Objects)
const mcpHandler = DisvrMcpAgent.serve("/mcp", { binding: "MCP_AGENT" });

app.all("/mcp", (c) => {
  return mcpHandler.fetch(c.req.raw, c.env, c.executionCtx);
});

app.all("/mcp/*", (c) => {
  return mcpHandler.fetch(c.req.raw, c.env, c.executionCtx);
});

// Cron handler
const worker = {
  fetch: app.fetch,

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        // Phase 1: crawl all sources in parallel
        await Promise.all([
          crawlSmithery(env).catch((err) => console.error("Smithery crawl failed:", err)),
          crawlAwesomeMcp(env).catch((err) => console.error("GitHub crawl failed:", err)),
          crawlMcpRegistry(env).catch((err) => console.error("MCP Registry crawl failed:", err)),
        ]);
        // Phase 2: enrich with GitHub stars
        await enrichGitHubStars(env).catch((err) => console.error("GitHub stars enrichment failed:", err));
        // Phase 3: run health checks + cleanup
        const githubToken = (env as any).GITHUB_TOKEN;
        await runHealthChecks(env.DB, 50, githubToken).catch((err) => console.error("Health checks failed:", err));
        await cleanupOldHealthChecks(env.DB).catch((err) => console.error("Health check cleanup failed:", err));
        // Phase 4: aggregate daily stats + passive signals (idempotent — safe to run every hour)
        await runSignalAggregation(env.DB).catch((err) => console.error("Signal aggregation failed:", err));
        // Phase 5: co-occurrence aggregation
        await runCooccurrenceAggregation(env.DB).catch((err) => console.error("Co-occurrence aggregation failed:", err));
        // Phase 5: auto-enrich README metadata at UTC 1:00 (30 services/day)
        const hour = new Date().getUTCHours();
        if (hour === 1) {
          await enrichServices(env.DB, env.OPENAI_API_KEY, { limit: 30 })
            .then((r) => console.log(`Enrich result: ${r.enriched} enriched, ${r.skipped} skipped`))
            .catch((err) => console.error("README enrichment failed:", err));
        }
      })()
    );
  },
};

export { DisvrMcpAgent };
export default worker;

// Helpers

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function secondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}
