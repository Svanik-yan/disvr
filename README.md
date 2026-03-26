<h1 align="center">🔍 Disvr</h1>

<p align="center">
  <strong>AI Agent 的智能消费决策引擎 — "Agent 版大众点评"</strong>
</p>

<p align="center">
  <a href="https://www.disvr.top"><img src="https://img.shields.io/badge/Live-www.disvr.top-00d4aa?style=for-the-badge" alt="Live Site"></a>
  <a href="https://api.disvr.top/health"><img src="https://img.shields.io/badge/API-Online-62fae3?style=for-the-badge" alt="API Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

<p align="center">
  <a href="#为什么需要-disvr">Why Disvr</a> · <a href="#快速上手">Quick Start</a> · <a href="#api-reference">API</a> · <a href="#系统架构">Architecture</a> · <a href="https://www.disvr.top">Live Demo</a>
</p>

---

## 为什么需要 Disvr？

AI Agent 生态正在爆发。支付协议（Stripe MPP、OpenAI ACP、x402）解决了**怎么付**，目录（Smithery、Composio）解决了**有什么**。

但没人解决最关键的问题：**该用哪个？值不值得用？**

> 🤖 "帮我翻译一份中文法律合同到泰文" → Smithery 上有 50 个翻译服务，**用哪个性价比最高？**
>
> 🤖 "帮我抓取电商网站的价格" → 有 30 个爬虫工具，**哪个成功率最高、延迟最低？**
>
> 🤖 "帮我生成一张产品图" → 有 20 个图片生成服务，**哪个最便宜且质量够用？**

Agent 现在只能盲选。选错了就是浪费钱、浪费时间、任务失败。

**Disvr 解决这个问题。**

不是返回一个列表，而是返回一个 **排名推荐** — 基于 4 维价值评分：

| 维度 | 权重 | 衡量什么 |
|------|------|---------|
| 🎯 语义匹配 | 0.30 | 服务描述与需求的匹配度 |
| ⭐ 质量评分 | 0.25 | 历史成功率、用户评价 |
| 💰 成本效率 | 0.25 | 单次调用成本、性价比 |
| 🔒 可靠性 | 0.20 | 延迟、重试率、可用性 |

**你的 Agent 不再猜，而是选最值得用的。**

---

## ✅ 在你用之前

| | |
|---|---|
| 💰 **免费使用** | 免费层 1000 次/天查询，无需信用卡 |
| 🔌 **MCP 原生** | 一行配置接入 Claude Code、Cursor 等任何 MCP 客户端 |
| 🔄 **闭环反馈** | Agent 上报调用结果 → 评分越用越准 |
| ☁️ **全球边缘** | 部署在 Cloudflare Workers，全球低延迟 |
| 📡 **实时数据** | 每小时从 Smithery 爬取最新服务数据 |

---

## 快速上手

### 方式一：MCP Server（推荐）

在你的 `.mcp.json` 中添加一行：

```json
{
  "mcpServers": {
    "disvr": {
      "type": "url",
      "url": "https://api.disvr.top/mcp"
    }
  }
}
```

重启 Claude Code / Cursor，你的 Agent 就获得了 `discover_services` 工具。

试试对 Agent 说：

- **"帮我找一个翻译中文法律文件到泰文的工具"**
- **"推荐一个最便宜的网页抓取服务"**
- **"哪个图片生成 API 性价比最高？"**

### 方式二：REST API

```bash
curl -X POST https://api.disvr.top/discover \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"need": "translate Chinese legal contract to Thai"}'
```

返回 Top 3 推荐，按 value_score 排名：

```json
{
  "recommendations": [
    {
      "service": "deepl-mcp-server",
      "platform": "smithery",
      "match_confidence": 0.92,
      "reputation": 4.2,
      "price_usd": 0.002,
      "reason": "Best cost/quality ratio for legal document translation"
    }
  ]
}
```

---

## 在线体验

| 页面 | 链接 | 说明 |
|------|------|------|
| 🏠 **首页** | [www.disvr.top](https://www.disvr.top) | 产品介绍 |
| 🔍 **Explorer** | [www.disvr.top/explorer](https://www.disvr.top/explorer) | 在线交互式查询，即时看到推荐结果 |
| 📋 **Registry** | [www.disvr.top/registry](https://www.disvr.top/registry) | 已索引服务列表 |
| 📊 **Analytics** | [www.disvr.top/analytics](https://www.disvr.top/analytics) | 系统架构与评分可视化 |

---

## API Reference

### `POST /discover` — 服务发现

请求你的 Agent 需要什么，返回 Top 3 推荐。

```
POST https://api.disvr.top/discover
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "need": "scrape product prices from e-commerce websites",
  "max_price_per_call": 0.01,
  "max_latency_ms": 5000,
  "min_reputation": 3.0
}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `need` | ✅ | 描述你需要什么（≥5 字符） |
| `max_price_per_call` | ❌ | 单次调用最高价格（USD） |
| `max_latency_ms` | ❌ | 最大可接受延迟（毫秒） |
| `min_reputation` | ❌ | 最低声誉评分（0-5） |

### `POST /report` — 反馈上报

Agent 调用工具后上报结果，闭环改进排名。

```
POST https://api.disvr.top/report
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "service_id": "deepl-mcp-server",
  "query_id": "q_abc123",
  "success": true,
  "latency_ms": 1200,
  "cost_usd": 0.002
}
```

### `GET /health` — 健康检查

```bash
curl https://api.disvr.top/health
# {"status": "ok", "services_indexed": 330}
```

### MCP Tools

通过 MCP Server 暴露的工具：

| 工具 | 说明 |
|------|------|
| `discover_services` | 语义搜索 + 4维排名推荐 |
| `list_service_count` | 当前索引的服务总数 |
| `report_call_result` | 上报调用结果（闭环反馈） |

---

## 系统架构

```
Agent Query ("I need X")
       │
       ▼
┌─────────────────────────────────────────┐
│  Disvr API (Cloudflare Workers + Hono)  │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐    ┌──────────────────┐   │
│  │ Embed    │───▶│ CF Vectorize     │   │
│  │ (OpenAI) │    │ (1536-dim cosine)│   │
│  └──────────┘    └────────┬─────────┘   │
│                           │             │
│         ┌─────── 50 candidates ──────┐  │
│         ▼                            │  │
│  ┌──────────────┐   ┌────────────┐   │  │
│  │ D1 Database  │   │ FTS5       │   │  │
│  │ (services,   │   │ (fallback) │   │  │
│  │  call_reports)│   └────────────┘   │  │
│  └──────┬───────┘                    │  │
│         │                            │  │
│         ▼                            │  │
│  ┌──────────────────────────────┐    │  │
│  │ 4-Dim Value Ranking          │    │  │
│  │ semantic × 0.30              │    │  │
│  │ quality  × 0.25              │    │  │
│  │ cost_eff × 0.25              │    │  │
│  │ reliable × 0.20              │    │  │
│  └──────────┬───────────────────┘    │  │
│             ▼                        │  │
│        Top 3 Recommendations         │  │
│                                      │  │
├──────────────────────────────────────┤  │
│  MCP Server (Streamable HTTP)        │  │
│  via CF Agents SDK + Durable Objects │  │
└──────────────────────────────────────┘  │
                                          │
       ┌──────────────────────────────────┘
       ▼
  ┌─────────────┐
  │ Cron Trigger │  ← 每小时从 Smithery 爬取
  │ (hourly)     │     embedAndIndex → Vectorize
  └─────────────┘
       │
  ┌────▼────────────┐
  │ POST /report    │  ← Agent 反馈
  │ refreshStats()  │     success_rate, latency → 排名改进
  └─────────────────┘
```

### 技术栈

| 组件 | 技术 |
|------|------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Database | Cloudflare D1 (SQLite) |
| Vector Search | CF Vectorize (1536-dim, cosine) |
| Text Search | FTS5 (OR + prefix, 降级方案) |
| Embedding | OpenAI text-embedding-3-small |
| MCP Server | CF Agents SDK (McpAgent + Durable Objects) |
| Data Source | Smithery Registry (16,000+ servers) |
| Cron | CF Cron Trigger (hourly) |
| Language | TypeScript |

---

## 项目结构

```
disvr/
├── wrangler.toml           # CF Workers 配置
├── schema.sql              # D1 数据库 Schema
├── src/
│   ├── index.ts            # Hono 入口 + REST 路由
│   ├── discover.ts         # 核心：语义搜索 + 4维排名
│   ├── db.ts               # D1 CRUD + 反馈统计
│   ├── crawl.ts            # Smithery 爬虫 + embedAndIndex
│   ├── mcp.ts              # MCP Server (Streamable HTTP)
│   ├── types.ts            # TypeScript 类型定义
│   ├── landing.ts          # 落地页 HTML
│   └── pages/
│       ├── registry.ts     # Provider Registry 页面
│       ├── explorer.ts     # Agent Query Explorer 页面
│       └── analytics.ts    # Analytics Dashboard 页面
├── test/
│   ├── types.test.ts       # 类型转换测试
│   └── discover.test.ts    # 匹配引擎测试
└── .mcp.json               # MCP 配置示例
```

---

## 本地开发

```bash
# 前置要求: Node.js 22+
nvm use 22

# 安装依赖
npm install

# 本地开发
npx wrangler dev

# 运行测试
npx vitest run

# 部署
npx wrangler deploy
```

### 环境变量

```bash
# 设置 OpenAI API Key（用于 embedding）
wrangler secret put OPENAI_API_KEY
```

### 数据库初始化

```bash
# 创建 D1 数据库
wrangler d1 create disvr-db

# 执行 Schema
wrangler d1 execute disvr-db --file=./schema.sql

# 创建 Vectorize 索引
wrangler vectorize create disvr-mcp-index --dimensions=1536 --metric=cosine
```

---

## 设计理念

### Spend Intelligence, Not Just Search

Disvr 不是目录，不是市场。它是一个 **决策层（decision layer）**。

传统目录返回一个列表，让你自己挑。Disvr 返回一个**推荐**，告诉你：
- 这个工具**为什么值得用**
- 它的**性价比如何**
- 和其他选项**相比怎么样**

### 闭环反馈是护城河

每一次 Agent 调用工具后的反馈（成功/失败、延迟、成本）都会回流到排名算法。用的人越多，推荐越准。这不是静态数据库，这是一个**活的智能系统**。

### 双路搜索保证召回

- **主路径**：OpenAI embedding → CF Vectorize 向量搜索（语义匹配）
- **降级路径**：FTS5 全文搜索（OR + 前缀通配）
- Embedding 失败或向量搜索无结果时自动降级，保证永远有结果返回

---

## Roadmap

- [x] 核心 API (discover + report + health)
- [x] MCP Server (Streamable HTTP)
- [x] Smithery 爬虫 (330+ 服务)
- [x] 落地页 + 4 个前端页面
- [x] 自定义域名 (www.disvr.top + api.disvr.top)
- [ ] 更多数据源 (MCP Official Registry, GitHub)
- [ ] Agent 实际集成验证
- [ ] 补充测试 (db.test.ts, api.test.ts, crawl.test.ts)
- [ ] 用户注册 + API Key 管理界面
- [ ] 成本追踪仪表板

---

## 贡献

欢迎 PR 和 Issue！

- 🐛 Bug 反馈 → [GitHub Issues](https://github.com/Svanik-yan/disvr/issues)
- 💡 功能建议 → [GitHub Issues](https://github.com/Svanik-yan/disvr/issues)
- 🔧 代码贡献 → Fork & PR

---

## 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/) — 全球边缘计算
- [Hono](https://hono.dev/) — 轻量级 Web 框架
- [Smithery](https://smithery.ai/) — MCP 服务注册中心
- [OpenAI](https://openai.com/) — text-embedding-3-small
- [CF Agents SDK](https://developers.cloudflare.com/agents/) — MCP Server 实现

---

## License

[MIT](LICENSE)

---

<p align="center">
  <strong>Stop guessing. Start discovering.</strong>
  <br/>
  <a href="https://www.disvr.top">www.disvr.top</a> · <a href="https://api.disvr.top/mcp">MCP Server</a> · <a href="https://api.disvr.top/health">API Status</a>
</p>
