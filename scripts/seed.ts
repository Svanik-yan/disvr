/**
 * Seed script: Manually insert a few demo services for local testing.
 * Usage: npx wrangler d1 execute disvr-db --local --file=./schema.sql
 *        then: npx tsx scripts/seed.ts (or use wrangler dev + curl /admin/crawl)
 *
 * For production: use POST /admin/crawl to trigger Smithery crawl.
 */

const DEMO_SERVICES = [
  {
    id: "demo-translator-zh-th",
    name: "Thai Legal Translator",
    description: "Specialized Chinese-to-Thai legal document translation with 98%+ accuracy for contracts, agreements, and regulatory filings.",
    capabilities: ["translation", "zh-to-th", "legal", "contract"],
    platform: "manual",
    protocols: { mcp: "mcp://demo/thai-legal-translator" },
    pricing: { model: "per_call", price_usd: 0.06 },
    reputation_score: 4.8,
    success_rate: 0.982,
    total_calls: 103847,
    successful_calls: 101980,
    failed_calls: 1867,
    retry_rate: 0.02,
    avg_cost_per_success: 0.061,
    latency_p95_ms: 2100,
    doc_completeness: 0.9,
  },
  {
    id: "demo-web-scraper",
    name: "Universal Web Scraper",
    description: "Extract structured data from any webpage. Supports JavaScript rendering, pagination, and anti-bot bypass.",
    capabilities: ["scraping", "web", "data-extraction", "browser"],
    platform: "smithery",
    protocols: { mcp: "mcp://smithery/web-scraper-pro", rest: "https://api.scraper.example/v1" },
    pricing: { model: "per_call", price_usd: 0.002 },
    reputation_score: 4.2,
    success_rate: 0.91,
    total_calls: 50000,
    successful_calls: 45500,
    failed_calls: 4500,
    retry_rate: 0.12,
    avg_cost_per_success: 0.0024,
    latency_p95_ms: 3500,
    doc_completeness: 0.7,
  },
  {
    id: "demo-code-review",
    name: "AI Code Reviewer",
    description: "Automated code review with security vulnerability detection, style suggestions, and bug finding. Supports 20+ languages.",
    capabilities: ["code-review", "security", "linting", "bug-detection"],
    platform: "github",
    protocols: { rest: "https://api.codereview.example/v2/review" },
    pricing: { model: "per_call", price_usd: 0.10 },
    reputation_score: 4.5,
    success_rate: 0.97,
    total_calls: 28000,
    successful_calls: 27160,
    failed_calls: 840,
    retry_rate: 0.03,
    avg_cost_per_success: 0.103,
    latency_p95_ms: 8000,
    doc_completeness: 0.95,
  },
  {
    id: "demo-email-sender",
    name: "Transactional Email",
    description: "Send transactional emails with templates, tracking, and deliverability optimization.",
    capabilities: ["email", "notification", "transactional"],
    platform: "manual",
    protocols: { rest: "https://api.emailservice.example/send" },
    pricing: { model: "per_call", price_usd: 0.001 },
    reputation_score: 4.6,
    success_rate: 0.995,
    total_calls: 500000,
    successful_calls: 497500,
    failed_calls: 2500,
    retry_rate: 0.01,
    avg_cost_per_success: 0.001,
    latency_p95_ms: 200,
    doc_completeness: 1.0,
  },
  {
    id: "demo-pdf-parser",
    name: "PDF Document Parser",
    description: "Extract text, tables, and metadata from PDF documents. Supports OCR for scanned documents.",
    capabilities: ["pdf", "ocr", "document-parsing", "table-extraction"],
    platform: "smithery",
    protocols: { mcp: "mcp://smithery/pdf-parser" },
    pricing: { model: "free", price_usd: 0 },
    reputation_score: 3.8,
    success_rate: 0.88,
    total_calls: 15000,
    successful_calls: 13200,
    failed_calls: 1800,
    retry_rate: 0.15,
    avg_cost_per_success: 0,
    latency_p95_ms: 4500,
    doc_completeness: 0.6,
  },
];

// Output as SQL for wrangler d1 execute
for (const s of DEMO_SERVICES) {
  const sql = `INSERT OR REPLACE INTO services (id, name, description, capabilities, platform, protocols, pricing, reputation_score, success_rate, total_calls, successful_calls, failed_calls, retry_rate, avg_cost_per_success, latency_p95_ms, doc_completeness, verified, uptime_30d) VALUES ('${s.id}', '${s.name.replace(/'/g, "''")}', '${s.description.replace(/'/g, "''")}', '${JSON.stringify(s.capabilities)}', '${s.platform}', '${JSON.stringify(s.protocols)}', '${JSON.stringify(s.pricing)}', ${s.reputation_score}, ${s.success_rate}, ${s.total_calls}, ${s.successful_calls}, ${s.failed_calls}, ${s.retry_rate}, ${s.avg_cost_per_success}, ${s.latency_p95_ms}, ${s.doc_completeness}, 1, 0.99);`;
  console.log(sql);
}
