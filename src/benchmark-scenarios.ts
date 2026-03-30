// ─── Benchmark Scenario Definitions ───

export interface EvalWeights {
  availability: number;
  installability: number;
  responsiveness: number;
  freshness: number;
  popularity: number;
  cost_efficiency: number;
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  category_match: string;
  tags_match: string[];
  eval_weights: EvalWeights;
}

// Scenarios based on actual capabilities distribution in services table:
// search(452), code(149), web(148), file(87), database(83), image(56),
// email(40), sql(31), pdf(26), browser(26), scraping(16)

export const DEFAULT_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "web-search",
    name: "Web Search",
    description: "Search the web and return relevant results",
    category_match: "search",
    tags_match: ["web", "search", "google", "bing", "brave"],
    eval_weights: { availability: 0.25, installability: 0.15, responsiveness: 0.20, freshness: 0.10, popularity: 0.10, cost_efficiency: 0.20 },
  },
  {
    id: "web-scrape",
    name: "Web Scraping",
    description: "Extract structured data from web pages",
    category_match: "scraping",
    tags_match: ["scrape", "crawl", "extract", "html", "browser"],
    eval_weights: { availability: 0.25, installability: 0.15, responsiveness: 0.20, freshness: 0.10, popularity: 0.10, cost_efficiency: 0.20 },
  },
  {
    id: "file-management",
    name: "File Management",
    description: "Read, write, and manage files",
    category_match: "file",
    tags_match: ["file", "read", "write", "filesystem"],
    eval_weights: { availability: 0.20, installability: 0.20, responsiveness: 0.15, freshness: 0.10, popularity: 0.15, cost_efficiency: 0.20 },
  },
  {
    id: "code-execution",
    name: "Code Execution",
    description: "Execute code snippets in various languages",
    category_match: "code",
    tags_match: ["execute", "run", "interpreter", "sandbox", "code"],
    eval_weights: { availability: 0.25, installability: 0.15, responsiveness: 0.20, freshness: 0.10, popularity: 0.10, cost_efficiency: 0.20 },
  },
  {
    id: "database",
    name: "Database Query",
    description: "Query and manage databases",
    category_match: "database",
    tags_match: ["sql", "postgres", "mysql", "sqlite", "database"],
    eval_weights: { availability: 0.20, installability: 0.20, responsiveness: 0.15, freshness: 0.10, popularity: 0.15, cost_efficiency: 0.20 },
  },
  {
    id: "email",
    name: "Email",
    description: "Send and manage emails",
    category_match: "email",
    tags_match: ["email", "smtp", "mail", "send"],
    eval_weights: { availability: 0.25, installability: 0.15, responsiveness: 0.15, freshness: 0.10, popularity: 0.10, cost_efficiency: 0.25 },
  },
  {
    id: "image-generation",
    name: "Image Generation",
    description: "Generate images from text prompts",
    category_match: "image",
    tags_match: ["image", "generate", "dalle", "diffusion", "art"],
    eval_weights: { availability: 0.25, installability: 0.10, responsiveness: 0.20, freshness: 0.10, popularity: 0.10, cost_efficiency: 0.25 },
  },
  {
    id: "pdf-processing",
    name: "PDF Processing",
    description: "Read, create, and manipulate PDF files",
    category_match: "pdf",
    tags_match: ["pdf", "document", "ocr"],
    eval_weights: { availability: 0.20, installability: 0.20, responsiveness: 0.15, freshness: 0.10, popularity: 0.15, cost_efficiency: 0.20 },
  },
  {
    id: "http-client",
    name: "HTTP Requests",
    description: "Make HTTP requests to external APIs",
    category_match: "api",
    tags_match: ["http", "api", "request", "fetch", "rest"],
    eval_weights: { availability: 0.25, installability: 0.15, responsiveness: 0.20, freshness: 0.10, popularity: 0.10, cost_efficiency: 0.20 },
  },
  {
    id: "data-transform",
    name: "Data Transformation",
    description: "Transform data between formats (JSON, CSV, XML, etc.)",
    category_match: "data",
    tags_match: ["transform", "convert", "json", "csv", "xml", "parse"],
    eval_weights: { availability: 0.20, installability: 0.20, responsiveness: 0.15, freshness: 0.10, popularity: 0.15, cost_efficiency: 0.20 },
  },
];
