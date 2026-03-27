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
npx vitest run                      # Run all tests (65 tests)
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
├── crawl.ts          # Smithery crawler + embedding pipeline
├── mcp.ts            # MCP Server (discover_services tool)
├── types.ts          # All TypeScript types + rowToService
├── landing.ts        # Landing page HTML
└── pages/
    ├── registry.ts   # Searchable service directory
    ├── explorer.ts   # Interactive API playground
    ├── analytics.ts  # Real-time dashboard
    └── keys.ts       # API key registration
test/
├── types.test.ts     # 8 tests
├── discover.test.ts  # 12 tests
├── db.test.ts        # 14 tests
├── api.test.ts       # 24 tests
└── crawl.test.ts     # 7 tests
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
| POST | /api/register | No | Generate API key |
| POST | /admin/crawl | No | Trigger manual crawl |
| POST | /admin/reindex | No | Reindex into Vectorize |
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
npx vitest run          # 65 tests, ~170ms
```

Mock D1 for database tests. No `@cloudflare/vitest-pool-workers` — pure unit tests with mocked DB.

## Common Patterns

- Pages are exported as HTML string constants (server-side rendered)
- Client-side JS fetches `/api/*` endpoints for dynamic data
- API keys: `dsvr_` prefix + 32 hex chars, stored as SHA-256 hash
- Max 3 keys per email address
