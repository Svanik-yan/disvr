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

// ─── Agent-Friendly Types ───

export interface InstallInfo {
  command: string;
  runtime: "node" | "python" | "docker" | "binary";
  min_version?: string;
}

export interface EnvRequirement {
  key: string;
  description: string;
  free_tier?: boolean;
}

export interface ToolProvided {
  name: string;
  description: string;
  example_input?: Record<string, unknown>;
}

export type ServiceType = "mcp_server" | "api" | "library" | "cli";

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
  service_type?: ServiceType;
  install?: InstallInfo | null;
  required_env?: EnvRequirement[] | null;
  tools_provided?: ToolProvided[] | null;
  pricing_model?: string | null;
  cost_per_call?: number | null;
  free_tier_limit?: number | null;
  monthly_price?: number | null;
  pricing_details?: Record<string, any> | null;
}

/**
 * DiscoverRequest: Agent 发来的需求
 * 核心差异点：不只是"找工具"，而是"在预算约束下找到最值的工具"
 */
export type PricingModel = 'free' | 'freemium' | 'paid' | 'open_source' | 'unknown';

export interface CostInfo {
  pricing_model: PricingModel;
  cost_per_call: number | null;
  free_tier_limit: number | null;
  monthly_price: number | null;
  pricing_details: Record<string, any>;
}

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
  /** 最大单次调用成本 (USD) */
  max_cost_per_call?: number;
  /** 只要特定定价模型 */
  pricing_model?: string;
  /** 月费上限 (USD) */
  max_monthly_price?: number;
}

/**
 * Recommendation: 返回给 Agent 的推荐结果
 * 核心创新：不只是匹配度，而是 spend efficiency 评分
 */
export interface Recommendation {
  service_id: string;
  service: string;
  summary: string;
  platform: string;
  type: ServiceType;
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
  /** 安装信息（可选，有则提供） */
  install?: InstallInfo;
  /** 健康状态（可选，有则提供） */
  health?: {
    status: string;
    uptime_30d: number;
    last_checked: string;
  };
  /** 常见搭配工具（可选，有则提供） */
  commonly_used_with?: CooccurrenceResult[];
  /** 弃用警告（工具不健康时提供） */
  deprecation_warning?: DeprecationWarning;
  /** 成本情报（非 unknown 时提供） */
  cost?: {
    pricing_model: string;
    cost_per_call: number | null;
    free_tier_limit: number | null;
    monthly_price: number | null;
  };
  /** 错误风险画像（有错误历史时提供） */
  error_profile?: ErrorProfile;
  /** 版本变更警告（近期有 breaking change 时提供） */
  version_warning?: VersionWarning;
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

// ─── Health Check Types ───

export interface HealthCheck {
  id: number;
  service_id: string;
  check_type: 'github' | 'npm' | 'pypi' | 'endpoint';
  status: 'alive' | 'dead' | 'stale' | 'timeout' | 'error';
  response_time_ms: number;
  details: Record<string, any>;
  checked_at: string;
}

export interface HealthSummary {
  service_id: string;
  overall_status: 'healthy' | 'degraded' | 'dead' | 'unknown';
  github_status: string | null;
  package_status: string | null;
  endpoint_status: string | null;
  last_updated: string | null;
  uptime_30d: number;
  avg_response_ms: number | null;
  last_check_at: string | null;
  install_score: number | null;
  install_difficulty: string | null;
  install_details: Record<string, any> | null;
  call_success_rate: number | null;
  probe_type: 'mcp' | 'http' | 'none' | null;
  last_probe_details: Record<string, any> | null;
  error_distribution: Record<string, any> | null;
  primary_error_type: string | null;
  error_count_30d: number;
  current_version: string | null;
  last_version_change: string | null;
  recent_breaking_change: boolean;
  updated_at: string;
}

export interface HealthCheckResult {
  service_id: string;
  check_type: 'github' | 'npm' | 'pypi' | 'endpoint' | 'mcp_handshake' | 'api_probe';
  status: 'alive' | 'dead' | 'stale' | 'timeout' | 'error';
  response_time_ms: number;
  details: Record<string, any>;
}

// ─── Error Taxonomy Types ───

export type ErrorType =
  | 'auth_failure'
  | 'rate_limited'
  | 'schema_mismatch'
  | 'not_found'
  | 'server_error'
  | 'timeout'
  | 'connection_refused'
  | 'deprecated'
  | 'ssl_error'
  | 'unknown';

export interface ErrorClassification {
  service_id: string;
  error_type: ErrorType;
  source: 'probe' | 'health_check' | 'user_report';
  details: Record<string, any>;
}

export interface ErrorProfile {
  primary_error: ErrorType;
  error_count_30d: number;
  risk_note: string | null;
}

// ─── Changelog Intelligence Types ───

export interface VersionChange {
  service_id: string;
  package_type: 'npm' | 'pypi';
  version: string;
  previous_version: string | null;
  is_breaking: boolean;
  breaking_reasons: string[];
  changes: Record<string, any>;
  published_at: string | null;
}

export interface VersionWarning {
  current_version: string;
  previous_version: string;
  changed_at: string;
  message: string;
}

// ─── Co-occurrence Types ───

export interface CooccurrencePair {
  service_id_a: string;
  service_id_b: string;
}

export interface CooccurrenceResult {
  service_id: string;
  name: string;
  co_count: number;
}

// ─── Alternative / Deprecation Types ───

export interface Alternative {
  id: string;
  name: string;
  description: string;
  value_score: number;
  health_status: string;
  reason: string;
}

export interface DeprecationWarning {
  status: string;
  message: string;
  alternatives: Alternative[];
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
    service_type: ((row as any).service_type as ServiceType) ?? "mcp_server",
    install: (row as any).install_command
      ? {
          command: (row as any).install_command as string,
          runtime: ((row as any).install_runtime as InstallInfo["runtime"]) ?? "node",
          min_version: (row as any).runtime_version as string | undefined,
        }
      : null,
    required_env: safeParseJson<EnvRequirement[]>((row as any).required_env, null) ?? null,
    tools_provided: safeParseJson<ToolProvided[]>((row as any).tools_provided, null) ?? null,
    pricing_model: (row as any).pricing_model ?? null,
    cost_per_call: (row as any).cost_per_call ?? null,
    free_tier_limit: (row as any).free_tier_limit ?? null,
    monthly_price: (row as any).monthly_price ?? null,
    pricing_details: safeParseJson<Record<string, any>>((row as any).pricing_details, null),
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
