import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchServices } from "./discover.js";
import { getServiceCount, getServiceDetail, getServicesPaginated, insertReport } from "./db.js";
import type { Env } from "./types.js";

export class DisvrMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: "disvr",
    version: "0.2.0",
  });

  async init() {
    // ─── Tool 1: discover_tools ───
    // Renamed from discover_services, returns agent-friendly format with install info

    this.server.tool(
      "discover_tools",
      "Find the best tools for a task. Returns ranked recommendations with install instructions.",
      {
        need: z.string().min(5).describe("What you need the tool to do (min 5 chars)"),
        max_results: z.number().min(1).max(10).optional().describe("Max recommendations (1-10, default 3)"),
        type_filter: z.enum(["mcp_server", "api", "library", "cli"]).optional().describe("Filter by tool type"),
      },
      async (params) => {
        const result = await searchServices(this.env, {
          need: params.need,
        });

        let recs = result.recommendations;

        // Apply type filter if specified
        if (params.type_filter) {
          recs = recs.filter((r) => r.type === params.type_filter);
        }

        // Apply max_results limit
        const maxResults = params.max_results ?? 3;
        recs = recs.slice(0, maxResults);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                query_id: result.query_id,
                recommendations: recs.map((r) => ({
                  service_id: r.service_id,
                  name: r.service,
                  summary: r.summary,
                  value_score: r.value_score,
                  match_reason: r.reason,
                  type: r.type,
                  ...(r.install ? { install: r.install } : {}),
                  ...(r.health ? { health: r.health } : {}),
                  ...(r.commonly_used_with?.length ? { commonly_used_with: r.commonly_used_with } : {}),
                })),
              }, null, 2),
            },
          ],
        };
      }
    );

    // ─── Tool 2: get_tool_details ───
    // Full service info with install/env/tools for agent consumption

    this.server.tool(
      "get_tool_details",
      "Get full details for a specific tool, including install instructions, required environment variables, and available tool functions.",
      {
        service_id: z.string().describe("The service ID from discover_tools results"),
      },
      async (params) => {
        const service = await getServiceDetail(this.env.DB, params.service_id);
        if (!service) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "not_found", message: "Service not found" }),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                service_id: service.id,
                name: service.name,
                description: service.description,
                type: service.service_type ?? "mcp_server",
                install: service.install ?? null,
                required_env: service.required_env ?? [],
                tools_provided: service.tools_provided ?? [],
                metrics: {
                  reputation_score: service.reputation_score,
                  success_rate: service.success_rate,
                  uptime_30d: service.uptime_30d,
                  latency_p95_ms: service.latency_p95_ms,
                  total_calls: service.total_calls,
                  retry_rate: service.retry_rate,
                },
                platform: service.platform,
                source_url: service.source_url,
              }, null, 2),
            },
          ],
        };
      }
    );

    // ─── Tool 3: report_result ───
    // Agents report tool call outcomes to improve rankings
    // No auth for MCP channel — tagged as 'mcp_anonymous'

    this.server.tool(
      "report_result",
      "Report the outcome of using a recommended tool. Helps improve future rankings.",
      {
        service_id: z.string().describe("The service ID you used"),
        query_id: z.string().describe("The query_id from the original discover_tools call"),
        success: z.boolean().describe("Whether the tool call succeeded"),
        latency_ms: z.number().optional().describe("How long the tool call took in milliseconds"),
        error_message: z.string().optional().describe("Error message if the call failed"),
      },
      async (params) => {
        await insertReport(this.env.DB, {
          service_id: params.service_id,
          query_id: params.query_id,
          api_key_hash: "mcp_anonymous",
          success: params.success,
          latency_ms: params.latency_ms,
          error_message: params.error_message,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "recorded",
                message: "Thank you. This report will improve future recommendations.",
              }),
            },
          ],
        };
      }
    );

    // ─── Tool 4: list_tools ───
    // Paginated browsing with type filter

    this.server.tool(
      "list_tools",
      "Browse indexed tools. No authentication required.",
      {
        search: z.string().optional().describe("Search keyword to filter tools"),
        type_filter: z.enum(["mcp_server", "api", "library", "cli"]).optional().describe("Filter by type"),
        page: z.number().min(1).optional().describe("Page number (default 1)"),
        limit: z.number().min(1).max(50).optional().describe("Results per page (max 50, default 20)"),
      },
      async (params) => {
        const page = params.page ?? 1;
        const safeLimit = Math.min(params.limit ?? 20, 50);

        const result = await getServicesPaginated(this.env.DB, {
          page,
          limit: safeLimit,
          search: params.search,
          platform: undefined,
          sort: undefined,
        });

        let services = result.services;

        // Apply type filter in-memory (service_type is not a DB column filter in getServicesPaginated)
        if (params.type_filter) {
          services = services.filter((s) => (s.service_type ?? "mcp_server") === params.type_filter);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                services: services.map((s) => ({
                  service_id: s.id,
                  name: s.name,
                  summary: s.description.length > 120 ? s.description.slice(0, 117) + "..." : s.description,
                  type: s.service_type ?? "mcp_server",
                  ...(s.install ? { install: s.install } : {}),
                })),
                total: result.total,
                page,
                limit: safeLimit,
              }, null, 2),
            },
          ],
        };
      }
    );
  }
}
