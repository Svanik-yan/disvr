import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, DiscoverRequest, CallReport } from "./types.js";
import { searchServices } from "./discover.js";
import { validateApiKey, incrementUsage, getRateLimit, getServiceCount, insertCallReport } from "./db.js";
import { crawlSmithery } from "./crawl.js";
import { DisvrMcpAgent } from "./mcp.js";

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use("*", cors());

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

// Admin: trigger crawl manually
app.post("/admin/crawl", async (c) => {
  const count = await crawlSmithery(c.env);
  return c.json({ status: "ok", services_crawled: count });
});

// MCP Server endpoint
app.all("/mcp", (c) => {
  return DisvrMcpAgent.serve("/mcp").fetch(c.req.raw, c.env, c.executionCtx);
});

app.all("/mcp/*", (c) => {
  return DisvrMcpAgent.serve("/mcp").fetch(c.req.raw, c.env, c.executionCtx);
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
