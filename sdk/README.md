# disvr

Official SDK for [Disvr](https://www.disvr.top) — tool search engine for AI agents.

One API call, your agent finds any tool it needs.

## Install

```bash
npm install @sylar_yan/disvr
```

## Quick Start

```typescript
import { Disvr } from "@sylar_yan/disvr";

const client = new Disvr({ apiKey: "dsvr_your_key_here" });

// Find the best tool for a task
const result = await client.discover({
  need: "translate Chinese legal contract to Thai",
});

console.log(result.recommendations);
// [{ service: { name: "deepl-mcp-server", ... }, value_score: 0.92, reason: "..." }]

// Report results to improve rankings
await client.report({
  service_id: result.recommendations[0].service.id,
  query_id: result.query_id,
  success: true,
  latency_ms: 1200,
});
```

## API

### `new Disvr(config)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | required | Your Disvr API key (`dsvr_` prefix) |
| `baseUrl` | `string` | `https://api.disvr.top` | API base URL |

Get a free API key at [disvr.top/keys](https://www.disvr.top/keys) (1,000 requests/day).

### `client.discover(options)`

Find the best tools for a task.

```typescript
const result = await client.discover({
  need: "send email with attachments",     // required, min 5 chars
  max_price_per_call: 0.01,                // optional, USD
  max_latency_ms: 1000,                    // optional
  min_reputation: 0.7,                     // optional, 0-1
  budget_usd: 5.0,                         // optional
  task_context: "production email service", // optional
});
```

Returns `{ recommendations, query_id, cached }`.

### `client.report(options)`

Report call results to improve future rankings.

```typescript
await client.report({
  service_id: "service-uuid",
  query_id: "query-uuid",
  success: true,
  latency_ms: 500,
  error_message: undefined,
});
```

### `client.listServices(options?)`

Browse indexed services (no auth required).

```typescript
const { services, total } = await client.listServices({
  search: "weather",
  page: 1,
  limit: 20,
});
```

### `client.stats()`

Get system statistics.

### `client.health()`

Check API status.

## Error Handling

```typescript
import { Disvr, DisvrError } from "@sylar_yan/disvr";

try {
  await client.discover({ need: "..." });
} catch (e) {
  if (e instanceof DisvrError) {
    console.error(e.code);    // "rate_limited", "unauthorized", etc.
    console.error(e.status);  // 429, 401, etc.
    console.error(e.message); // Human-readable message
  }
}
```

## License

MIT
