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

// ─── MCP Official Registry Crawler ───

const MCP_REGISTRY_API = "https://registry.modelcontextprotocol.io/v0.1/servers";
const MCP_REGISTRY_PAGE_SIZE = 100;
const MCP_REGISTRY_MAX_PAGES = 10; // Up to 1000 servers per run

interface McpRegistryServer {
  server: {
    name: string;
    description?: string;
    version?: string;
    packages?: Array<{
      type: string;
      registry?: string;
      requirements?: string;
    }>;
  };
  _meta: {
    status: string;
    publishedAt?: string;
    updatedAt?: string;
    isLatest?: boolean;
  };
}

interface McpRegistryResponse {
  servers: McpRegistryServer[];
  metadata: {
    nextCursor: string | null;
    count: number;
  };
}

export async function crawlMcpRegistry(env: Env): Promise<number> {
  const allServices: Service[] = [];
  let cursor: string | null = null;
  let pages = 0;

  while (pages < MCP_REGISTRY_MAX_PAGES) {
    try {
      let url = `${MCP_REGISTRY_API}?limit=${MCP_REGISTRY_PAGE_SIZE}&version=latest`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "disvr-crawler/1.0" },
      });

      if (!response.ok) {
        console.error(`MCP Registry API error: ${response.status} ${response.statusText}`);
        break;
      }

      const data = (await response.json()) as McpRegistryResponse;

      if (!data.servers || data.servers.length === 0) break;

      for (const entry of data.servers) {
        if (entry._meta.status === "deleted") continue;
        allServices.push(mcpRegistryToService(entry));
      }

      pages++;
      cursor = data.metadata.nextCursor;
      if (!cursor) break;
    } catch (error) {
      console.error(`MCP Registry crawl page ${pages + 1} failed:`, error);
      break;
    }
  }

  if (allServices.length === 0) return 0;

  // Batch upsert
  const BATCH_SIZE = 50;
  let totalUpserted = 0;

  for (let i = 0; i < allServices.length; i += BATCH_SIZE) {
    const batch = allServices.slice(i, i + BATCH_SIZE);
    try {
      const statements = batch.map((service) =>
        env.DB.prepare(
          `INSERT INTO services (id, name, description, capabilities, platform, protocols, pricing,
            reputation_score, success_rate, uptime_30d, latency_p95_ms, total_calls,
            successful_calls, failed_calls, retry_rate, avg_cost_per_success,
            doc_completeness, verified, source_url, last_health_check, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, description = excluded.description,
            capabilities = excluded.capabilities, protocols = excluded.protocols,
            pricing = excluded.pricing, doc_completeness = excluded.doc_completeness,
            verified = excluded.verified, source_url = excluded.source_url,
            updated_at = datetime('now')`
        ).bind(
          service.id, service.name, service.description,
          JSON.stringify(service.capabilities), service.platform,
          JSON.stringify(service.protocols), JSON.stringify(service.pricing),
          service.reputation_score, service.success_rate, service.uptime_30d,
          service.latency_p95_ms, service.total_calls, service.successful_calls,
          service.failed_calls, service.retry_rate, service.avg_cost_per_success,
          service.doc_completeness, service.verified ? 1 : 0,
          service.source_url, null
        )
      );
      await env.DB.batch(statements);
      totalUpserted += batch.length;
    } catch (error) {
      console.error(`MCP Registry batch upsert failed at offset ${i}:`, error);
    }
  }

  // Embed new services
  if (allServices.length > 0) {
    try {
      await embedAndIndex(env, allServices);
    } catch (error) {
      console.error("MCP Registry embedding failed:", error);
    }
  }

  console.log(`MCP Registry crawl complete: ${totalUpserted} services upserted`);
  return totalUpserted;
}

function mcpRegistryToService(entry: McpRegistryServer): Service {
  const name = entry.server.name;
  const slug = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const desc = entry.server.description || "";
  const caps = extractCapsFromDescription(desc);

  // Determine package type for protocols
  const protocols: Record<string, string> = {};
  if (entry.server.packages) {
    for (const pkg of entry.server.packages) {
      if (pkg.type === "npm") {
        protocols.npm = pkg.registry || name;
      } else if (pkg.type === "python") {
        protocols.python = pkg.registry || name;
      } else if (pkg.type === "docker") {
        protocols.docker = pkg.registry || name;
      }
    }
  }
  protocols.mcp = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(name)}`;

  const hasDescription = desc.length > 20;
  const hasPackages = (entry.server.packages?.length ?? 0) > 0;
  const docCompleteness = (hasDescription ? 0.4 : 0.1) + (hasPackages ? 0.3 : 0) + (entry.server.version ? 0.2 : 0) + 0.1;

  return {
    id: `mcpreg-${slug}`,
    name,
    description: desc,
    capabilities: [...new Set(caps)],
    platform: "mcp_registry",
    protocols,
    pricing: { model: "free", price_usd: 0 },
    reputation_score: 3.5, // Official registry = baseline credibility
    success_rate: null,
    uptime_30d: null,
    latency_p95_ms: null,
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    retry_rate: null,
    avg_cost_per_success: null,
    doc_completeness: Math.min(1, docCompleteness),
    verified: true, // Listed in official registry
    source_url: `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(name)}`,
  };
}

// ─── GitHub Awesome MCP Servers Crawler ───

const AWESOME_REPOS = [
  {
    url: "https://raw.githubusercontent.com/appcypher/awesome-mcp-servers/main/README.md",
    parseEntry: parseAppcypherEntry,
  },
  {
    url: "https://raw.githubusercontent.com/wong2/awesome-mcp-servers/main/README.md",
    parseEntry: parseWong2Entry,
  },
];

interface ParsedEntry {
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
}

/** Parse appcypher format: `- <img ...> [Name](url) - Description` */
function parseAppcypherEntry(
  line: string,
  currentCategory: string
): ParsedEntry | null {
  // Match: - <img...> [Name](url)<sup>...</sup> - Description
  // or:   - <img...> [Name](url) - Description
  const match = line.match(
    /^\- (?:<img[^>]*>\s*)?(?:<sup>.*?<\/sup>\s*)?\[([^\]]+)\]\((https?:\/\/[^)]+)\)(?:<sup>.*?<\/sup>)?\s*[-–—]\s*(.+)/
  );
  if (!match) return null;
  const [, name, url, description] = match;
  return {
    name: name.trim(),
    url: url.trim(),
    description: description.trim(),
    category: currentCategory,
    isOfficial: line.includes("⭐"),
  };
}

/** Parse wong2 format: `- **[Name](url)** - Description` */
function parseWong2Entry(
  line: string,
  currentCategory: string
): ParsedEntry | null {
  const match = line.match(
    /^\- \*\*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\*\*\s*[-–—]\s*(.+)/
  );
  if (!match) return null;
  const [, name, url, description] = match;
  return {
    name: name.trim(),
    url: url.trim(),
    description: description.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim(),
    category: currentCategory,
    isOfficial: currentCategory.toLowerCase().includes("official"),
  };
}

function parseAwesomeReadme(
  markdown: string,
  parseEntry: (line: string, cat: string) => ParsedEntry | null
): ParsedEntry[] {
  const lines = markdown.split("\n");
  const entries: ParsedEntry[] = [];
  let currentCategory = "general";

  for (const line of lines) {
    // Detect category headings: ## 📂 File Systems  or  ## Official Servers
    const headingMatch = line.match(/^#{1,3}\s+(?:[^\w]*\s*)?(.+)/);
    if (headingMatch) {
      const heading = headingMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/[^\w\s&-]/g, "")
        .trim();
      if (heading.length > 0) currentCategory = heading;
      continue;
    }

    const entry = parseEntry(line, currentCategory);
    if (entry) entries.push(entry);
  }

  return entries;
}

function entryToService(entry: ParsedEntry): Service {
  const slug = entry.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const caps = extractCapsFromDescription(entry.description);
  if (entry.category) caps.push(entry.category.toLowerCase());

  return {
    id: `github-${slug}`,
    name: entry.name,
    description: entry.description,
    capabilities: [...new Set(caps)],
    platform: "github",
    protocols: { mcp: entry.url },
    pricing: { model: "free", price_usd: 0 },
    reputation_score: entry.isOfficial ? 4.0 : 3.0,
    success_rate: null,
    uptime_30d: null,
    latency_p95_ms: null,
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    retry_rate: null,
    avg_cost_per_success: null,
    doc_completeness: entry.description.length > 50 ? 0.7 : 0.4,
    verified: entry.isOfficial,
    source_url: entry.url,
  };
}

function extractCapsFromDescription(desc: string): string[] {
  const caps: string[] = [];
  const lower = desc.toLowerCase();
  const keywords = [
    "translation", "search", "database", "email", "file",
    "api", "web", "scraping", "browser", "code", "git",
    "slack", "discord", "notion", "github", "image",
    "audio", "video", "pdf", "calendar", "weather",
    "analytics", "monitoring", "security", "ai", "llm",
    "docker", "kubernetes", "cloud", "storage", "sql",
    "postgres", "mysql", "redis", "mongodb", "supabase",
    "stripe", "payment", "blockchain", "crypto", "finance",
  ];
  for (const kw of keywords) {
    if (lower.includes(kw)) caps.push(kw);
  }
  return caps;
}

export async function crawlAwesomeMcp(env: Env): Promise<number> {
  const seenIds = new Set<string>();
  const allServices: Service[] = [];

  // Phase 1: Fetch and parse all READMEs (fast, no DB calls)
  for (const repo of AWESOME_REPOS) {
    try {
      const response = await fetch(repo.url, {
        headers: { Accept: "text/plain" },
      });

      if (!response.ok) {
        console.error(`GitHub fetch failed: ${response.status} ${repo.url}`);
        continue;
      }

      const markdown = await response.text();
      const entries = parseAwesomeReadme(markdown, repo.parseEntry);

      for (const entry of entries) {
        const service = entryToService(entry);
        if (seenIds.has(service.id)) continue;
        seenIds.add(service.id);
        allServices.push(service);
      }
    } catch (error) {
      console.error(`Crawl awesome repo failed: ${repo.url}`, error);
    }
  }

  if (allServices.length === 0) return 0;

  // Phase 2: Batch upsert using D1 batch API (much faster than individual queries)
  const BATCH_SIZE = 50;
  let totalUpserted = 0;

  for (let i = 0; i < allServices.length; i += BATCH_SIZE) {
    const batch = allServices.slice(i, i + BATCH_SIZE);
    try {
      const statements = batch.map((service) =>
        env.DB.prepare(
          `INSERT INTO services (id, name, description, capabilities, platform, protocols, pricing,
            reputation_score, success_rate, uptime_30d, latency_p95_ms, total_calls,
            successful_calls, failed_calls, retry_rate, avg_cost_per_success,
            doc_completeness, verified, source_url, last_health_check, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, description = excluded.description,
            capabilities = excluded.capabilities, protocols = excluded.protocols,
            pricing = excluded.pricing, reputation_score = excluded.reputation_score,
            doc_completeness = excluded.doc_completeness, verified = excluded.verified,
            source_url = excluded.source_url, updated_at = datetime('now')`
        ).bind(
          service.id, service.name, service.description,
          JSON.stringify(service.capabilities), service.platform,
          JSON.stringify(service.protocols), JSON.stringify(service.pricing),
          service.reputation_score, service.success_rate, service.uptime_30d,
          service.latency_p95_ms, service.total_calls, service.successful_calls,
          service.failed_calls, service.retry_rate, service.avg_cost_per_success,
          service.doc_completeness, service.verified ? 1 : 0,
          service.source_url, null
        )
      );
      await env.DB.batch(statements);
      totalUpserted += batch.length;
    } catch (error) {
      console.error(`Batch upsert failed at offset ${i}:`, error);
    }
  }

  console.log(`GitHub awesome crawl complete: ${totalUpserted} services upserted (run /admin/reindex to embed)`);
  return totalUpserted;
}

// ─── GitHub Stars Enrichment ───

const ENRICH_BATCH_SIZE = 25; // Stay well under 60/hour rate limit

/** Extract GitHub owner/repo from a URL like https://github.com/owner/repo/... */
function extractGitHubRepo(url: string): string | null {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) return null;
  // Clean up trailing fragments
  return match[1].replace(/\.git$/, "");
}

function starsToReputation(stars: number): number {
  if (stars > 10000) return 5.0;
  if (stars > 5000) return 4.8;
  if (stars > 1000) return 4.5;
  if (stars > 500) return 4.2;
  if (stars > 100) return 3.8;
  if (stars > 50) return 3.5;
  if (stars > 10) return 3.2;
  return 3.0;
}

export async function enrichGitHubStars(env: Env): Promise<number> {
  // Get GitHub services that haven't been enriched recently
  const result = await env.DB.prepare(
    `SELECT id, source_url FROM services
     WHERE platform = 'github' AND source_url LIKE '%github.com%'
     AND (last_health_check IS NULL OR last_health_check < datetime('now', '-7 days'))
     LIMIT ?`
  ).bind(ENRICH_BATCH_SIZE).all<{ id: string; source_url: string }>();

  const services = result.results ?? [];
  if (services.length === 0) return 0;

  let enriched = 0;
  const statements: D1PreparedStatement[] = [];

  for (const svc of services) {
    const repo = extractGitHubRepo(svc.source_url);
    if (!repo) {
      // Mark as checked so we skip it next time
      statements.push(
        env.DB.prepare(
          "UPDATE services SET last_health_check = datetime('now') WHERE id = ?"
        ).bind(svc.id)
      );
      continue;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "disvr-crawler/1.0",
        },
      });

      if (res.status === 403 || res.status === 429) {
        // Rate limited — stop processing
        console.log("GitHub API rate limited, stopping enrichment");
        break;
      }

      if (!res.ok) {
        statements.push(
          env.DB.prepare(
            "UPDATE services SET last_health_check = datetime('now') WHERE id = ?"
          ).bind(svc.id)
        );
        continue;
      }

      const data = (await res.json()) as { stargazers_count?: number; description?: string };
      const stars = data.stargazers_count ?? 0;
      const reputation = starsToReputation(stars);

      statements.push(
        env.DB.prepare(
          `UPDATE services SET
            reputation_score = ?, total_calls = ?,
            last_health_check = datetime('now'), updated_at = datetime('now')
          WHERE id = ?`
        ).bind(reputation, stars, svc.id)
      );
      enriched++;
    } catch (error) {
      console.error(`Failed to enrich ${svc.id}:`, error);
    }
  }

  if (statements.length > 0) {
    try {
      await env.DB.batch(statements);
    } catch (error) {
      console.error("Batch update for enrichment failed:", error);
    }
  }

  console.log(`Enrichment complete: ${enriched}/${services.length} services updated with GitHub stars`);
  return enriched;
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

// ─── Health Checks ───

const HEALTH_CHECK_TIMEOUT_MS = 5000;

export async function runHealthChecks(env: Env): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT id, source_url, uptime_30d FROM services
     WHERE source_url IS NOT NULL
       AND (last_health_check IS NULL
            OR last_health_check < datetime('now', '-6 hours'))
     LIMIT 30`
  ).all<{ id: string; source_url: string; uptime_30d: number | null }>();

  if (!rows.results || rows.results.length === 0) return 0;

  let checkedCount = 0;

  for (const row of rows.results) {
    let success = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        HEALTH_CHECK_TIMEOUT_MS
      );

      const response = await fetch(row.source_url, {
        method: "HEAD",
        signal: controller.signal,
        headers: { "User-Agent": "disvr-healthcheck/1.0" },
      });

      clearTimeout(timeoutId);
      success = response.ok;
    } catch {
      success = false;
    }

    // Exponential moving average for uptime
    const previousUptime = row.uptime_30d;
    const newUptime =
      previousUptime !== null
        ? previousUptime * 0.95 + (success ? 1 : 0) * 0.05
        : success
          ? 1.0
          : 0.0;

    try {
      await env.DB.prepare(
        `UPDATE services
         SET uptime_30d = ?1,
             last_health_check = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?2`
      )
        .bind(newUptime, row.id)
        .run();

      checkedCount++;
    } catch (error) {
      console.error(`Failed to update health for ${row.id}:`, error);
    }
  }

  console.log(`Health checks complete: ${checkedCount} services checked`);
  return checkedCount;
}
