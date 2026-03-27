import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, DiscoverRequest, CallReport } from "./types.js";
import { searchServices } from "./discover.js";
import { validateApiKey, incrementUsage, getRateLimit, getServiceCount, insertCallReport, getServicesPaginated, getSystemStats, createApiKey, getKeyCountByEmail } from "./db.js";
import { crawlSmithery, embedAndIndex } from "./crawl.js";
import { getAllServices } from "./db.js";
import { DisvrMcpAgent } from "./mcp.js";
import { landingPageHtml } from "./landing.js";
import { registryPageHtml } from "./pages/registry.js";
import { explorerPageHtml } from "./pages/explorer.js";
import { analyticsPageHtml } from "./pages/analytics.js";
import { keysPageHtml } from "./pages/keys.js";

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use("*", cors());

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
        message: `Daily limit of ${limit} requests exceeded. Upgrade your plan for higher limits.`,
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

  await insertCallReport(c.env.DB, body, keyHash);
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

app.get("/api/stats", async (c) => {
  const stats = await getSystemStats(c.env.DB);
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
    daily_limit: 50,
    message: "Save this key — it will not be shown again.",
  });
});

// Admin: trigger crawl manually
app.post("/admin/crawl", async (c) => {
  const count = await crawlSmithery(c.env);
  return c.json({ status: "ok", services_crawled: count });
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
      crawlSmithery(env).catch((error) => {
        console.error("Scheduled crawl failed:", error);
      })
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
