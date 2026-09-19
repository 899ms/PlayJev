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
- **Playground**:设置里配置 Jev API(key、**模型**、endpoint、本地代理),429/529 自动退避重试;
  无 key 时可用演示模式(mock)
- **AI 生成向导**:配置任意 LLM(OpenAI 兼容 / Anthropic,预设 GLM、DeepSeek、Kimi 等),
  一段描述 → LLM 给澄清选择题 → 生成完整草稿 → 应用到编辑器
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
包含两个服务:`web`(nginx 托管静态构建)与 `proxy`(转发 Jev / LLM API,规避 CORS)。
容器内已同源代理——首次引导里配好密钥即可;若手动配置,请在 设置 → Jev API / LLM API
勾选「通过本地代理发送」并把代理地址**留空**(同源 `/api/*` 由 nginx 转发到 proxy 服务)。

### 部署到静态托管

构建产物是纯静态 SPA,可直接部署到任意静态托管(Cloudflare Pages / Vercel / GitHub Pages 等):
构建命令 `npm run build`,输出目录 `apps/web/dist`。演示模式无需任何后端;
真实 API 调用需要处理 CORS(勾选应用内的代理走 `server/proxy.mjs`,或使用 Docker 部署)。

## 快速开始(本地开发)

```bash
npm install          # 首次安装
npm run dev          # Web 应用 → http://localhost:5173
npm run proxy        # 可选:本地代理(绕过浏览器 CORS)→ http://localhost:8787
npm test             # vitest 单测
npm run build        # 生产构建
```

- 发送真实请求:设置 → Jev API 填入 API key(或在 [console.typesafe.ai](https://console.typesafe.ai/keys) 获取);
  浏览器 CORS 受限时打开「通过本地代理发送」并保持 `npm run proxy` 运行。
- AI 生成:设置 → LLM API 选择预设(如智谱 GLM)并填 key;不开 key 可用演示模式体验完整流程。

## Monorepo 结构

```
packages/core/    @playjev/core — 平台无关逻辑(类型/zod/serialize/lint/token 估算/
                  statetree/模板/i18n/LLM 客户端/Jev 客户端/store 工厂),零 DOM 依赖
apps/web/         @playjev/web — Vite + React + Tailwind 全功能 Web 端(P0)
apps/mobile/      Expo 移动端(P2,复用 core)
apps/desktop/     Tauri 桌面壳(P2)
server/proxy.mjs  零依赖本地代理:转发 /api/jev/* 与 /api/llm/*(按 x-llm-target)
docs/jev/         TypeSafe 官方文档 Markdown 镜像(2026-09 抓取)
```

多端路线:core 通过 `platform/` 接口注入 storage/clipboard;fetch 三端原生可用,
移动端无 CORS 不需代理。详见 DESIGN.md 路线图。

## 测试

```bash
npx vitest run    # 44 个用例:serialize 往返、lint 每条规则、token 边界、
                  # 模板序列化与文档示例一致、LLM JSON 提取/重试、mock 响应
```
