# Disvr 商业化策略

> 最后更新：2026-03-27
> 状态：草案 v1 — 待执行验证

---

## 一、定位

### 核心定位

**Agent 的工具搜索引擎。**

一次 API 调用，你的 Agent 就能找到它需要的任何工具。跨平台，不锁定。

### 分受众话术

| 受众 | 关心什么 | 一句话 |
|------|---------|--------|
| Agent 开发者 | 我的 Agent 怎么动态获取工具 | "One API call, your agent finds any tool it needs" |
| 工具/API 提供方 | 怎么被更多 Agent 调用 | "Get discovered by thousands of AI agents" |
| 投资人 | 赛道是什么 | "The search engine for the agent economy" |

### 定位原则

- 强调 **中立性**：不绑定任何 LLM 厂商，Claude/GPT/Gemini/LLaMA 都能用
- 强调 **覆盖面**：不只索引 MCP，也覆盖 OpenAPI、REST、GraphQL
- 避免说 "best"（早期排名数据不够支撑），说 "find any tool"

---

## 二、竞争格局

### 直接竞争

| 竞争者 | 威胁 | 我们的差异化 |
|--------|------|-------------|
| Smithery | 可以自己加 discovery 搜索 | 我们是跨源聚合，不只索引 Smithery |
| Anthropic tool store（潜在） | 官方平台，流量优势 | 他们只服务 Claude 生态，我们跨平台 |
| OpenAI plugin/action store（潜在） | 同上 | 同上 |
| RapidAPI | 已有 API marketplace | 他们面向人类开发者，我们面向 Agent |
| Toolhouse.ai | Agent tool 管理 | 我们专注发现，他们偏执行管理 |

### 核心竞争策略

**做跨平台中立的发现层 — 这是任何单一 LLM 厂商都无法可信地提供的。**

"中立"不是说出来的，要在产品里体现：
1. 索引来源多元化（Smithery + OpenAI Actions + LangChain Hub + RapidAPI 等）
2. 协议支持多元化（MCP + OpenAPI + GraphQL）
3. 首页明确声明兼容所有主流 LLM

### 时间窗口

约 12-18 个月。一旦 OpenAI/Google 推出自己的 tool marketplace，独立发现层的空间会被挤压。核心策略：**快速成为事实标准，让大厂选择接入而非自建。**

---

## 三、壁垒构建

按重要性排序：

### 1. 数据飞轮（最核心）

```
更多 Agent 调用 → 更多 /report 反馈数据 → 排名更准 → 更多 Agent 选择用 → ...
```

- 每次 `/report` 调用都是训练信号
- 后来者缺少历史调用数据，排名质量追不上
- **行动**：强化 report 反馈机制，让开发者有动力提交调用结果

### 2. 供给侧网络效应

```
更多服务被索引 → 对 Agent 更有价值 → 更多 Agent 用 → 服务方更想被收录 → ...
```

- 类似早期 npm registry 的双边市场
- **行动**：开放服务主动提交入口，让工具方能自助注册

### 3. 协议标准化

- 提出开放的 Agent Service Discovery Protocol（ASDP）
- 标准归社区，参考实现归我们
- 一旦被 2-3 个主流框架采用，地位就稳了

### 4. 用户资产

- 积累的 Agent 开发者群体 = 下一个产品的冷启动池
- 可衍生方向：Agent Marketplace、Agent Monitoring、Agent Billing

---

## 四、传播策略

### 核心认知

**用户是 Agent 和 Agent 开发者，不是终端消费者。** 传播渠道必须围绕开发者生态。

### 关键指标

- 主指标：**日 API 调用量**、**注册 API key 数**
- 辅助指标：SDK 下载量、MCP 目录点击量
- 不看：页面 UV（虚荣指标）

### 第一优先级：本周可执行

| 行动 | 预期效果 | 投入 |
|------|---------|------|
| 注册到 Smithery / glama.ai / mcp.so | 被 MCP 生态用户发现 | 半天 |
| 首页加 live demo 输入框（零摩擦试用） | 降低体验门槛，提高转化 | 1 天 |
| 改 Landing page 定位文案 | 让访客秒懂产品 | 2 小时 |

### 第二优先级：2 周内

| 行动 | 预期效果 | 投入 |
|------|---------|------|
| 写 Show HN 帖子 | 开发者社区曝光 | 半天 |
| LangChain 集成 demo（blog/gist） | 展示 10 行代码接入 | 1-2 天 |
| 发布 `@disvr/sdk` npm 包 | 降低接入成本 | 1-2 天 |

### 第三优先级：1-3 个月内

| 行动 | 预期效果 | 投入 |
|------|---------|------|
| Python SDK `disvr-py` | 覆盖 Python 生态 | 2-3 天 |
| 向 LangChain/LlamaIndex 提交集成 PR | 成为默认 provider | 1 周 |
| 技术博客："为什么 Agent 需要服务发现" | SEO + 思想领导力 | 2-3 天 |
| 扩展爬虫（OpenAI Actions、RapidAPI） | 建立数据壁垒 | 1-2 周 |

### 暂缓

- Reddit/Discord 社区发帖 — ROI 低，容易被当广告删
- 视频内容 — 开发者看代码，不看视频
- 付费广告 — 现阶段没必要

### 口碑飞轮（中期自动增长）

被索引的服务方会主动传播："我们的 API 已被 Disvr 收录" — 这是零成本的供给侧传播。前提是被收录本身有价值（意味着我们的 Agent 用户量要先起来）。

---

## 五、商业模式

### 收费时机

**原则：先免费拿量，数据飞轮转起来再收费。**

| 阶段 | 策略 | 触发条件 |
|------|------|---------|
| 当前 | 完全免费（1,000 req/天） | — |
| PMF 验证期 | 继续免费，收集重度用户画像 | 日活 API key > 100 |
| 初步收费 | Free 保持，Pro 付费上线 | 有用户主动问能不能付费 |
| 规模化 | 供给侧收费（竞价排名/推荐位） | 索引服务 > 1,000 |

### 收入模型候选

| 模式 | 说明 | 适用阶段 |
|------|------|---------|
| Freemium SaaS | Free 保持 / Pro: 更高 rate limit + 优先排名 + 私有索引 | PMF 后 |
| 供给侧收费 | 服务提供方付费获得更高曝光，类似 Google Ads | 规模化后 |
| 企业私有部署 | 金融/医疗行业 Agent 不能用公有服务发现 | 有企业需求时 |
| 数据产品 | Agent 工具使用趋势报告，卖给 VC / 工具厂商 | 数据量足够时 |

### 关于融资

- 如果走 VC 路线，先跑 3 个月免费期积累 traction 数据（日调用量、增长曲线、留存）
- 种子轮故事："Agent 经济的基础设施"
- 对标："Stripe for Agent payments" 或 "npm for Agent tools"
- 融资是加速器，不是替代品 — 先验证 PMF 再拿钱

---

## 六、行动优先级总览

```
紧急 ────────────────────────────────────────── 不紧急
  │                                                │
  │  [P0] Landing 定位文案                          │
  │  [P0] 首页 live demo                           │
  │  [P0] 注册 MCP 目录 ×3                         │
  │                                                │
  │  [P1] Show HN 帖子                             │
  │  [P1] npm SDK                                  │
  │  [P1] LangChain demo                           │
  │                                                │
  │  [P2] 多数据源爬虫                              │
  │  [P2] Python SDK                               │
  │  [P2] 框架集成 PR                               │
  │                                                │
  │  [P3] 开放协议 ASDP                             │
  │  [P3] 企业版                                    │
  │  [P3] 数据产品                                  │
  │                                                │
```

---

*本文档为 Disvr 商业化策略 v1，随执行进展持续更新。*
