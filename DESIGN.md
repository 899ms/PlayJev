# PlayJev 设计方案

> 可视化构建 Jev 的输入：用图形界面编排 `state` + `questions`，实时生成、校验、调试并以卡片化形式呈现 TypeSafe System One API 响应。
>
> 依据文档：[docs/jev/](./docs/jev/README.md)（TypeSafe AI 官方文档镜像）。所有设计决策均严格遵循官方规范。

---

## 1. 定位

Jev（TypeSafe System One）的核心接口为 `POST /v1/systemone`，请求体为结构化 JSON：`{ state, model, questions }`。其中 `questions` 为 `map<id, Question>`，每个问题包含 `type`（choice / score / noul）、`instructions` 与类型专属的 `criteria`。

手写该请求存在三个主要痛点：

| 手写痛点 | PlayJev 解决方案 |
| --- | --- |
| 嵌套 JSON 结构复杂，字段形态随类型剧烈变化（choice 为 map、score 为有序数组、noul 为可选布尔说明） | 提供专用的可视化卡片与校验机制，杜绝结构性拼写错误 |
| 官方推荐在 instructions 中使用 \`ticket.messages[0].text\` 等反引号点路径引用 state 字段 | 状态树支持一键复制标准点路径，结合反向 Lint 校验避免路径失效 |
| 语法与语义错误通常只能依赖 API 返回的 422 报错排查 | 内置前置 Lint 引擎（ID 重复、等级缺失、Token 预算等），在发送前全面拦截 |

**一句话定位：PlayJev 是 Jev 输入构建与调试的专用 IDE** —— 左栏构建请求（状态与问题），右栏实时查看可视化评估结果。

---

## 2. 领域模型

与 TypeSafe 官方 API Schema 一致，不引入多余中间抽象：

```ts
// 对应官方 EntryType：字符串、对象、数组或 null
type EntryValue = string | EntryValue[] | { [key: string]: EntryValue } | null;

interface ChoiceOption {
  key: string;
  description: EntryValue; // choice.criteria 条目，描述可为 null
}

interface QuestionDef {
  id: string; // 问题唯一标识，API 响应以此为 key 返回
  type: "choice" | "score" | "noul";
  instructions: EntryValue; // 判定指令（支持字符串或结构化说明）
  criteria:
    | { kind: "choice"; options: ChoiceOption[] }
    | { kind: "score"; levels: EntryValue[] } // 2–10 级，按 0..n-1 排序
    | { kind: "noul"; trueDesc?: EntryValue; falseDesc?: EntryValue };
}

interface JevProject {
  version: 1;
  name: string;
  model: string; // 目标评估模型（如 jev-latest）
  state: string | EntryValue; // 评估主体数据（文本 / 对象 / 数组）
  questions: QuestionDef[]; // 内部以有序数组维护，序列化时转为 API map
}
```

UI 内部采用数组维护问题顺序以支持直观调整，发送与序列化时按插入顺序转为标准 Map 结构。

---

## 3. 界面架构与布局

采用**可收起侧栏 + 双栏 IDE** 架构，并针对桌面与移动端进行全响应式适配：

### 3.1 桌面端布局

```
┌─────────┬─────────────────────────────────────────────────────────────────┐
│ 侧边栏  │ 顶栏: 品牌 · 撤回/重做 · Token仪表盘 · 校验徽章 · AI生成 · 导出/设置 │
│ [收起]  ├────────────────────────────────┬────────────────────────────────┤
│         │ 左栏: 请求构建器 (Request IDE) │ 右栏: 结果展示区 (Response)    │
│ +新建   │                                │                                │
│         │ 1. 状态 (State)                │ 模式: [可视化卡片 | 原始 JSON] │
│ 预设    │    模式: [纯文本 | 树形 | JSON]│                                │
│ 模板(6) │    - 树形支持跨层级移动/增删改 │ Choice: 胜出选项 + 概率条形图  │
│         │ 2. 问题 (Questions)            │ Score:  加权数值游标 + 刻度分布│
│ 保存    │    模式: [卡片构建器 | JSON源码]│ Noul:   0–1 概率条 + 区间着色  │
│ 项目    │    - Choice / Score / Noul     │ 置信度: 高(自动)/中(复核)/低(人工)│
└─────────┴────────────────────────────────┴────────────────────────────────┘
```

### 3.2 移动端流式布局

在窄屏视口（< 1024px）下自适应转换为两级清晰导航：
1. **项目列表页**：全宽呈现新建按钮、预设模板与保存项目；
2. **详情编辑页**：左上角返回列表，底部标签栏在「构建」与「结果」子页面间切换。

---

## 4. 核心功能设计

### 4.1 状态编辑器 (State Pane)

支持 Jev API 允许的三种状态形态：
- **纯文本模式**：适合文章、客服留言、日志等无结构文本；
- **可视化树模式**：递归解析为不可变 AST，支持字段名/值/类型内联修改、就地增删、同层排序、跨层级嵌套与平铺移动，提供节点路径一键复制；
- **JSON 源码模式**：直接编辑 JSON 源码，带语法实时校验与错误提示，与树模式双向即时同步。

### 4.2 问题编辑器 (Question Builder)

支持三种标准原语卡片：
- **Choice（单项选择）**：编辑选项 Key 与语义描述，智能提示补充 `other` 兜底项；
- **Score（多级评分）**：2–10 级严格校验，强制描述具体情境，禁止无语义纯数字等级；
- **Noul（是/否概率）**：评估陈述成立的后验概率（0–1），支持折叠定义 true/false 边界语义；
- **问题 JSON 模式**：支持一键切换到底层 JSON 视图，直接批量编辑问题对象。

### 4.3 校验与 Lint 引擎

在客户端执行实时静态检查，提前拦截潜在错误：
- **错误级别**：问题列表为空、ID 缺失或重复、Score 等级少于 2 级、字段名为空或重名；
- **警告级别**：instructions 中引用的反引号路径在 state 中不存在、说明过短、Token 超限；
- **提示级别**：检测到中文/CJK 内容时提示关注置信度指标。

### 4.4 结果卡片可视化 (Response Cards)

避免单纯呈现无序的裸 JSON，默认以专业可视化表达全部维度：
- **Choice 卡片**：胜出选项大字高亮，全选项按概率降序呈现水平动态条形图，附带置信度区间徽章；
- **Score 卡片**：在 0..n-1 刻度尺上绘制加权 Score 落点游标与各级概率分布；
- **Noul 卡片**：展示 0–1 水平概率条，三段区间着色（强否 / 不确定 / 强是）；
- **置信度路由**：根据官方三区间标准（高置信自动执行、中置信谨慎复核、低置信转人工）动态着色，阈值可在设置中自定义调整；
- **调试面板**：每张卡片底部提供折叠的原始响应 JSON 查看入口。

### 4.5 AI 生成向导 (AI Wizard)

采用分步澄清与自动化生成流水线：
1. **自然语言描述**：输入业务场景目标，可选择结合当前项目草稿迭代；
2. **结构化澄清**：AI 提出 2–4 个关于请求结构（类型选型、状态形状、选项范围）的选择题，支持点选及手动自定义文本输入；
3. **草稿产出与复用**：生成规范 Jev 请求体并渲染预览，支持一键替换应用到当前编辑器，或一键复制标准 Schema 供 Coding Agent 使用。

### 4.6 网络层与同源反向代理

TypeSafe 官方 API 网关限制直接浏览器 CORS。PlayJev 采取网络层架构解耦，所有请求均固定走同源反向代理：
- **Jev 评估请求**：固定发往 `/api/jev/systemone`，支持通过 `x-jev-target` 请求头自定义上游地址（默认为官方端点）；
- **LLM 文本生成**：固定发往 `/api/llm`，由反代服务根据 `x-llm-target` 转发至对应大模型提供商（支持 OpenAI Chat、OpenAI Responses 与 Anthropic 三种协议）；
- **多宿主同源支持**：
  1. *Vite 开发环境*：内置中间件直接拦截代理；
  2. *本地/服务器*：`server/proxy.mjs` 单进程同时托管静态页面与反代服务（`npm start` 点开即用）；
  3. *Docker 容器*：单 Bun 容器一键部署，统一暴露服务端口；
  4. *Cloudflare*：通过 Workers（`server/worker.ts`）或 Pages（`functions/api/*`）无服务器边缘部署。

---

## 5. 工程与技术选型

遵循平台无关核心与表现层解耦原则：

| 层次 | 选型 | 考量与设计 |
| --- | --- | --- |
| 仓库架构 | npm workspaces Monorepo | `packages/core`（纯逻辑，零 DOM 依赖）+ `apps/web`（Web 端），为后续多端复用解耦 |
| 视图框架 | React 18 + TypeScript | 严格类型系统保障复杂的嵌套树状态变异安全 |
| 样式与组件 | Tailwind CSS + Radix UI | 无障碍键盘导航、纯净的原语级弹出与交互控制 |
| 状态管理 | Zustand + 自定义 Persist | 平台无关 Store 工厂，支持依赖注入存储适配器，静默持久化工作区 |
| 运行环境 | Node.js / Bun | 零外部依赖轻量原生 HTTP 反代，单进程开箱即用 |

---

## 6. 路线图与演进规划

| 阶段 | 核心目标 | 状态 |
| --- | --- | --- |
| **P0 (当前交付)** | Monorepo 核心架构、双栏 IDE、树结构不可变编辑器、三类问题编辑器、响应卡片可视化、同源反向代理、首启向导、六语言本地化、单进程/Docker/Cloudflare 部署 | ✅ 已交付 |
| **P1 (效能拓展)** | 字段插入辅助弹窗、结构化 EntryType 深入编辑、cURL/Python/TypeScript 代码导出、多轮评估运行历史与快照对比 | 规划中 |
| **P2 (多端生态)** | 基于 `@playjev/core` 的移动端 App（React Native / Expo）与桌面原生端（Tauri）适配 | 规划中 |
