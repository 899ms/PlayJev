# PlayJev

可视化构建 [Jev](https://docs.typesafe.ai/introduction)（TypeSafe System One 模型）的 API 输入：
编排 `state` + 类型化问题（Choice / Score / Noul），实时预览请求 JSON、前置校验、
发送并**以可视化卡片查看响应**，还能用任意 LLM 从一段描述生成草稿。

> 设计文档：[DESIGN.md](./DESIGN.md) · 文档镜像：[docs/jev/](./docs/jev/README.md)

## 预览

| 桌面端 | 移动端 |
| --- | --- |
| ![桌面端总览](docs/images/screenshot-desktop.png) | ![移动端构建页](docs/images/screenshot-mobile-build.png) |
| ![首启引导向导](docs/images/screenshot-oobe.png) | ![移动端结果卡片](docs/images/screenshot-mobile-result.png) |

## 功能

- **双栏 IDE**：左栏构建请求（状态：纯文本 / 可视化树 / JSON；问题：构建器 ⇄ JSON），右栏看结果（可视化卡片 ⇄ JSON）
- **Playground**：填入 Jev API Key 即可发送，请求固定走同源内置反代（自动绕过浏览器 CORS），429/529 自动退避重试
- **AI 生成向导**：一段描述 → 澄清选择题（含手动输入）→ 生成完整草稿 → 应用到编辑器 / 一键复制 Schema 给 Agent
- **多语言**：简体中文 / 繁體中文 / English / 日本語 / Deutsch / Français
- **开箱即用**：预设模板、撤回恢复、静默持久化、导入导出、首启引导，桌面与移动端自适应布局

## 快速开始

```bash
npm install          # 首次安装
npm run dev          # 本地开发 → http://localhost:5173
npm start            # 单进程服务 → http://localhost:8787
npm test             # 单测
npm run build        # 生产构建 → apps/web/dist
```

发送真实请求：设置 → Jev API 填入 API key（[console.typesafe.ai](https://console.typesafe.ai/keys) 获取），保存后直接点发送即可。

## 部署

```bash
docker compose up -d --build
# 打开 http://localhost:10010（端口可用 PLAYJEV_PORT 覆盖）
```

所有网络请求固定走同源反代（`/api/jev/systemone`、`/api/llm`），无需手动配置。
Cloudflare 部署同样零配置：Workers 用 `npx wrangler deploy`，Pages 构建输出 `apps/web/dist` 即可（`functions/api/*` 自动成为反代）。
纯静态托管（Vercel / GitHub Pages）无反代，发送功能不可用，详见 [DESIGN.md](./DESIGN.md)。

## 致谢

- [TypeSafe AI](https://typesafe.ai) —— Jev 模型与官方文档
- [LinuxDo](https://linux.do) 社区 —— 项目灵感与早期反馈
