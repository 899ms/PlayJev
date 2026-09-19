# Jev / TypeSafe AI 文档镜像

来源: https://docs.typesafe.ai (Mintlify 站点)
抓取日期: 2026-09-19
抓取方式: sitemap.xml 中的全部 109 个页面,逐页下载 `.md` 后缀的 Markdown 原文,按 URL 路径镜像存放。
另含 `llms.txt`(站点为 LLM 提供的完整文档索引)。

## 目录结构

| 本地路径 | 对应内容 |
| --- | --- |
| `introduction.md` / `introduction/` | Jev 介绍、Quick Start、AI Primer |
| `concepts/` | System One 概念、State、如何用 TypeSafe 构建、用例地图 |
| `primitives*.md` / `primitives/` | 三种问题类型 Choice / Score / Noul 及高级结构用法 |
| `confidence.md` | 置信度机制与阈值路由 |
| `patterns/` | 架构模式: fan-out、置信度路由、复合评分、意图路由 |
| `cookbooks/` | 19 个实战 cookbook(提取、分类、RAG 重排、守门、SDE cascade 等) |
| `demos/` | 示例(智能家居助手) |
| `sdk/` | Python 与 JavaScript SDK 使用说明、changelog、完整 API 参考 |
| `api.md` | HTTP API 参考 |
| `models.md` | 模型列表、价格、限额、别名、语言支持 |
| `agent-skill.md` | 给编码 agent 用的 TypeSafe skill |
| `model-jaggedness/` | Jev 1.13 精度随状态长度变化的特性 |

## 核心要点

- **Jev** 是 TypeSafe 的旗舰模型,也是首个 "System One" 模型:不做文本生成,
  而是 `state`(字符串/JSON 对象/数组)+ 一组带类型的问题 → 结构化、带概率的答案。
- 三种问题原语:**Choice**(从固定选项中选)、**Score**(沿自定义等级打分)、
  **Noul**(yes/no 概率,0–1)。同一请求内所有问题并行、独立评估,加问题几乎不增加延迟。
- API 端点: `POST https://api.typesafe.ai/v1/systemone`,模型 `jev-latest`(当前为 `jev-1.13.0`)。
- Python: `pip install typesafe-sdk`;JavaScript: `@typesafe-ai/sdk`。
- 置信度(confidence)来自概率分布的形状,可按风险分级设置阈值,驱动自动执行/人工复核。
- 状态+问题共享约 32k token 预算(单请求上限 64k);仅支持文本,英文准确率最高,
  中文等 CJK 可用但精度较低。
- 官方 llms 索引: https://docs.typesafe.ai/llms.txt
