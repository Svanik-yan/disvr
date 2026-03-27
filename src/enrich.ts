// ========== GitHub README 抓取 ==========

interface GitHubReadme {
  content: string;
  encoding: string;
}

export async function fetchGitHubReadme(
  githubUrl: string
): Promise<string | null> {
  // 从 github_url 提取 owner/repo
  // 支持格式：
  //   https://github.com/owner/repo
  //   https://github.com/owner/repo.git
  //   https://github.com/owner/repo/tree/main/...
  const match = githubUrl.match(
    /github\.com\/([^\/]+)\/([^\/\.\#\?]+)/
  );
  if (!match) return null;

  const [, owner, repo] = match;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;

  try {
    const resp = await fetch(apiUrl, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "disvr-enrichment/1.0",
      },
    });
    if (!resp.ok) return null;

    const data = (await resp.json()) as GitHubReadme;
    if (data.encoding === "base64") {
      return atob(data.content);
    }
    return data.content;
  } catch {
    return null;
  }
}

// ========== LLM 结构化提取 ==========

interface ExtractedData {
  install_command: string | null;
  install_runtime: string | null;
  required_env: Array<{
    key: string;
    description: string;
    free_tier?: boolean;
  }>;
  tools_provided: Array<{
    name: string;
    description: string;
    example_input?: Record<string, unknown>;
  }>;
}

const EXTRACT_PROMPT = `You are a structured data extractor. Given a GitHub README for an MCP server or developer tool, extract the following information. Return ONLY valid JSON, no markdown.

{
  "install_command": "the primary install/run command (e.g. 'npx @modelcontextprotocol/server-github' or 'pip install mcp-server-fetch'), null if not found",
  "install_runtime": "node | python | docker | binary — based on the install command",
  "required_env": [
    {
      "key": "ENV_VAR_NAME",
      "description": "what this env var is for",
      "free_tier": true or false (whether a free tier is available for this key)
    }
  ],
  "tools_provided": [
    {
      "name": "tool_function_name",
      "description": "what this tool does",
      "example_input": { "param": "example_value" }
    }
  ]
}

Rules:
- If info is not found in the README, use null for strings, empty arrays for lists
- For install_command, prefer npx/pip/docker commands
- For tools_provided, look for MCP tool definitions, function names, or API endpoints
- For required_env, look for environment variables, API keys, tokens mentioned
- Keep descriptions concise (under 100 chars)
- example_input should be minimal, just enough to show the format`;

export async function extractStructuredData(
  readme: string,
  openaiApiKey: string
): Promise<ExtractedData> {
  const truncated = readme.slice(0, 8000);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACT_PROMPT },
        { role: "user", content: `README content:\n\n${truncated}` },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    console.error("OpenAI API error:", resp.status, await resp.text());
    return { install_command: null, install_runtime: null, required_env: [], tools_provided: [] };
  }

  const data = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content;
  if (!content) {
    return { install_command: null, install_runtime: null, required_env: [], tools_provided: [] };
  }

  try {
    const parsed = JSON.parse(content) as ExtractedData;
    return {
      install_command: parsed.install_command ?? null,
      install_runtime: parsed.install_runtime ?? null,
      required_env: Array.isArray(parsed.required_env) ? parsed.required_env : [],
      tools_provided: Array.isArray(parsed.tools_provided) ? parsed.tools_provided : [],
    };
  } catch {
    console.error("Failed to parse LLM response:", content);
    return { install_command: null, install_runtime: null, required_env: [], tools_provided: [] };
  }
}

// ========== 批量填充 ==========

interface EnrichResult {
  total: number;
  enriched: number;
  skipped: number;
  failed: number;
  details: Array<{
    id: string;
    name: string;
    status: "enriched" | "skipped" | "failed";
    reason?: string;
  }>;
}

export async function enrichServices(
  db: D1Database,
  openaiApiKey: string,
  options: {
    limit?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<EnrichResult> {
  const limit = options.limit ?? 20;
  const forceRefresh = options.forceRefresh ?? false;

  // 查找需要填充的 services：有 source_url (GitHub) 但缺少 required_env/tools_provided
  const condition = forceRefresh
    ? "WHERE source_url IS NOT NULL AND source_url LIKE '%github.com%'"
    : "WHERE source_url IS NOT NULL AND source_url LIKE '%github.com%' AND (tools_provided IS NULL OR required_env IS NULL)";

  const rows = await db
    .prepare(`SELECT id, name, source_url, install_command FROM services ${condition} LIMIT ?`)
    .bind(limit)
    .all();

  const services = rows.results ?? [];
  const result: EnrichResult = {
    total: services.length,
    enriched: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const service of services) {
    const id = service.id as string;
    const name = service.name as string;
    const sourceUrl = service.source_url as string;

    // 1. 抓取 README
    const readme = await fetchGitHubReadme(sourceUrl);
    if (!readme) {
      result.skipped++;
      result.details.push({ id, name, status: "skipped", reason: "README not found" });
      continue;
    }

    // 2. LLM 提取
    const extracted = await extractStructuredData(readme, openaiApiKey);

    // 3. 写入 DB
    try {
      // 如果爬虫已经写入了 install_command，不覆盖
      const installCommand = (service.install_command as string) || extracted.install_command;
      const installRuntime = extracted.install_runtime;

      await db
        .prepare(
          `UPDATE services SET
            install_command = COALESCE(install_command, ?),
            install_runtime = COALESCE(install_runtime, ?),
            required_env = ?,
            tools_provided = ?
           WHERE id = ?`
        )
        .bind(
          installCommand,
          installRuntime,
          extracted.required_env.length > 0 ? JSON.stringify(extracted.required_env) : null,
          extracted.tools_provided.length > 0 ? JSON.stringify(extracted.tools_provided) : null,
          id
        )
        .run();

      result.enriched++;
      result.details.push({ id, name, status: "enriched" });
    } catch (err) {
      result.failed++;
      result.details.push({
        id,
        name,
        status: "failed",
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return result;
}
