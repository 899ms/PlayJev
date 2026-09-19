# PlayJev 设计方案

> 可视化构建 Jev 的输入:用图形界面编排 `state` + `questions`,实时生成、校验、导出 TypeSafe System One API 请求。
>
> 依据文档: docs/jev/(TypeSafe AI 官方文档镜像,2026-09 抓取)。所有设计决策均在括号中标注文档出处。

---

## 1. 定位

Jev 的输入是一个结构化 JSON:`{ state, model, questions }`,其中 questions 是一个
`map<id, Question>`,每个 Question 由 `type`(choice / score / noul)、`instructions`、
`criteria` 组成(api.md)。手写这个 JSON 有三个痛点,PlayJev 逐一对付:

| 手写痛点 | PlayJev 对策 |
| --- | --- |
| questions 是嵌套 JSON,字段形态随 type 变化(criteria 在 choice 里是 map、在 score 里是有序数组、在 noul 里是 true/false 对象) | 三种问题类型各有专属的可视化编辑器,字段形态不可能写错 |
| 文档要求 instructions 里用 `` `ticket.messages[0].text` `` 这种点路径引用 state 字段(primitives.md "Reference specific fields") | 路径引用助手:浏览 state 树,点击即插入反引号路径 |
| 校验只能靠 422 报错回传(api.md) | 前置 lint:ID 重复、score 少于 2 级、token 预算超限等,发送前全部拦截 |

一句话:**PlayJev 是 Jev 输入的 IDE** —— 左边搭 state,中间搭问题,右边实时看请求 JSON 和代码。

## 2. 领域模型

与 API schema 一一对应,不引入多余抽象:

```ts
// 对应文档 EntryType(primitives/advanced.md):字符串、对象、数组或 null
type EntryValue = string | EntryValue[] | { [key: string]: EntryValue } | null;

interface ChoiceOption { key: string; description: EntryValue }   // choice.criteria 的 map 条目,值可为 null(api.md)
interface QuestionDef {
  id: string;                                // 问题的 key,回答按同名 id 返回(api.md)
  type: "choice" | "score" | "noul";
  instructions: EntryValue;                  // 必填;P0 限定 string,P1 支持结构化
  criteria:
    | { kind: "choice"; options: ChoiceOption[] }      // 有序数组,导出时转 map
    | { kind: "score";  levels: EntryValue[] }         // ≥ 2 级,顺序即 0..n-1(api.md)
    | { kind: "noul";   trueDesc?: EntryValue; falseDesc?: EntryValue };  // 可选(api.md)
}
interface JevProject {
  version: 1;
  name: string;
  model: string;                             // "jev-latest" | "jev-preview" | "jev-1.13.0" | 自定义(models.md)
  state: string | EntryValue;                // string | object | array(concepts/state.md)
  questions: QuestionDef[];                  // UI 内有序,发送/导出时转 map
}
```

`questions` 在 API 里是 map,但在 UI 里必须保序(问题卡片的展示顺序),因此内部用数组,
序列化时转 map —— JSON 对象键序保留,与 API 语义一致。

## 3. 界面布局

三栏 IDE 式布局,顶部全局操作,底部响应区(发送后展开):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ PlayJev   [项目: 工单分流 ▾]  model: [jev-latest ▾]  ▓▓▓░░ 2.1k/32k tok   │
│                         [导入] [导出 .json] [复制请求] [▶ 发送]          │
├──────────────────────┬──────────────────────────┬────────────────────────┤
│ ① 状态 State         │ ② 问题 Questions         │ ③ 预览 Preview         │
│ [纯文本|JSON源码|树] │ [+ 添加问题 ▾]           │ [请求|cURL|Python|TS]  │
│                      │ ┌──────────────────────┐ │ ┌────────────────────┐ │
│ ticket               │ │ is_urgent   [noul] ⚙ │ │ │ {                  │ │
│  ├ subject           │ ├──────────────────────┤ │ │  "state": {…},     │ │
│  ├ messages[]        │ │ department [choice]⚙ │ │ │  "model": "…",     │ │
│  └ order.charges[]   │ ├──────────────────────┤ │ │  "questions": {…}  │ │
│ (点击节点→复制路径)  │ │ frustration [score]⚙ │ │ │ }                  │ │
│                      │ └──────────────────────┘ │ └────────────────────┘ │
├──────────────────────┴──────────────────────────┴────────────────────────┤
│ ④ 响应区(发送后展开)                                                    │
│ is_urgent   ████████░░ 0.92   |  department ●billing .84 ▂technical .15  │
│ frustration  1.6 (0──●──1──█──2) conf .78 ●高 | usage: 312 in / 48 out   │
└──────────────────────────────────────────────────────────────────────────┘
```

设计原则:**每栏一个心智负担**。左栏只关心"给模型看什么",中栏只关心"问什么",
右栏是所写即所得的产物(请求 JSON / 可运行代码)。

## 4. 功能模块

### 4.1 State 编辑器(左栏)

三种模式切换,对应 state 的三种合法形态(state.md:字符串/对象/数组):

- **纯文本**:textarea,适合简单场景(state.md: "A message, article, or passage")。
- **JSON 源码**:带实时校验的编辑器(P0 用 textarea + JSON.parse 校验,P1 换 CodeMirror),
  支持整段粘贴已有 JSON。给出推荐:对象优于字符串,每个字段有描述性命名(state.md)。
- **树视图**:只读浏览 + 每个节点一键复制路径(供 4.3 使用)。P1 升级为可视化增删改。

粘贴/导入 JSON 超过预算(见 4.4)时在顶栏 token 条变红提示,不阻塞编辑。

### 4.2 Question 编辑器(中栏)

问题卡片列表,每张卡片:

- **ID**:自动生成 slug(如 `is_urgent`),可改;不发送给模型,只做返回 key
  (primitives.md Tip)。
- **类型**:三段切换 choice / score / noul,切换时 criteria 编辑器随之替换。
- **instructions**:多行文本 + 工具栏按钮「插入路径」「插入结构化片段」。
- **criteria 编辑器(按类型)**:
  - Choice:选项行列表(键 + 描述),描述可留空(null,api.md),可拖拽排序;
    空列表校验报错,并提示"列表可能不全时加 `other` 选项"(primitives.md)。
  - Score:等级列表,自动编号 0..n-1,拖拽排序,最少 2 级(硬校验,api.md);
    文档建议等级描述写清每级含义。
  - Noul:默认折叠的高级区,两个可选输入框「yes 表示…」「no 表示…」
    (criteria.true/false,api.md);提示 0.5 表示"无法判定"而非中等程度(primitives.md Note)。
- **结构化模式(P1)**:每个字段可切换"文本 ↔ JSON"。对应 EntryType 支持:
  instructions 可传对象/数组(primitives/advanced.md 的 invoice 示例);
  choice 选项描述可传对象(what/not_for/examples 边界澄清);score 等级可传
  `{summary, signals}`;noul 的 true/false 同理。模板库预置这些形状。

卡片支持复制(文档鼓励"投机性问题":多问不亏,parallel_questions cookbook 显示
13 问合一比 13 次单独调用便宜 11.5 倍、快 9.6 倍)。

### 4.3 路径引用助手

instructions 编辑器工具栏「插入路径」→ 弹出 state 树 → 点击节点 → 在光标处插入
`` `ticket.messages[0].text` ``(带反引号)。这是文档明确推荐的写法
(primitives.md "Reference specific fields"),也是手写时最容易出错的地方。

反向 lint(见 4.4):扫描 instructions 中所有 `` `path` ``,若路径在 state 树中不存在
则黄色警告。

### 4.4 校验与提示(实时 lint)

发送前全部可见,对应 422 类错误(api.md)与文档最佳实践:

| 级别 | 规则 | 出处 |
| --- | --- | --- |
| 错误(红) | questions 为空;ID 空或重复;instructions 为空;score 等级 < 2;model 为空 | api.md |
| 错误(红) | JSON state 解析失败;choice criteria 为空 | api.md |
| 警告(黄) | instructions 中反引号路径在 state 中不存在 | primitives.md |
| 警告(黄) | instructions 过短(疑似只写了问题 ID 没写完整问题) | primitives.md Tip |
| 警告(黄) | 估算 token 超过 state+最长问题 32k / 总预算 64k | models.md |
| 提示(蓝) | 检测到中文/CJK:文档说明非英文精度较低,建议自测并关注 confidence | models.md Language support |

token 估算用启发式(英文 ≈ 4 字符/-token,CJK ≈ 1 字符/token),顶栏进度条显示
"估算值,非精确"。

### 4.5 预览与代码导出(右栏)

四个标签页,全部从 `JevProject` 实时生成:

1. **请求** — 最终 `POST /v1/systemone` body(JSON),这是唯一真源,导出以它为准。
2. **cURL** — heredoc 形式,与 quickstart.md 示例一致。
3. **Python** — 用 `typesafe_sdk` 的 `Choice/Score/Noul` 类写法(quickstart.md "Code it")。
4. **TypeScript** — 用 `@typesafe-ai/sdk` 写法。

一键复制。生成的代码可直接运行,只差 API key 环境变量(`TYPESAFE_API_KEY`)。

### 4.6 Playground(发送与响应可视化)

- **发送配置**:API key 存 localStorage(默认掩码,不上传);请求固定走同源内置反代
  `POST /api/jev/systemone`(上游 `https://api.typesafe.ai/v1/systemone`),无任何可切换项。
- **CORS 对策**:不直连——同源反代由三种宿主挂载:Vite 开发插件(`npm run dev`)、
  单进程 Bun 服务(`npm start`/`server/proxy.mjs`,同时托管静态构建;Docker 单容器直跑)、
  Cloudflare(`server/worker.ts` + `functions/api/`)。直连/自定义代理分支已删除。
- **响应可视化**(对应 api.md Answer types 与 confidence.md 三区间模式):
  - Noul:0–1 水平概率条,标出落点;0.5 附近显示"不确定"。
  - Choice:胜出项高亮 + 每个选项的概率条形图 + confidence 徽章。
  - Score:等级刻度尺(0..n-1)上标出加权 score(可落在两级之间)+ 每级概率分布。
  - confidence 徽章按文档三区间着色:高=自动执行 / 中=谨慎复核 / 低=转人工;
    阈值在设置里可调,默认 0.9 / 0.5(confidence.md 示例)。
- **请求历史**:每个项目保留最近 N 次运行(state、请求、响应、usage),可对比两次
  运行的答案差异 —— 调 criteria 时必用。
- **无演示模式**:演示/mock 相关代码已删除;未配 key 时发送按钮给出明确的缺 key 提示,不返回假数据。

### 4.7 模板库

从文档示例移植的起步模板,新建项目时可选:

| 模板 | 来源 |
| --- | --- |
| 工单分流(choice + score + noul 三件套) | quickstart.md / primitives.md |
| 发票字段抽取(noul + choice + score 结构化 instructions) | primitives/advanced.md |
| 选项边界澄清(choice 选项带 what/not_for/examples) | primitives/advanced.md |
| 钓鱼邮件检测(noul + 结构化 true/false criteria) | primitives/advanced.md |
| PR 聚焦度评分(score 等级带 signals) | primitives/advanced.md |

## 5. 技术选型

纯前端单页应用,网络层固定走同源反代(各宿主内置,前端零配置):

| 层 | 选择 | 理由 |
| --- | --- | --- |
| 构建 | Vite + React 18 + TypeScript | 标准化、快,monorepo 不必要,单包即可 |
| 样式 | Tailwind CSS + shadcn/ui | 三栏 IDE 布局和表单密集型 UI 的成熟解 |
| 状态 | Zustand + persist 中间件 | 单 store(JevProject + UI 态),localStorage 自动持久化 |
| 校验 | zod(schema)+ 自写 lint 规则 | zod 管 shape,lint 管语义(路径存在性、token 预算) |
| 拖拽 | dnd-kit(P1) | choice 选项 / score 等级排序 |
| 编辑器 | P0 textarea;P1 换 CodeMirror 6(JSON 高亮+校验) | P0 控制依赖 |
| 树组件 | 自写(P0 只读)+ 增删改(P1) | state 树操作逻辑需与路径生成强耦合,自写更稳 |

不选桌面框架(Tauri/Electron):目标用户在开发流程中使用,浏览器 + 同源反代足够,
本地 `npm start` 单进程点开即用,线上用 Cloudflare 部署。

## 6. 持久化与项目文件

- 自动保存:每次编辑写入 localStorage(key: `playjev.projects`),刷新不丢。
- 多项目:顶栏项目切换器;P0 单激活项目 + 模板,P2 做项目管理页。
- `.json` 项目文件(即 `JevProject`):导入/导出,可进 git 版本管理 ——
  这是团队共享问题编排的方式。

## 7. 路线图

> 2026-09-19 更新:规划经评审后调整 —— P0 扩为「编辑器 + Playground + AI 生成向导 + 多语言」,
> 架构改为 monorepo(`packages/core` 平台无关 + `apps/web`),为多端(iOS/Android/桌面)预留。
> 布局后来按用户要求改为**双栏 IDE**:左栏构建请求(构建器 ⇄ JSON 两标签)、右栏展示结果(可视化 ⇄ JSON 两标签),
> 替代原三栏 + 底部响应抽屉方案。下表为实际交付情况与后续计划。

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| **P0(已交付)** | monorepo 脚手架;core 包(types/zod/serialize/双格式导入/lint 全规则/CJK token 估算/statetree 含可视化编辑 ops/模板/i18n 中英 + 繁日/LLM 客户端(三协议:chat/responses/anthropic)/Jev 客户端/store 工厂);Web 端:State 三模式(**树模式为完整可视化编辑器**)、三种问题编辑器、请求实时预览、Playground(双 API 设置/key+模型/固定同源反代/退避重试/答案可视化卡片)、AI 生成向导(描述→澄清选择题+手动输入→草稿→应用/复制 Schema 给 Agent)、导入/导出 | ✅ 2026-09-19,vitest 全绿 + 浏览器全流程走查通过 |
| **P1 提效** | instructions 内插入路径助手;EntryType 结构化编辑(含发票抽取等结构化模板);cURL/Python/TS 代码导出;dnd-kit 拖拽排序;CodeMirror 6;运行历史与对比;语言切换入口进顶栏 | 待开工(树可视化编辑已随 P0 提前交付) |
| **P2 多端与生态** | apps/mobile(Expo + react-native-reusables,复用 core);apps/desktop(Tauri 壳);cookbooks 模板扩充;多项目管理;分享链接(URL 压缩编码);置信度阈值助手 | 待开工 |

## 8. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 浏览器直连 API 可能被 CORS 拦 | 不直连:所有流量固定走同源反代,四种宿主(Vite/单进程/docker/CF)全覆盖 |
| token 估算不准 | 明确标注"估算";以响应 `usage.input_tokens` 回填历史记录校准 |
| questions map 键序在导出转 map 时依赖 JSON 序列化顺序 | TS 规范保证 string 键按插入序;导出测试断言键序 |
| 官方 API schema 演进(version/新字段) | `JevProject.version` 字段 + 导入迁移函数;zod 宽进严出 |
| 非英文(CJK)精度低 | lint 提示 + confidence 三区间默认更保守 |
