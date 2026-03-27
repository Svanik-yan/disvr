<h1 align="center">🔍 Disvr</h1>

<p align="center">
  <strong>Spend Intelligence for AI Agents — the "Yelp for the Agent Economy"</strong>
</p>

<p align="center">
  <a href="https://www.disvr.top"><img src="https://img.shields.io/badge/Live-www.disvr.top-00d4aa?style=for-the-badge" alt="Live Site"></a>
  <a href="https://api.disvr.top/health"><img src="https://img.shields.io/badge/API-Online-62fae3?style=for-the-badge" alt="API Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

<p align="center">
  <a href="#why-disvr">Why Disvr</a> · <a href="#quick-start">Quick Start</a> · <a href="#api-reference">API</a> · <a href="#architecture">Architecture</a> · <a href="https://www.disvr.top/explorer">Live Demo</a> · <a href="docs/README_zh.md">中文文档</a>
</p>

---

## Why Disvr?

The AI Agent ecosystem is exploding. Payment protocols (Stripe MPP, OpenAI ACP, x402) solve **how to pay**. Directories (Smithery, Composio) solve **what exists**.

But nobody solves the most critical question: **which tool is actually worth using?**

> 🤖 "Translate a Chinese legal contract to Thai" → 50 translation services on Smithery. **Which one has the best cost/quality ratio?**
>
> 🤖 "Scrape product prices from e-commerce sites" → 30 scraping tools. **Which one has the highest success rate and lowest latency?**
>
> 🤖 "Generate a product image" → 20 image generation services. **Which one is cheapest while still being good enough?**

Right now, agents pick blindly. Wrong picks mean wasted money, wasted time, and failed tasks.

**Disvr fixes this.**

Instead of returning a list, Disvr returns a **ranked recommendation** — based on a 4-dimensional value score:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| 🎯 Semantic Match | 0.30 | How well the service matches the need |
| ⭐ Quality | 0.25 | Historical success rate, reputation |
| 💰 Cost Efficiency | 0.25 | Cost per call, value for money |
| 🔒 Reliability | 0.20 | Latency, retry rate, uptime |

**Your agent stops guessing and starts choosing the best tool for the job.**

---

## ✅ Before You Start

| | |
|---|---|
| 💰 **Free to use** | Free tier: 1,000 queries/day, no credit card required |
| 🔌 **MCP Native** | One-line config for Claude Code, Cursor, or any MCP client |
| 🔄 **Closed-Loop Feedback** | Agents report call results → rankings get smarter over time |
| ☁️ **Global Edge** | Deployed on Cloudflare Workers, low latency worldwide |
| 📡 **Real-time Data** | Hourly crawls from Smithery keep service data fresh |

---

## Quick Start

### Option 1: MCP Server (Recommended)

Add one line to your `.mcp.json`:

```json
{
  "mcpServers": {
    "disvr": {
      "type": "url",
      "url": "https://api.disvr.top/mcp"
    }
  }
}
```

Restart Claude Code / Cursor — your agent now has the `discover_services` tool.

Try telling your agent:

- **"Find the best tool to translate Chinese legal documents to Thai"**
- **"Recommend the cheapest web scraping service with high success rate"**
- **"Which image generation API has the best price/quality ratio?"**

### Option 2: REST API

```bash
curl -X POST https://api.disvr.top/discover \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"need": "translate Chinese legal contract to Thai"}'
```

Returns Top 3 recommendations ranked by value_score:

```json
{
  "recommendations": [
    {
      "service": "deepl-mcp-server",
      "platform": "smithery",
      "match_confidence": 0.92,
      "reputation": 4.2,
      "price_usd": 0.002,
      "reason": "Best cost/quality ratio for legal document translation"
    }
  ]
}
```

---

## Live Demo

| Page | Link | Description |
|------|------|-------------|
| 🏠 **Home** | [www.disvr.top](https://www.disvr.top) | Product overview |
| 🔍 **Explorer** | [www.disvr.top/explorer](https://www.disvr.top/explorer) | Interactive query playground — try the API live |
| 📋 **Registry** | [www.disvr.top/registry](https://www.disvr.top/registry) | Browse all indexed services |
| 📊 **Analytics** | [www.disvr.top/analytics](https://www.disvr.top/analytics) | System architecture & scoring visualization |

---

## API Reference

### `POST /discover` — Service Discovery

Describe what your agent needs, get back Top 3 ranked recommendations.

```
POST https://api.disvr.top/discover
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "need": "scrape product prices from e-commerce websites",
  "max_price_per_call": 0.01,
  "max_latency_ms": 5000,
  "min_reputation": 3.0
}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `need` | ✅ | What you need (≥5 chars) |
| `max_price_per_call` | ❌ | Max price per call (USD) |
| `max_latency_ms` | ❌ | Max acceptable latency (ms) |
| `min_reputation` | ❌ | Min reputation score (0-5) |

### `POST /report` — Feedback Loop

Report call results after using a tool — closes the feedback loop and improves rankings.

```
POST https://api.disvr.top/report
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "service_id": "deepl-mcp-server",
  "query_id": "q_abc123",
  "success": true,
  "latency_ms": 1200,
  "cost_usd": 0.002
}
```

### `GET /health` — Health Check

```bash
curl https://api.disvr.top/health
# {"status": "ok", "services_indexed": 330}
```

### MCP Tools

Tools exposed via the MCP Server:

| Tool | Description |
|------|-------------|
| `discover_services` | Semantic search + 4-dim value ranking |
| `list_service_count` | Total number of indexed services |
| `report_call_result` | Report call results (feedback loop) |

---

## SDK

TypeScript/JavaScript SDK with full type safety:

```bash
npm install @sylar_yan/disvr
```

```typescript
import { Disvr } from "@sylar_yan/disvr";

const client = new Disvr("dsvr_your_api_key");

const result = await client.discover({
  need: "translate Chinese legal contract to Thai",
  max_latency_ms: 3000,
  min_reputation: 3.5,
});

console.log(result.recommendations);
```

- [npm](https://www.npmjs.com/package/@sylar_yan/disvr)
- [GitHub](https://github.com/Svanik-yan/disvr)

---

## Architecture

```
Agent Query ("I need X")
       │
       ▼
┌─────────────────────────────────────────┐
│  Disvr API (Cloudflare Workers + Hono)  │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐    ┌──────────────────┐   │
│  │ Embed    │───▶│ CF Vectorize     │   │
│  │ (OpenAI) │    │ (1536-dim cosine)│   │
│  └──────────┘    └────────┬─────────┘   │
│                           │             │
│         ┌─────── 50 candidates ──────┐  │
│         ▼                            │  │
│  ┌──────────────┐   ┌────────────┐   │  │
│  │ D1 Database  │   │ FTS5       │   │  │
│  │ (services,   │   │ (fallback) │   │  │
│  │  call_reports)│   └────────────┘   │  │
│  └──────┬───────┘                    │  │
│         │                            │  │
│         ▼                            │  │
│  ┌──────────────────────────────┐    │  │
│  │ 4-Dim Value Ranking          │    │  │
│  │ semantic × 0.30              │    │  │
│  │ quality  × 0.25              │    │  │
│  │ cost_eff × 0.25              │    │  │
│  │ reliable × 0.20              │    │  │
│  └──────────┬───────────────────┘    │  │
│             ▼                        │  │
│        Top 3 Recommendations         │  │
│                                      │  │
├──────────────────────────────────────┤  │
│  MCP Server (Streamable HTTP)        │  │
│  via CF Agents SDK + Durable Objects │  │
└──────────────────────────────────────┘  │
                                          │
       ┌──────────────────────────────────┘
       ▼
  ┌─────────────┐
  │ Cron Trigger │  ← Hourly crawl from Smithery
  │ (hourly)     │     embedAndIndex → Vectorize
  └─────────────┘
       │
  ┌────▼────────────┐
  │ POST /report    │  ← Agent feedback
  │ refreshStats()  │     success_rate, latency → ranking improvement
  └─────────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Database | Cloudflare D1 (SQLite) |
| Vector Search | CF Vectorize (1536-dim, cosine) |
| Text Search | FTS5 (OR + prefix, fallback path) |
| Embedding | OpenAI text-embedding-3-small |
| MCP Server | CF Agents SDK (McpAgent + Durable Objects) |
| Data Source | Smithery Registry (16,000+ servers) |
| Cron | CF Cron Trigger (hourly) |
| Language | TypeScript |

---

## Project Structure

```
disvr/
├── wrangler.toml           # CF Workers config
├── schema.sql              # D1 database schema
├── src/
│   ├── index.ts            # Hono entry + REST routes
│   ├── discover.ts         # Core: semantic search + 4-dim ranking
│   ├── db.ts               # D1 CRUD + feedback stats
│   ├── crawl.ts            # Smithery crawler + embedAndIndex
│   ├── mcp.ts              # MCP Server (Streamable HTTP)
│   ├── types.ts            # TypeScript type definitions
│   ├── landing.ts          # Landing page HTML
│   └── pages/
│       ├── registry.ts     # Provider Registry page
│       ├── explorer.ts     # Agent Query Explorer page
│       └── analytics.ts    # Analytics Dashboard page
├── test/
│   ├── types.test.ts       # Type conversion tests
│   └── discover.test.ts    # Matching engine tests
└── .mcp.json               # MCP config example
```

---

## Local Development

```bash
# Prerequisites: Node.js 22+
nvm use 22

# Install dependencies
npm install

# Local dev server
npx wrangler dev

# Run tests
npx vitest run

# Deploy
npx wrangler deploy
```

### Environment Variables

```bash
# Set OpenAI API Key (for embeddings)
wrangler secret put OPENAI_API_KEY
```

### Database Setup

```bash
# Create D1 database
wrangler d1 create disvr-db

# Run schema
wrangler d1 execute disvr-db --file=./schema.sql

# Create Vectorize index
wrangler vectorize create disvr-mcp-index --dimensions=1536 --metric=cosine
```

---

## Design Philosophy

### Spend Intelligence, Not Just Search

Disvr is not a directory. It's not a marketplace. It's a **decision layer**.

Traditional directories return a list and let you pick. Disvr returns a **recommendation** and tells you:
- **Why** this tool is worth using
- **How** its cost/quality ratio compares
- **What** makes it better than alternatives

### Closed-Loop Feedback is the Moat

Every time an agent reports a call result (success/failure, latency, cost), it feeds back into the ranking algorithm. More usage → smarter recommendations. This isn't a static database — it's a **living intelligence system**.

### Dual-Path Search Guarantees Recall

- **Primary**: OpenAI embedding → CF Vectorize vector search (semantic matching)
- **Fallback**: FTS5 full-text search (OR + prefix wildcards)
- Automatically degrades when embedding fails or vector search returns empty — always returns results

---

## Roadmap

- [x] Core API (discover + report + health)
- [x] MCP Server (Streamable HTTP)
- [x] Smithery crawler (330+ services indexed)
- [x] Landing page + 4 frontend pages
- [x] Custom domains (www.disvr.top + api.disvr.top)
- [ ] More data sources (MCP Official Registry, GitHub)
- [ ] Agent integration verification
- [ ] Additional tests (db.test.ts, api.test.ts, crawl.test.ts)
- [ ] User registration + API key management UI
- [ ] Cost tracking dashboard

---

## Contributing

PRs and Issues are welcome!

- 🐛 Bug reports → [GitHub Issues](https://github.com/Svanik-yan/disvr/issues)
- 💡 Feature requests → [GitHub Issues](https://github.com/Svanik-yan/disvr/issues)
- 🔧 Code contributions → Fork & PR

---

## Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com/) — Global edge compute
- [Hono](https://hono.dev/) — Lightweight web framework
- [Smithery](https://smithery.ai/) — MCP service registry
- [OpenAI](https://openai.com/) — text-embedding-3-small
- [CF Agents SDK](https://developers.cloudflare.com/agents/) — MCP Server implementation

---

## License

[MIT](LICENSE)

---

<p align="center">
  <strong>Stop guessing. Start discovering.</strong>
  <br/>
  <a href="https://www.disvr.top">www.disvr.top</a> · <a href="https://api.disvr.top/mcp">MCP Server</a> · <a href="https://api.disvr.top/health">API Status</a>
</p>
