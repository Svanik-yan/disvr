# Disvr — Project Guide

Agent 智能服务发现引擎，帮 AI Agent 找到最值得用的工具。

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono (TypeScript)
- **Database**: Cloudflare D1 (SQLite) + FTS5 全文搜索
- **Vector Search**: Cloudflare Vectorize (1536 dim, cosine)
- **Embedding**: OpenAI text-embedding-3-small
- **MCP Server**: CF Agents SDK (`McpAgent` class)
- **Testing**: Vitest v4.1.1

## Key Commands

```bash
# Development
npx wrangler dev                    # Local dev server
npx vitest run                      # Run all tests (90 tests)
npx wrangler deploy                 # Deploy to production

# Database
npx wrangler d1 execute disvr-db --remote --command "SQL"
npx wrangler d1 execute disvr-db --file=./schema.sql  # Local reset

# Requires Node 22+
source ~/.nvm/nvm.sh && nvm use 22
```

## Architecture

```
Request → Hono Router → Auth Middleware → Handler → D1/Vectorize → Response

Discovery Flow:
  need (string)
    → embedQuery (OpenAI) → vectorize.query (top 50)
    → getServicesByIds (D1) → applyConstraints → rankServices
    → top 3 recommendations with value scores

Ranking Weights:
  semantic: 0.30 | quality: 0.25 | cost_efficiency: 0.25 | reliability: 0.20
```

## File Structure

```
src/
├── index.ts          # Hono app, routes, auth middleware
├── discover.ts       # Core search + ranking engine
├── db.ts             # D1 CRUD, stats, API key management
├── crawl.ts          # Multi-source crawlers (Smithery, GitHub, MCP Registry) + embedding
├── health.ts         # Automated health checks (GitHub, npm, PyPI, endpoint)
├── cooccurrence.ts   # Tool co-occurrence knowledge graph
├── alternatives.ts   # Deprecation detection & alternative recommendations
├── install-check.ts  # Install score: npm/pypi installability, env docs, difficulty rating
├── probe.ts          # Live probes: MCP handshake, HTTP API health check
├── benchmark.ts      # Benchmark engine: scoring, ranking, leaderboards
├── benchmark-scenarios.ts # 10 predefined benchmark scenario definitions
├── cost.ts           # Cost intelligence: pricing extraction, scoring, batch processing
├── error-taxonomy.ts # Error classification: status codes + text patterns → 10 error types
├── changelog.ts      # Version tracking: semver analysis, npm/pypi checks, breaking change detection
├── mcp.ts            # MCP Server (discover_services tool)
├── types.ts          # All TypeScript types + rowToService
├── landing.ts        # Landing page HTML
└── pages/
    ├── registry.ts   # Searchable service directory
    ├── explorer.ts   # Interactive API playground
    ├── analytics.ts  # Real-time dashboard
    ├── benchmark.ts  # Benchmark leaderboard page
    └── keys.ts       # API key registration
test/
├── types.test.ts     # 8 tests
├── discover.test.ts  # 12 tests
├── db.test.ts        # 17 tests
├── api.test.ts       # 24 tests
├── crawl.test.ts     # 7 tests
├── health.test.ts    # 28 tests
├── cooccurrence.test.ts # co-occurrence tests
├── alternatives.test.ts # deprecation & alternatives tests
├── install-check.test.ts # install score tests
├── probe.test.ts     # live probe tests
├── benchmark.test.ts # benchmark scoring & scenarios tests
├── cost.test.ts      # cost intelligence tests
├── error-taxonomy.test.ts # error classification tests (51 tests)
└── changelog.test.ts # version tracking & breaking change tests (33 tests)
```

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | No | Landing page |
| GET | /registry | No | Service directory |
| GET | /explorer | No | API playground |
| GET | /analytics | No | Dashboard |
| GET | /keys | No | API key registration page |
| GET | /health | No | Health check |
| POST | /discover | Bearer | Main discovery endpoint |
| POST | /report | Bearer | Call report feedback |
| GET | /api/services | No | Paginated service listing |
| GET | /api/stats | No | System statistics |
| GET | /api/analytics | No | Request analytics (daily calls, top queries) |
| POST | /api/register | No | Generate API key |
| GET | /api/health/summary | No | Global health overview |
| GET | /api/health/:serviceId | No | Single service health details |
| GET | /api/alternatives/:serviceId | No | Healthy alternatives for degraded/dead tools |
| GET | /api/deprecations | No | Deprecation overview |
| GET | /api/install/:serviceId | No | Install score & difficulty details |
| GET | /api/probe/:serviceId | No | Live probe details & recent probes |
| GET | /api/cooccurrence/:serviceId | No | Tool co-occurrence data |
| GET | /api/cost/summary | No | Pricing model distribution |
| GET | /api/cost/:serviceId | No | Service pricing details |
| GET | /benchmark | No | Benchmark leaderboard page |
| GET | /api/benchmark | No | Benchmark overview (all scenarios) |
| GET | /api/benchmark/scenarios | No | List scenario definitions |
| GET | /api/benchmark/:scenarioId | No | Scenario leaderboard |
| POST | /admin/crawl | Admin | Trigger manual crawl (smithery/github/mcp_registry/all) |
| POST | /admin/reindex | Admin | Reindex into Vectorize |
| POST | /admin/rebuild-fts | Admin | Rebuild FTS5 index |
| POST | /admin/enrich | Admin | Enrich GitHub stars |
| POST | /admin/health-check | Admin | Run health checks |
| POST | /admin/probe | Admin | Trigger live probes |
| POST | /admin/cooccurrence | Admin | Trigger co-occurrence aggregation |
| GET | /api/errors/summary | No | Error classification summary (30d) |
| GET | /api/errors/:serviceId | No | Service error profile & recent errors |
| GET | /api/versions/:serviceId | No | Service version history |
| GET | /api/breaking-changes | No | Recent breaking changes (default 7 days) |
| POST | /admin/version-check | Admin | Trigger version checks |
| POST | /admin/extract-cost | Admin | Extract cost intelligence from services |
| POST | /admin/benchmark | Admin | Run benchmark across all scenarios |
| POST | /admin/classify-errors | Admin | Run error classification pipeline |
| ALL | /mcp | No | MCP Server (Streamable HTTP) |

## Deployment

- **Production**: https://api.disvr.top (custom domain)
- **Worker URL**: https://disvr.yanchen330.workers.dev
- **Cron**: Hourly crawl (0 * * * *)
- **D1 Database**: disvr-db
- **Vectorize Index**: disvr-mcp-index

## Branches

- `main` — 全免费版本（1,000 请求/天）
- `feature/pricing` — 收费分层（Free 50 / Pro 5,000 / Scale unlimited）

## Testing

```bash
npx vitest run          # 426 tests, ~346ms
```

Mock D1 for database tests. No `@cloudflare/vitest-pool-workers` — pure unit tests with mocked DB.

## Common Patterns

- Pages are exported as HTML string constants (server-side rendered)
- Client-side JS fetches `/api/*` endpoints for dynamic data
- API keys: `dsvr_` prefix + 32 hex chars, stored as SHA-256 hash
- Max 3 keys per email address
