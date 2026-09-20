<div align="center">

# PlayJev

**[Jev](https://docs.typesafe.ai/introduction)（TypeSafe System One 模型）API 输入的可视化 IDE**

编排 `state` + 类型化问题（Choice / Score / Noul），实时预览请求 JSON、
前置校验、发送——并以**可视化卡片**而非原始 JSON 阅读答案。
任意 LLM 都能用一句话为你起草整个请求。

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Docker Ready](https://img.shields.io/badge/docker-ready-blue.svg)](docker-compose.yml)
[![Cloudflare Workers](https://img.shields.io/badge/cloudflare-workers%20%7C%20pages-orange.svg)](wrangler.toml)
[![i18n](https://img.shields.io/badge/i18n-6%20locales-purple.svg)](#-功能)

[English](./README.md) · [快速开始](#-快速开始) · [部署](#-部署) · [设计](./DESIGN.md) · [文档镜像](./docs/jev/README.md)

</div>

---

## ✨ 预览

| 桌面端 | 移动端 |
| --- | --- |
| ![桌面端总览](docs/images/screenshot-desktop.png) | ![移动端构建页](docs/images/screenshot-mobile-build.png) |
| ![首启引导向导](docs/images/screenshot-oobe.png) | ![移动端结果卡片](docs/images/screenshot-mobile-result.png) |

## 🚀 功能

| 方向 | 内容 |
| --- | --- |
| 🖥️ 双栏 IDE | 左栏构建请求（状态：纯文本 / 可视化树 / JSON；问题：构建器 ⇄ JSON），右栏读结果（可视化卡片 ⇄ JSON） |
| 🧪 Playground | 填入 Jev API Key 点发送即可——流量固定走内置同源反代（无 CORS 烦恼），429/529 自动退避重试 |
| 🤖 AI 生成向导 | 一句话 → 澄清选择题（含手动输入）→ 完整草稿 → 应用到编辑器，或一键复制 Schema 给编程 Agent |
| 🌍 多语言 | 简体中文 / 繁體中文 / English / 日本語 / Deutsch / Français |
| 📦 开箱即用 | 预设模板、撤回恢复、静默持久化、导入导出、首启引导，桌面 + 移动自适应布局 |

## ⚡ 快速开始

```bash
npm install          # 首次安装
npm run dev          # 本地开发 → http://localhost:5173
npm start            # 单进程服务 → http://localhost:8787
npm test             # 单测
npm run build        # 生产构建 → apps/web/dist
```

在 [console.typesafe.ai](https://console.typesafe.ai/keys) 获取 Key，填到
设置 → Jev API，点发送即可——反代零配置。

## 🐳 部署

```bash
docker compose up -d --build
# 打开 http://localhost:10010（可用 PLAYJEV_PORT 覆盖）
```

| 目标 | 做法 | 内置反代 |
| --- | --- | --- |
| Docker Compose | `docker compose up -d --build` | ✅ 单 Bun 容器，零配置 |
| Cloudflare Workers | `npx wrangler deploy` | ✅ `server/worker.ts`（静态 + `/api/*`） |
| Cloudflare Pages | 构建 `npm run build`，输出 `apps/web/dist` | ✅ `functions/api/*` 自动挂载 |
| Node 单进程 | `npm run build && npm start` | ✅ `server/proxy.mjs` 内置 |
| 纯静态托管 | dist 可打开，但**发送不可用**（TypeSafe 拦截浏览器直连 CORS） | ❌ 请用以上任一方式 |

所有 API 请求均自动通过同源反向代理（`/api/jev/systemone` 与 `/api/llm`）转发，天然规避浏览器跨域限制。架构详见 [DESIGN.md](./DESIGN.md)。

## 🗺️ 项目结构

```
packages/core/    @playjev/core — 平台无关逻辑（类型、zod、lint、
                  token 估算、状态树操作、模板、i18n、LLM/Jev 客户端）
apps/web/         @playjev/web — Vite + React + Tailwind Web IDE（含开发反代插件）
server/proxy.mjs  单进程服务：托管 apps/web/dist + /api/* 反代
server/worker.ts  Cloudflare Workers 边缘反代（静态资源 + /api/*）
functions/api/    Cloudflare Pages 反代（jev/systemone.ts + llm.ts）
docs/jev/         TypeSafe 官方文档镜像（Markdown，2026-09 抓取）
```

移动端（Expo）与桌面端（Tauri）壳复用 `@playjev/core`——P2 规划见 [DESIGN.md](./DESIGN.md)。

## 🙏 致谢

- [TypeSafe AI](https://typesafe.ai) —— Jev 模型与优秀文档
- [LinuxDo](https://linux.do) 社区 —— 项目灵感与早期反馈
