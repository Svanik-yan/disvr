// Disvr SDK — Tool search engine for AI agents
// https://www.disvr.top

export interface DisvrConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface DiscoverOptions {
  need: string;
  max_price_per_call?: number;
  max_latency_ms?: number;
  min_reputation?: number;
  min_success_rate?: number;
  budget_usd?: number;
  task_context?: string;
}

export interface ServiceRecommendation {
  service: {
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    platform: string;
    protocols: string[];
    pricing: { model: string; price_usd: number };
    reputation_score: number | null;
    success_rate: number | null;
    latency_p95_ms: number | null;
  };
  value_score: number;
  reason: string;
}

export interface DiscoverResult {
  recommendations: ServiceRecommendation[];
  query_id: string;
  cached: boolean;
}

export interface ReportOptions {
  service_id: string;
  query_id: string;
  success: boolean;
  latency_ms?: number;
  error_message?: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  platform: string;
  protocols: string[];
  pricing: { model: string; price_usd: number };
  reputation_score: number | null;
  success_rate: number | null;
  total_calls: number;
}

export interface ListServicesOptions {
  page?: number;
  limit?: number;
  search?: string;
  platform?: string;
  sort?: "reputation" | "name" | "calls" | "price";
}

export interface ListServicesResult {
  services: Service[];
  total: number;
  page: number;
  limit: number;
}

export interface Stats {
  total_services: number;
  total_reports: number;
  avg_success_rate: number | null;
  avg_latency_ms: number | null;
  platforms: { platform: string; count: number }[];
  top_services: { name: string; reputation_score: number | null; total_calls: number }[];
}

export class DisvrError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "DisvrError";
  }
}

export class Disvr {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: DisvrConfig) {
    if (!config.apiKey) {
      throw new Error("apiKey is required");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.disvr.top").replace(/\/$/, "");
  }

  async discover(options: DiscoverOptions): Promise<DiscoverResult> {
    if (!options.need || options.need.trim().length < 5) {
      throw new Error("need must be at least 5 characters");
    }
    return this.post<DiscoverResult>("/discover", options);
  }

  async report(options: ReportOptions): Promise<{ status: string; message: string }> {
    if (!options.service_id || !options.query_id) {
      throw new Error("service_id and query_id are required");
    }
    return this.post("/report", options);
  }

  async listServices(options?: ListServicesOptions): Promise<ListServicesResult> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.search) params.set("search", options.search);
    if (options?.platform) params.set("platform", options.platform);
    if (options?.sort) params.set("sort", options.sort);
    const qs = params.toString();
    return this.get<ListServicesResult>(`/api/services${qs ? `?${qs}` : ""}`);
  }

  async stats(): Promise<Stats> {
    return this.get<Stats>("/api/stats");
  }

  async health(): Promise<{ status: string; services_indexed: number }> {
    return this.get("/health");
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "User-Agent": "disvr-sdk/0.1.0" },
    });
    return this.handleResponse<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "disvr-sdk/0.1.0",
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const data = await res.json() as T & { error?: string; message?: string };
    if (!res.ok) {
      throw new DisvrError(
        data.message ?? `Request failed with status ${res.status}`,
        res.status,
        data.error ?? "unknown_error"
      );
    }
    return data;
  }
}

export default Disvr;
