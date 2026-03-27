# MCP Directory Listing — Disvr

> Copy-paste ready for Smithery, glama.ai, mcp.so, and other MCP directories.

---

## Basic Info

| Field | Value |
|-------|-------|
| **Name** | Disvr |
| **Tagline** | Tool search engine for AI agents |
| **One-liner** | One API call, your agent finds any tool it needs. 900+ MCP servers indexed. |
| **Category** | Developer Tools / Agent Infrastructure / Service Discovery |
| **URL** | https://www.disvr.top |
| **MCP Endpoint** | https://api.disvr.top/mcp |
| **Protocol** | Streamable HTTP (MCP) |
| **GitHub** | https://github.com/Svanik-yan/disvr |
| **License** | MIT |
| **Author** | Reyn (yanchen330@gmail.com) |

## Description (Short — 280 chars)

Disvr is a tool search engine for AI agents. Your agent calls `discover_services` and gets ranked recommendations from 900+ indexed MCP servers. 4-dimensional ranking: semantic match, quality, cost efficiency, reliability. Free API with 1,000 requests/day.

## Description (Long)

Disvr helps AI agents find the right tool for the job. Instead of hardcoding tool lists, your agent calls Disvr's `discover_services` MCP tool and gets smart, ranked recommendations.

**How it works:**
1. Add Disvr as an MCP server in your `.mcp.json`
2. Your agent describes what it needs in natural language (e.g., "translate Chinese legal contract to Thai")
3. Disvr returns top 3 recommendations ranked by a 4-dimensional value score:
   - Semantic relevance (0.30) — how well the tool matches the need
   - Quality (0.25) — documentation completeness, verification status
   - Cost efficiency (0.25) — price per successful call
   - Reliability (0.20) — uptime, latency, success rate

**Key features:**
- 900+ MCP servers indexed from Smithery, GitHub awesome-mcp, and more
- Vector search (OpenAI embeddings) + FTS5 full-text search dual-path
- Closed-loop feedback: agents report call results, which improve future rankings
- Cross-platform: works with Claude, GPT, Gemini, LLaMA, and any MCP-compatible client
- REST API available for non-MCP use cases
- Free tier: 1,000 requests/day, no credit card required

**Built with:** Cloudflare Workers, Hono, D1, Vectorize

## MCP Tool Spec

```json
{
  "name": "discover_services",
  "description": "Find the best MCP tool for a given need. Returns ranked recommendations with value scores.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "need": {
        "type": "string",
        "description": "Natural language description of what tool you need"
      },
      "max_price_per_call": {
        "type": "number",
        "description": "Maximum acceptable price per API call in USD"
      },
      "max_latency_ms": {
        "type": "number",
        "description": "Maximum acceptable p95 latency in milliseconds"
      }
    },
    "required": ["need"]
  }
}
```

## Quick Start (for listing page)

```json
// .mcp.json — one line to connect
{
  "mcpServers": {
    "disvr": {
      "type": "url",
      "url": "https://api.disvr.top/mcp"
    }
  }
}
```

## Tags / Keywords

`mcp`, `tool-discovery`, `agent-infrastructure`, `service-discovery`, `ai-agent`, `mcp-server`, `search-engine`, `tool-search`, `cloudflare-workers`, `vector-search`

---

## Platform-Specific Notes

### Smithery (smithery.ai)

- Submit at: https://smithery.ai/submit (or via their GitHub)
- They may auto-discover from npm/GitHub
- Ensure `package.json` has correct `mcp` metadata

### glama.ai

- Submit at: https://glama.ai/mcp/servers (check their submit flow)
- Focus on the "Developer Tools" category

### mcp.so

- Submit at: https://mcp.so (check their submit flow)
- Include the GitHub repo link for credibility

### MCP Official Registry (modelcontextprotocol.io)

- Check: https://github.com/modelcontextprotocol/servers
- May require a PR to the official servers repo

---

## Screenshots to Prepare

For directory listings, prepare these screenshots:
1. **Landing page** — shows the live demo search and value proposition
2. **Explorer page** — shows the interactive API playground
3. **MCP tool in action** — screenshot of Claude Code using `discover_services`
4. **API response** — JSON response showing ranked recommendations
