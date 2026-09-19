# PlayJev

可视化构建 [Jev](https://docs.typesafe.ai/introduction)(TypeSafe System One 模型)的 API 输入:
编排 `state` + 类型化问题(Choice / Score / Noul),实时预览请求 JSON、前置校验、
发送并**以可视化卡片查看响应**,还能用任意 LLM 从一段描述生成草稿。

> 设计文档:[DESIGN.md](./DESIGN.md) · 文档镜像:[docs/jev/](./docs/jev/README.md)

## 预览

| 桌面端 | 移动端 |
| --- | --- |
| ![桌面端总览:构建请求并查看可视化结果](docs/images/screenshot-desktop.png) | ![移动端构建页](docs/images/screenshot-mobile-build.png) |
| 首启引导(四语言可选) | 移动端结果卡片 |
| ![首启引导向导](docs/images/screenshot-oobe.png) | ![移动端结果卡片](docs/images/screenshot-mobile-result.png) |

## 功能(P0)

- **双栏布局**:左栏构建请求、右栏展示结果;**状态与问题分开构建**
  - 状态:纯文本 / 可视化树(键值类型内联编辑、增删排序、根形态转换)/ JSON 三种方式
  - 问题:下拉菜单添加 Choice/Score/Noul;**构建器**(可视化卡片)⇄ **JSON**(直接编辑问题 JSON,合法更改实时写回)两种方式
  - 右栏结果:**可视化卡片**(Choice 概率条形图、Score 刻度尺落点、Noul 0–1 概率条、置信度三区间徽章)⇄ **JSON**(原始响应)
- **可收起侧栏**:统一列表 = 预设模板(6 个:工单分流、电商客服、Bug 复合评分、退款判定、邮件意图路由、简历初筛;**内容含简体/繁體/英文三语版本**;仅作示例,可删除)+ 已保存项目(构建 + 结果快照);
  **右键条目可重命名或删除**(重命名即时持久化,删除模板后不再显示)
- **存储**:当前构建、视图与最近结果**静默自动持久化**到浏览器存储(每次编辑即写,刷新/崩溃不丢,列表无任何可见变化);顶栏「保存」= 手动创建命名快照(最多 50 份,侧栏管理)
- **撤回 / 恢复**:顶栏按钮 + `Ctrl+Z` / `Ctrl+Y`(输入框内不拦截),50 步历史、500ms 内连续编辑合并为一步
- **首启引导(OOBE)**:三步向导——①语言选择(语言中立界面,2×2 原生文字大按钮,选中后整站实时切换)②配置 Jev API(模型 + 密钥)③配置 LLM API(服务商预设自动带出协议/地址/模型,用于 AI 生成)。每步均可跳过稍后在设置中补;设置 → 一般可重新运行
- **响应式双布局**:桌面 = 侧栏 + 请求/结果双栏;**窄屏为两级页面**——项目列表页(点按模板或已保存项目进入)→ 详情页(左上角返回列表,底部标签栏在「构建 / 结果」间切换)
- **前置 lint**(红/黄/蓝三级):结构错误、文档最佳实践(如 Score 纯数字等级、
  反引号路径不存在、缺 other 兜底项、状态字段名空/重复)、CJK 精度提示;CJK 感知 token 估算(32k/64k 双预算)
- **Playground**:设置里配置 Jev API(key + **模型**),请求固定走同源内置反代
  (`/api/jev/systemone`,自动绕过 TypeSafe 浏览器 CORS),429/529 自动退避重试
- **AI 生成向导**:配置任意 LLM(OpenAI 兼容 / Responses / Anthropic,预设 GLM、DeepSeek、Kimi 等),
  同样固定走同源内置反代(`/api/llm`);一段描述 → LLM 给澄清选择题(含手动输入)
  → 生成完整草稿 → 应用到编辑器 / 一键复制 Schema 给 Agent
- **多语言**:简体中文 / 繁體中文 / English / 日本語 可切换(文案集中在 `packages/core/src/i18n/locales/`,
  新增语言只需加一个字典文件;模板内容按语言出简体/繁體/英文版本)
- 项目持久化(localStorage)、导入/导出 `.json`(在设置的「导入 / 导出」标签中;
  兼容 PlayJev 项目文件与原始 API 请求体两种格式)

## 一键部署(Docker + Bun)

```bash
docker compose up -d --build
# 打开 http://localhost:10010(端口可用 PLAYJEV_PORT 环境变量覆盖)
```

基于 Bun:构建阶段 `bun install && bun run build`,代理服务用 `bun server/proxy.mjs`。
包含两个服务:`web`(nginx 托管静态构建)与 `proxy`(内置转发 Jev / LLM API)。
所有网络请求固定走同源反代(`/api/jev/systemone`、`/api/llm`),不存在 CORS 问题,
无需任何手动代理配置——首次引导里配好密钥即可直接发送。

### 部署到 Cloudflare(推荐,零配置反代)

仓库已内置边缘反代(`server/worker.ts` + `functions/api/`),Cloudflare 上开箱即用:

- **Workers**:构建命令 `npm run build`,部署命令 `npx wrangler deploy`
  (`wrangler.toml` 已配好静态资源 + 反代路由)。
- **Pages**:构建命令 `npm run build`,输出目录 `apps/web/dist`,
  `functions/api/*` 自动成为同源反代。

### 部署到纯静态托管

构建产物是纯静态 SPA(`npm run build` → `apps/web/dist`),可直接部署到
Vercel / GitHub Pages 等。注意:纯静态托管没有同源反代,TypeSafe 官方 API 会拦截
浏览器直连(CORS),此时 Jev 发送与 AI 生成不可用;如需完整功能请使用
Cloudflare 或 Docker 部署。

## 快速开始(本地开发)

```bash
npm install          # 首次安装
npm run dev          # Web 应用(内置同源反代)→ http://localhost:5173
npm start            # 单进程:静态托管 + 内置反代 → http://localhost:8787
npm test             # vitest 单测
npm run build        # 生产构建
```

- 发送真实请求:设置 → Jev API 填入 API key(或在 [console.typesafe.ai](https://console.typesafe.ai/keys) 获取),
  保存后直接点发送即可,反代全自动无需配置。
- AI 生成:设置 → LLM API 选择预设(如智谱 GLM)并填 key;向导调用同样走同源反代。

## Monorepo 结构

```
packages/core/    @playjev/core — 平台无关逻辑(类型/zod/serialize/lint/token 估算/
                  statetree/模板/i18n/LLM 客户端/Jev 客户端/store 工厂),零 DOM 依赖
apps/web/         @playjev/web — Vite + React + Tailwind 全功能 Web 端(P0,
                  含 Vite 开发反代插件 + 同源 proxiedFetch 封装)
apps/mobile/      Expo 移动端(P2,复用 core)
apps/desktop/     Tauri 桌面壳(P2)
server/proxy.mjs  单进程服务:静态托管 apps/web/dist + 同源反代 /api/*(npm start 点开即用)
server/worker.ts  Cloudflare Workers 边缘反代(静态资源 + 同源 /api/*)
functions/api/    Cloudflare Pages 同源反代(jev/systemone.ts + llm.ts)
docs/jev/         TypeSafe 官方文档 Markdown 镜像(2026-09 抓取)
```

多端路线:core 通过 `platform/` 接口注入 storage/clipboard;fetch 三端原生可用,
移动端无 CORS 不需代理。详见 DESIGN.md 路线图。

## 测试

```bash
npx vitest run    # 44 个用例:serialize 往返、lint 每条规则、token 边界、
                  # 模板序列化与文档示例一致、LLM JSON 提取/重试、LLM 多协议解析
```
