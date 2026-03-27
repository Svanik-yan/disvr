import { describe, it, expect, vi, beforeEach } from "vitest";
import { Disvr, DisvrError } from "../src/index.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Disvr SDK", () => {
  let client: Disvr;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new Disvr({ apiKey: "dsvr_test123" });
  });

  describe("constructor", () => {
    it("throws if apiKey is missing", () => {
      expect(() => new Disvr({ apiKey: "" })).toThrow("apiKey is required");
    });

    it("uses default baseUrl", () => {
      const c = new Disvr({ apiKey: "test" });
      expect(c).toBeDefined();
    });

    it("accepts custom baseUrl", () => {
      const c = new Disvr({ apiKey: "test", baseUrl: "http://localhost:8787" });
      expect(c).toBeDefined();
    });

    it("strips trailing slash from baseUrl", () => {
      const c = new Disvr({ apiKey: "test", baseUrl: "http://localhost:8787/" });
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok", services_indexed: 10 }));
      c.health();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8787/health",
        expect.any(Object)
      );
    });
  });

  describe("discover", () => {
    it("sends correct request", async () => {
      const mockResult = {
        recommendations: [{ service: { id: "s1", name: "test" }, value_score: 0.9, reason: "good" }],
        query_id: "q1",
        cached: false,
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResult));

      const result = await client.discover({ need: "translate text" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.disvr.top/discover",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Authorization": "Bearer dsvr_test123",
            "Content-Type": "application/json",
          }),
        })
      );
      expect(result.recommendations).toHaveLength(1);
      expect(result.query_id).toBe("q1");
    });

    it("throws if need is too short", async () => {
      await expect(client.discover({ need: "hi" })).rejects.toThrow("need must be at least 5 characters");
    });

    it("throws if need is empty", async () => {
      await expect(client.discover({ need: "" })).rejects.toThrow("need must be at least 5 characters");
    });

    it("passes optional filters", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ recommendations: [], query_id: "q2", cached: false }));

      await client.discover({
        need: "weather API",
        max_price_per_call: 0.01,
        max_latency_ms: 500,
        min_reputation: 0.8,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.max_price_per_call).toBe(0.01);
      expect(body.max_latency_ms).toBe(500);
      expect(body.min_reputation).toBe(0.8);
    });
  });

  describe("report", () => {
    it("sends correct request", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok", message: "recorded" }));

      const result = await client.report({
        service_id: "s1",
        query_id: "q1",
        success: true,
        latency_ms: 200,
      });

      expect(result.status).toBe("ok");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.service_id).toBe("s1");
      expect(body.success).toBe(true);
    });

    it("throws if service_id missing", async () => {
      await expect(
        client.report({ service_id: "", query_id: "q1", success: true })
      ).rejects.toThrow("service_id and query_id are required");
    });

    it("throws if query_id missing", async () => {
      await expect(
        client.report({ service_id: "s1", query_id: "", success: true })
      ).rejects.toThrow("service_id and query_id are required");
    });
  });

  describe("listServices", () => {
    it("fetches without params", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ services: [], total: 0, page: 1, limit: 20 }));

      const result = await client.listServices();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.disvr.top/api/services",
        expect.any(Object)
      );
      expect(result.total).toBe(0);
    });

    it("passes search and pagination params", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ services: [], total: 0, page: 2, limit: 10 }));

      await client.listServices({ page: 2, limit: 10, search: "weather" });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
      expect(url).toContain("search=weather");
    });
  });

  describe("stats", () => {
    it("fetches system stats", async () => {
      const mockStats = { total_services: 900, total_reports: 50, avg_success_rate: 0.85, avg_latency_ms: 200, platforms: [], top_services: [] };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockStats));

      const result = await client.stats();

      expect(result.total_services).toBe(900);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.disvr.top/api/stats",
        expect.any(Object)
      );
    });
  });

  describe("health", () => {
    it("fetches health check", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok", services_indexed: 900 }));

      const result = await client.health();

      expect(result.status).toBe("ok");
      expect(result.services_indexed).toBe(900);
    });
  });

  describe("error handling", () => {
    it("throws DisvrError on 401", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: "unauthorized", message: "Invalid API key." }, 401));

      try {
        await client.discover({ need: "translate text" });
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(DisvrError);
        expect((e as DisvrError).status).toBe(401);
        expect((e as DisvrError).code).toBe("unauthorized");
      }
    });

    it("throws DisvrError on 429", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: "rate_limited", message: "Limit exceeded." }, 429));

      try {
        await client.discover({ need: "translate text" });
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(DisvrError);
        expect((e as DisvrError).status).toBe(429);
        expect((e as DisvrError).code).toBe("rate_limited");
      }
    });
  });
});
