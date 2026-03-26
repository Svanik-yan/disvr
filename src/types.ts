export interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
  MCP_AGENT: DurableObjectNamespace;
}

// ─── Database Row Types ───

export interface ServiceRow {
  id: string;
  name: string;
  description: string;
  capabilities: string | null;
  platform: string;
  protocols: string | null;
  pricing: string | null;
  reputation_score: number | null;
  success_rate: number | null;
  uptime_30d: number | null;
  latency_p95_ms: number | null;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  retry_rate: number | null;
  avg_cost_per_success: number | null;
  doc_completeness: number | null;
  verified: number;
  source_url: string | null;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Domain Types ───

export interface Service {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  platform: string;
  protocols: Record<string, string>;
  pricing: { model: string; price_usd: number };
  reputation_score: number | null;
  success_rate: number | null;
  uptime_30d: number | null;
  latency_p95_ms: number | null;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  retry_rate: number | null;
  avg_cost_per_success: number | null;
  doc_completeness: number | null;
  verified: boolean;
  source_url: string | null;
}

/**
 * DiscoverRequest: Agent 发来的需求
 * 核心差异点：不只是"找工具"，而是"在预算约束下找到最值的工具"
 */
export interface DiscoverRequest {
  need: string;
  /** 每次调用最高价格 (USD) */
  max_price_per_call?: number;
  /** 最大可接受延迟 (ms) */
  max_latency_ms?: number;
  /** 最低信誉分 (0-5) */
  min_reputation?: number;
  /** 最低成功率 (0-1) */
  min_success_rate?: number;
  /** 总预算约束 (USD)，用于估算可调用次数 */
  budget_usd?: number;
  /** 任务类型上下文，影响推荐权重 */
  task_context?: string;
}

/**
 * Recommendation: 返回给 Agent 的推荐结果
 * 核心创新：不只是匹配度，而是 spend efficiency 评分
 */
export interface Recommendation {
  service: string;
  platform: string;
  protocol: string;
  endpoint: string;
  /** 单次调用价格 */
  price_usd: number | null;
  /** 信誉评分 (0-5) */
  reputation: number | null;
  /** P95 延迟 */
  latency_p95_ms: number | null;
  /** 语义匹配度 (0-1) */
  match_confidence: number;
  /** 历史总调用次数 */
  total_calls: number;
  /** 成功率 (0-1) */
  success_rate: number | null;

  // ─── Spend Intelligence 指标 ───

  /** 每次成功调用的实际成本 (含重试) */
  cost_per_success: number | null;
  /** 综合性价比评分 (0-1)：质量/成本比 */
  value_score: number;
  /** 重试率：需要多次调用才能成功的概率 */
  retry_rate: number | null;
  /** 在给定预算下预估可完成的任务数 */
  estimated_tasks_per_budget: number | null;
  /** 推荐理由（机器可读 + 人可读） */
  reason: string;
}

export interface DiscoverResponse {
  recommendations: Recommendation[];
  query_id: string;
  /** 本次查询的 spend 分析摘要 */
  spend_summary: SpendSummary | null;
}

/**
 * SpendSummary: 帮助 Agent 理解整体成本格局
 */
export interface SpendSummary {
  /** 推荐方案的预估单次成本 */
  recommended_cost_usd: number;
  /** 最便宜方案的成本 */
  cheapest_cost_usd: number;
  /** 最高质量方案的成本 */
  best_quality_cost_usd: number;
  /** 给定预算下能完成多少次调用 */
  budget_estimate: { budget_usd: number; estimated_calls: number } | null;
}

// ─── Feedback Loop Types ───

/**
 * CallReport: Agent 回报调用结果，用于闭环优化
 * 这是真正的数据壁垒 —— 不是人工评论，而是机器信号
 */
export interface CallReport {
  service_id: string;
  query_id: string;
  /** 是否成功完成任务 */
  success: boolean;
  /** 实际延迟 (ms) */
  actual_latency_ms: number;
  /** 实际花费 (USD) */
  actual_cost_usd: number;
  /** 是否需要重试 */
  retried: boolean;
  /** 重试次数 */
  retry_count: number;
  /** 是否需要人工接管 */
  human_escalated: boolean;
  /** 任务上下文 */
  task_context: string | null;
}

export interface ApiKeyRecord {
  key_hash: string;
  tier: string;
  daily_usage: number;
  last_reset: string;
}

// ─── Converters ───

export function rowToService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    capabilities: safeParseJson<string[]>(row.capabilities, []),
    platform: row.platform,
    protocols: safeParseJson<Record<string, string>>(row.protocols, {}),
    pricing: safeParseJson<{ model: string; price_usd: number }>(
      row.pricing,
      { model: "free", price_usd: 0 }
    ),
    reputation_score: row.reputation_score,
    success_rate: row.success_rate,
    uptime_30d: row.uptime_30d,
    latency_p95_ms: row.latency_p95_ms,
    total_calls: row.total_calls,
    successful_calls: row.successful_calls,
    failed_calls: row.failed_calls,
    retry_rate: row.retry_rate,
    avg_cost_per_success: row.avg_cost_per_success,
    doc_completeness: row.doc_completeness,
    verified: row.verified === 1,
    source_url: row.source_url,
  };
}

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
