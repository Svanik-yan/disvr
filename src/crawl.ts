import type { Env, Service } from "./types.js";
import { upsertService } from "./db.js";

const SMITHERY_API = "https://registry.smithery.ai/servers";
const CRAWL_PAGE_SIZE = 100;
const MAX_PAGES = 5; // MVP: crawl up to 500 services per run
const EMBED_BATCH_SIZE = 50;

interface SmitheryServer {
  qualifiedName: string;
  displayName: string;
  description: string;
  homepage?: string;
  useCount?: number;
  isDeployed?: boolean;
  createdAt?: string;
  tools?: Array<{ name: string; description?: string }>;
}

interface SmitheryResponse {
  servers: SmitheryServer[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
}

export async function crawlSmithery(env: Env): Promise<number> {
  let totalUpserted = 0;
  const allServices: Service[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = `${SMITHERY_API}?q=is:deployed&page=${page}&pageSize=${CRAWL_PAGE_SIZE}`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        console.error(
          `Smithery API error: ${response.status} ${response.statusText}`
        );
        break;
      }

      const data = (await response.json()) as SmitheryResponse;

      if (!data.servers || data.servers.length === 0) break;

      const services = data.servers.map(smitheryToService);

      for (const service of services) {
        try {
          await upsertService(env.DB, service);
          totalUpserted++;
        } catch (error) {
          console.error(`Failed to upsert service ${service.id}:`, error);
        }
      }

      allServices.push(...services);

      if (page >= data.pagination.totalPages) break;
    } catch (error) {
      console.error(`Crawl page ${page} failed:`, error);
      break;
    }
  }

  // Batch embed and index all crawled services
  if (allServices.length > 0) {
    try {
      await embedAndIndex(env, allServices);
    } catch (error) {
      console.error("Embedding/indexing failed:", error);
    }
  }

  console.log(`Crawl complete: ${totalUpserted} services upserted`);
  return totalUpserted;
}

function smitheryToService(server: SmitheryServer): Service {
  const capabilities = extractCapabilities(server);

  return {
    id: `smithery-${server.qualifiedName}`,
    name: server.displayName || server.qualifiedName,
    description: server.description || "",
    capabilities,
    platform: "smithery",
    protocols: {
      mcp: `mcp://smithery/${server.qualifiedName}`,
    },
    pricing: { model: "free", price_usd: 0 },
    reputation_score: calculateReputation(server),
    success_rate: null,
    uptime_30d: null,
    latency_p95_ms: null,
    total_calls: server.useCount ?? 0,
    successful_calls: 0,
    failed_calls: 0,
    retry_rate: null,
    avg_cost_per_success: null,
    doc_completeness: calculateDocCompleteness(server),
    verified: server.isDeployed === true,
    source_url: server.homepage ?? null,
  };
}

function extractCapabilities(server: SmitheryServer): string[] {
  const caps: string[] = [];

  // Extract from tools
  if (server.tools) {
    for (const tool of server.tools) {
      caps.push(tool.name);
    }
  }

  // Extract keywords from description
  const desc = (server.description || "").toLowerCase();
  const keywords = [
    "translation", "search", "database", "email", "file",
    "api", "web", "scraping", "browser", "code", "git",
    "slack", "discord", "notion", "github", "image",
    "audio", "video", "pdf", "calendar", "weather",
    "analytics", "monitoring", "security", "ai", "llm",
  ];
  for (const kw of keywords) {
    if (desc.includes(kw)) caps.push(kw);
  }

  return [...new Set(caps)];
}

function calculateReputation(server: SmitheryServer): number {
  const useCount = server.useCount ?? 0;

  // Simple reputation based on usage (0-5 scale)
  if (useCount > 10000) return 4.5;
  if (useCount > 1000) return 4.0;
  if (useCount > 100) return 3.5;
  if (useCount > 10) return 3.0;
  return 2.5;
}

function calculateDocCompleteness(server: SmitheryServer): number {
  let score = 0;
  if (server.displayName) score += 0.2;
  if (server.description && server.description.length > 20) score += 0.3;
  if (server.homepage) score += 0.2;
  if (server.tools && server.tools.length > 0) score += 0.3;
  return score;
}

export async function embedAndIndex(
  env: Env,
  services: Service[]
): Promise<void> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Process in batches
  for (let i = 0; i < services.length; i += EMBED_BATCH_SIZE) {
    const batch = services.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map(
      (s) => `${s.name}: ${s.description}. Capabilities: ${s.capabilities.join(", ")}`
    );

    try {
      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
        dimensions: 1536,
      });

      const vectors = batch.map((s, idx) => ({
        id: s.id,
        values: response.data[idx].embedding,
      }));

      await env.VECTORIZE.upsert(vectors);
    } catch (error) {
      console.error(`Embedding batch ${i} failed:`, error);
    }
  }
}
