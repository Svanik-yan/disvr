import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchServices } from "./discover.js";
import { getServiceCount, insertCallReport } from "./db.js";
import type { Env } from "./types.js";

export class DisvrMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: "disvr",
    version: "0.1.0",
  });

  async init() {
    this.server.tool(
      "discover_services",
      "Find the best AI agent services/tools for a given task. Returns top 3 recommendations ranked by relevance, reputation, and cost.",
      {
        need: z.string().min(5).describe("Natural language description of what you need, e.g. 'translate Chinese legal contract to Thai'"),
        max_price_per_call: z.number().optional().describe("Maximum price per API call in USD"),
        max_latency_ms: z.number().optional().describe("Maximum acceptable latency in milliseconds"),
        min_reputation: z.number().min(0).max(5).optional().describe("Minimum reputation score (0-5)"),
      },
      async (params) => {
        const result = await searchServices(this.env, {
          need: params.need,
          max_price_per_call: params.max_price_per_call,
          max_latency_ms: params.max_latency_ms,
          min_reputation: params.min_reputation,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    this.server.tool(
      "list_service_count",
      "Get the total number of indexed services in the Disvr registry.",
      {},
      async () => {
        const count = await getServiceCount(this.env.DB);
        return {
          content: [
            {
              type: "text" as const,
              text: `Disvr currently indexes ${count} services across multiple platforms.`,
            },
          ],
        };
      }
    );

    // Feedback loop: agents report call results → improves future recommendations
    this.server.tool(
      "report_call_result",
      "Report the result of a tool/service call back to Disvr. This feedback improves future recommendations for all agents. Include whether the call succeeded, actual cost, latency, and whether retries were needed.",
      {
        service_id: z.string().describe("The service ID from the recommendation"),
        query_id: z.string().describe("The query_id from the discover response"),
        success: z.boolean().describe("Whether the call completed the task successfully"),
        actual_latency_ms: z.number().describe("Actual latency in milliseconds"),
        actual_cost_usd: z.number().default(0).describe("Actual cost in USD"),
        retried: z.boolean().default(false).describe("Whether a retry was needed"),
        retry_count: z.number().default(0).describe("Number of retries"),
        human_escalated: z.boolean().default(false).describe("Whether a human had to take over"),
        task_context: z.string().optional().describe("Brief description of the task"),
      },
      async (params: {
        service_id: string;
        query_id: string;
        success: boolean;
        actual_latency_ms: number;
        actual_cost_usd: number;
        retried: boolean;
        retry_count: number;
        human_escalated: boolean;
        task_context?: string;
      }) => {
        await insertCallReport(this.env.DB, {
          service_id: params.service_id,
          query_id: params.query_id,
          success: params.success,
          actual_latency_ms: params.actual_latency_ms,
          actual_cost_usd: params.actual_cost_usd,
          retried: params.retried,
          retry_count: params.retry_count,
          human_escalated: params.human_escalated,
          task_context: params.task_context ?? null,
        }, "mcp-agent");

        return {
          content: [
            {
              type: "text" as const,
              text: "Call report recorded. This feedback improves future recommendations for all agents.",
            },
          ],
        };
      }
    );
  }
}
