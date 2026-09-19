import type { JevProject } from "../types/project";
import { DEFAULT_MODEL } from "../types/project";
import type { Locale } from "../i18n/core";

/**
 * Seed templates ported from docs/jev examples (quickstart.md, primitives/choice.md,
 * primitives/score.md). Content ships in Simplified/Traditional Chinese and English so
 * users have reference presets in their language; Japanese UI falls back to English.
 * String-only instructions/criteria — matches the P0 editor.
 */

export type TemplateContentLocale = "en" | "zh-Hans" | "zh-Hant";

export function contentLocaleFor(locale: Locale): TemplateContentLocale {
  if (locale === "zh-CN") return "zh-Hans";
  if (locale === "zh-TW") return "zh-Hant";
  return "en";
}

interface TemplateContent {
  name: string;
  state: JevProject["state"];
  questions: JevProject["questions"];
}

function project(content: TemplateContent): JevProject {
  return JSON.parse(
    JSON.stringify({ version: 1, name: content.name, model: DEFAULT_MODEL, state: content.state, questions: content.questions })
  ) as JevProject;
}

const TRIAGE: Record<TemplateContentLocale, TemplateContent> = {
  en: {
    name: "Mixed example (choice + score + noul)",
    state: "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing. I'm losing sales. Please help ASAP.",
    questions: [
      {
        id: "department",
        type: "choice",
        instructions: "Which team should handle this",
        criteria: {
          kind: "choice",
          options: [
            { key: "billing", description: "Payment or subscription issues" },
            { key: "technical", description: "Bugs or integration problems" },
            { key: "sales", description: "Pricing or account questions" },
          ],
        },
      },
      {
        id: "frustration",
        type: "score",
        instructions: "How frustrated the customer appears",
        criteria: {
          kind: "score",
          levels: ["Calm, just stating facts", "Frustrated but civil", "Very angry, strong language"],
        },
      },
      {
        id: "is_urgent",
        type: "noul",
        instructions: "The message conveys urgency or time-sensitivity",
        criteria: { kind: "noul" },
      },
    ],
  },
  "zh-Hans": {
    name: "组合提问示例",
    state: "您好,我的 Stripe 账户已经连续 3 天连接失败,影响了销售,请尽快帮忙处理。",
    questions: [
      {
        id: "department",
        type: "choice",
        instructions: "该由哪个团队处理?",
        criteria: {
          kind: "choice",
          options: [
            { key: "billing", description: "支付或订阅问题" },
            { key: "technical", description: "Bug 或集成问题" },
            { key: "sales", description: "定价或账户问题" },
          ],
        },
      },
      {
        id: "frustration",
        type: "score",
        instructions: "客户看起来有多沮丧?",
        criteria: {
          kind: "score",
          levels: ["冷静,只是陈述事实", "有些沮丧但保持礼貌", "非常愤怒,言辞强烈"],
        },
      },
      {
        id: "is_urgent",
        type: "noul",
        instructions: "信息带有紧迫感或时间敏感性",
        criteria: { kind: "noul" },
      },
    ],
  },
  "zh-Hant": {
    name: "組合提問範例",
    state: "您好,我的 Stripe 帳戶已經連續 3 天連線失敗,影響了銷售,請盡快協助處理。",
    questions: [
      {
        id: "department",
        type: "choice",
        instructions: "該由哪個團隊處理?",
        criteria: {
          kind: "choice",
          options: [
            { key: "billing", description: "付款或訂閱問題" },
            { key: "technical", description: "Bug 或整合問題" },
            { key: "sales", description: "定價或帳戶問題" },
          ],
        },
      },
      {
        id: "frustration",
        type: "score",
        instructions: "客戶看起來有多沮喪?",
        criteria: {
          kind: "score",
          levels: ["冷靜,只是陳述事實", "有些沮喪但保持禮貌", "非常憤怒,言詞強烈"],
        },
      },
      {
        id: "is_urgent",
        type: "noul",
        instructions: "訊息帶有急迫感或時間敏感性",
        criteria: { kind: "noul" },
      },
    ],
  },
};

const ECOMMERCE: Record<TemplateContentLocale, TemplateContent> = {
  en: {
    name: "Choice example (5 questions)",
    state:
      "Shoes arrived two weeks late and in the wrong size. Also I see two charges on my card. What are you going to do about this?",
    questions: [
      {
        id: "department",
        type: "choice",
        instructions: "Which team should handle this?",
        criteria: {
          kind: "choice",
          options: [
            { key: "returns", description: "Exchanges, refunds, wrong or damaged items" },
            { key: "shipping", description: "Delivery status, delays, lost packages" },
            { key: "billing", description: "Charges, invoices, payment problems" },
          ],
        },
      },
      {
        id: "return_reason",
        type: "choice",
        instructions: "If the customer wants to return something, why?",
        criteria: {
          kind: "choice",
          options: [
            { key: "wrong_size", description: "The item doesn't fit" },
            { key: "wrong_item", description: "A different product was delivered" },
            { key: "damaged", description: "The item arrived broken or faulty" },
            { key: "changed_mind", description: "The item is fine, the customer no longer wants it" },
            { key: "other", description: "A return reason that fits none of the above" },
          ],
        },
      },
      {
        id: "shipping_issue",
        type: "choice",
        instructions: "If this is a shipping problem, which kind is it?",
        criteria: {
          kind: "choice",
          options: [
            { key: "not_delivered", description: "The package never arrived" },
            { key: "delayed", description: "The package is late but still on its way" },
            { key: "wrong_address", description: "The package went to the wrong place" },
            { key: "damaged_in_transit", description: "The package arrived damaged" },
            { key: "other", description: "A shipping problem that fits none of the above" },
          ],
        },
      },
      {
        id: "requested_resolution",
        type: "choice",
        instructions: "What does the customer want to happen?",
        criteria: {
          kind: "choice",
          options: [
            { key: "exchange", description: "Swap the item for a different one" },
            { key: "refund", description: "Money back" },
            { key: "replacement", description: "The same item sent again" },
            { key: "information", description: "Just an answer, no action needed" },
          ],
        },
      },
      {
        id: "tone",
        type: "choice",
        instructions: "What is the customer's tone?",
        criteria: {
          kind: "choice",
          options: [
            { key: "calm", description: null },
            { key: "frustrated", description: null },
            { key: "angry", description: null },
          ],
        },
      },
    ],
  },
  "zh-Hans": {
    name: "选择题示例(五问)",
    state: "鞋子晚了两个星期才到,而且尺码不对。我还看到信用卡被扣了两次款。你们打算怎么处理?",
    questions: [
      {
        id: "department",
        type: "choice",
        instructions: "该由哪个团队处理?",
        criteria: {
          kind: "choice",
          options: [
            { key: "returns", description: "退换货、退款、发错或损坏的商品" },
            { key: "shipping", description: "配送状态、延迟、包裹丢失" },
            { key: "billing", description: "扣款、发票、支付问题" },
          ],
        },
      },
      {
        id: "return_reason",
        type: "choice",
        instructions: "如果客户想退货,原因是什么?",
        criteria: {
          kind: "choice",
          options: [
            { key: "wrong_size", description: "尺码不合适" },
            { key: "wrong_item", description: "送来的不是订购的商品" },
            { key: "damaged", description: "商品到货时已损坏" },
            { key: "changed_mind", description: "商品没问题,客户不想要了" },
            { key: "other", description: "不属于以上原因的其他原因" },
          ],
        },
      },
      {
        id: "shipping_issue",
        type: "choice",
        instructions: "如果是物流问题,属于哪一种?",
        criteria: {
          kind: "choice",
          options: [
            { key: "not_delivered", description: "包裹一直没有送到" },
            { key: "delayed", description: "包裹延迟但仍在途中" },
            { key: "wrong_address", description: "包裹寄错了地址" },
            { key: "damaged_in_transit", description: "包裹在运输途中受损" },
            { key: "other", description: "不属于以上情况的其他物流问题" },
          ],
        },
      },
      {
        id: "requested_resolution",
        type: "choice",
        instructions: "客户希望怎么解决?",
        criteria: {
          kind: "choice",
          options: [
            { key: "exchange", description: "换一件不同的商品" },
            { key: "refund", description: "退款" },
            { key: "replacement", description: "重新寄送同一件商品" },
            { key: "information", description: "只需要答复,无需其他处理" },
          ],
        },
      },
      {
        id: "tone",
        type: "choice",
        instructions: "客户的语气如何?",
        criteria: {
          kind: "choice",
          options: [
            { key: "calm", description: null },
            { key: "frustrated", description: null },
            { key: "angry", description: null },
          ],
        },
      },
    ],
  },
  "zh-Hant": {
    name: "選擇題範例(五問)",
    state: "鞋子晚了兩個星期才到,而且尺碼不對。我還看到信用卡被扣了兩次款。你們打算怎麼處理?",
    questions: [
      {
        id: "department",
        type: "choice",
        instructions: "該由哪個團隊處理?",
        criteria: {
          kind: "choice",
          options: [
            { key: "returns", description: "退換貨、退款、寄錯或損壞的商品" },
            { key: "shipping", description: "配送狀態、延遲、包裹遺失" },
            { key: "billing", description: "扣款、發票、付款問題" },
          ],
        },
      },
      {
        id: "return_reason",
        type: "choice",
        instructions: "如果客戶想退貨,原因是什麼?",
        criteria: {
          kind: "choice",
          options: [
            { key: "wrong_size", description: "尺碼不合適" },
            { key: "wrong_item", description: "送來的不是訂購的商品" },
            { key: "damaged", description: "商品到貨時已損壞" },
            { key: "changed_mind", description: "商品沒問題,客戶不想要了" },
            { key: "other", description: "不屬於以上原因的其他原因" },
          ],
        },
      },
      {
        id: "shipping_issue",
        type: "choice",
        instructions: "如果是物流問題,屬於哪一種?",
        criteria: {
          kind: "choice",
          options: [
            { key: "not_delivered", description: "包裹一直沒有送到" },
            { key: "delayed", description: "包裹延遲但仍在途中" },
            { key: "wrong_address", description: "包裹寄錯了地址" },
            { key: "damaged_in_transit", description: "包裹在運輸途中受損" },
            { key: "other", description: "不屬於以上情況的其他物流問題" },
          ],
        },
      },
      {
        id: "requested_resolution",
        type: "choice",
        instructions: "客戶希望怎麼解決?",
        criteria: {
          kind: "choice",
          options: [
            { key: "exchange", description: "換一件不同的商品" },
            { key: "refund", description: "退款" },
            { key: "replacement", description: "重新寄送同一件商品" },
            { key: "information", description: "只需要答覆,無需其他處理" },
          ],
        },
      },
      {
        id: "tone",
        type: "choice",
        instructions: "客戶的語氣如何?",
        criteria: {
          kind: "choice",
          options: [
            { key: "calm", description: null },
            { key: "frustrated", description: null },
            { key: "angry", description: null },
          ],
        },
      },
    ],
  },
};

const BUG_SCORE: Record<TemplateContentLocale, TemplateContent> = {
  en: {
    name: "Score example (3 weighted)",
    state:
      "Export to PDF fails with a spinner that never finishes. Some of our team say CSV export still works for them, others say it fails too. This is the third time I'm writing in and honestly I'm done. Steps: open any report, click Export, choose PDF. Chrome 128 on macOS.",
    questions: [
      {
        id: "severity",
        type: "score",
        instructions: "How severe is the reported issue?",
        criteria: {
          kind: "score",
          levels: [
            "Cosmetic; no impact to functionality",
            "Broken or degraded feature, but workaround exists",
            "Blocking issue; no workaround exists",
          ],
        },
      },
      {
        id: "frustration",
        type: "score",
        instructions: "How frustrated is the customer?",
        criteria: {
          kind: "score",
          levels: [
            "Calm, just stating facts",
            "Frustrated but civil",
            "Very angry, strong language or threatening to leave",
          ],
        },
      },
      {
        id: "report_quality",
        type: "score",
        instructions: "How much does the report give an engineer to work with?",
        criteria: {
          kind: "score",
          levels: [
            "No detail; just says something is broken",
            "Names the feature but no steps or environment",
            "Steps to reproduce or environment, but not both",
            "Steps to reproduce and environment",
          ],
        },
      },
    ],
  },
  "zh-Hans": {
    name: "评分题示例(三项加权)",
    state:
      "导出 PDF 一直转圈圈,始终完不成。有同事说 CSV 导出还能用,也有人说也不行了。这已经是我第三次反馈了,真的受不了。操作步骤:打开任意报表,点导出,选 PDF。Chrome 128,macOS。",
    questions: [
      {
        id: "severity",
        type: "score",
        instructions: "报告的问题有多严重?",
        criteria: {
          kind: "score",
          levels: ["外观问题;不影响功能", "功能损坏或降级,但有替代方案", "阻塞问题;没有替代方案"],
        },
      },
      {
        id: "frustration",
        type: "score",
        instructions: "客户有多沮丧?",
        criteria: {
          kind: "score",
          levels: ["冷静,只是陈述事实", "有些沮丧但保持礼貌", "非常愤怒,言辞强烈或威胁弃用"],
        },
      },
      {
        id: "report_quality",
        type: "score",
        instructions: "这份报告给工程师提供了多少可用信息?",
        criteria: {
          kind: "score",
          levels: [
            "没有细节;只说坏了",
            "提到功能,但没有步骤或环境",
            "有复现步骤或环境,但缺另一个",
            "复现步骤和环境都有",
          ],
        },
      },
    ],
  },
  "zh-Hant": {
    name: "評分題範例(三項加權)",
    state:
      "匯出 PDF 一直轉圈圈,始終完不成。有同事說 CSV 匯出還能用,也有人說也不行了。這已經是我第三次回報了,真的受不了。操作步驟:開啟任意報表,點匯出,選 PDF。Chrome 128,macOS。",
    questions: [
      {
        id: "severity",
        type: "score",
        instructions: "回報的問題有多嚴重?",
        criteria: {
          kind: "score",
          levels: ["外觀問題;不影響功能", "功能損壞或降級,但有替代方案", "阻斷問題;沒有替代方案"],
        },
      },
      {
        id: "frustration",
        type: "score",
        instructions: "客戶有多沮喪?",
        criteria: {
          kind: "score",
          levels: ["冷靜,只是陳述事實", "有些沮喪但保持禮貌", "非常憤怒,言詞強烈或威脅棄用"],
        },
      },
      {
        id: "report_quality",
        type: "score",
        instructions: "這份回報給工程師提供了多少可用資訊?",
        criteria: {
          kind: "score",
          levels: [
            "沒有細節;只說壞了",
            "提到功能,但沒有步驟或環境",
            "有重現步驟或環境,但缺另一個",
            "重現步驟和環境都有",
          ],
        },
      },
    ],
  },
};

const REFUND: Record<TemplateContentLocale, TemplateContent> = {
  en: {
    name: "Yes/no example (3 questions)",
    state: {
      ticket: {
        messages: [{ from: "customer", text: "I was charged twice for order A-104. Please refund the duplicate." }],
      },
      order: {
        id: "A-104",
        charges: [
          { amount_usd: 49, status: "captured" },
          { amount_usd: 49, status: "captured" },
        ],
      },
      refund_policy: "Duplicate charges are eligible for a full refund.",
    },
    questions: [
      {
        id: "refund_requested",
        type: "noul",
        instructions: "Does `ticket.messages[0].text` request a refund?",
        criteria: { kind: "noul" },
      },
      {
        id: "duplicate_charge",
        type: "noul",
        instructions: "Do `order.charges` show two identical captured charges?",
        criteria: { kind: "noul" },
      },
      {
        id: "policy_supports_refund",
        type: "noul",
        instructions: "Does `refund_policy` support the refund requested in `ticket.messages[0].text`?",
        criteria: { kind: "noul" },
      },
    ],
  },
  "zh-Hans": {
    name: "判断题示例(三问)",
    state: {
      ticket: {
        messages: [{ from: "customer", text: "订单 A-104 被重复扣款 49 美元,请退还重复的部分。" }],
      },
      order: {
        id: "A-104",
        charges: [
          { amount_usd: 49, status: "captured" },
          { amount_usd: 49, status: "captured" },
        ],
      },
      refund_policy: "重复扣款可全额退款。",
    },
    questions: [
      {
        id: "refund_requested",
        type: "noul",
        instructions: "客户是否在 `ticket.messages[0].text` 中要求退款?",
        criteria: { kind: "noul" },
      },
      {
        id: "duplicate_charge",
        type: "noul",
        instructions: "`order.charges` 是否存在两笔相同的已扣款记录?",
        criteria: { kind: "noul" },
      },
      {
        id: "policy_supports_refund",
        type: "noul",
        instructions: "退款政策 `refund_policy` 是否支持 `ticket.messages[0].text` 中请求的退款?",
        criteria: { kind: "noul" },
      },
    ],
  },
  "zh-Hant": {
    name: "判斷題範例(三問)",
    state: {
      ticket: {
        messages: [{ from: "customer", text: "訂單 A-104 被重複扣款 49 美元,請退還重複的部分。" }],
      },
      order: {
        id: "A-104",
        charges: [
          { amount_usd: 49, status: "captured" },
          { amount_usd: 49, status: "captured" },
        ],
      },
      refund_policy: "重複扣款可全額退款。",
    },
    questions: [
      {
        id: "refund_requested",
        type: "noul",
        instructions: "客戶是否在 `ticket.messages[0].text` 中要求退款?",
        criteria: { kind: "noul" },
      },
      {
        id: "duplicate_charge",
        type: "noul",
        instructions: "`order.charges` 是否存在兩筆相同的已扣款記錄?",
        criteria: { kind: "noul" },
      },
      {
        id: "policy_supports_refund",
        type: "noul",
        instructions: "退款政策 `refund_policy` 是否支援 `ticket.messages[0].text` 中請求的退款?",
        criteria: { kind: "noul" },
      },
    ],
  },
};

const EMAIL_INTENT: Record<TemplateContentLocale, TemplateContent> = {
  en: {
    name: "Mixed example 2 (classify + noul + score)",
    state: "Subject: Cannot log in since this morning. Body: I get a 500 error every time I try to sign in. Our whole team is blocked.",
    questions: [
      {
        id: "intent",
        type: "choice",
        instructions: "What is the main intent of this email?",
        criteria: {
          kind: "choice",
          options: [
            { key: "login_issue", description: "Cannot sign in or access the account" },
            { key: "bug_report", description: "A defect blocking normal work" },
            { key: "feature_request", description: "A new capability is being requested" },
            { key: "billing", description: "Payment or subscription question" },
            { key: "other", description: "Anything that fits none of the above" },
          ],
        },
      },
      {
        id: "team_blocked",
        type: "noul",
        instructions: "Does the message say that multiple people are affected?",
        criteria: { kind: "noul" },
      },
      {
        id: "urgency",
        type: "score",
        instructions: "How urgent is the request?",
        criteria: {
          kind: "score",
          levels: ["No time pressure", "Blocked but workarounds may exist", "Fully blocked, act immediately"],
        },
      },
    ],
  },
  "zh-Hans": {
    name: "组合提问示例二",
    state: "主题:今天早上起无法登录。正文:每次登录都报 500 错误,我们整个团队都被阻塞了。",
    questions: [
      {
        id: "intent",
        type: "choice",
        instructions: "这封邮件的主要意图是什么?",
        criteria: {
          kind: "choice",
          options: [
            { key: "login_issue", description: "无法登录或访问账户" },
            { key: "bug_report", description: "阻碍正常工作的缺陷" },
            { key: "feature_request", description: "请求新功能" },
            { key: "billing", description: "支付或订阅问题" },
            { key: "other", description: "不属于以上情况的其他意图" },
          ],
        },
      },
      {
        id: "team_blocked",
        type: "noul",
        instructions: "信息是否提到多人受到影响?",
        criteria: { kind: "noul" },
      },
      {
        id: "urgency",
        type: "score",
        instructions: "这个请求有多紧急?",
        criteria: {
          kind: "score",
          levels: ["没有时间压力", "被阻塞但可能有替代方案", "完全阻塞,需立即处理"],
        },
      },
    ],
  },
  "zh-Hant": {
    name: "組合提問範例二",
    state: "主旨:今天早上起無法登入。內文:每次登入都出現 500 錯誤,我們整個團隊都被阻塞了。",
    questions: [
      {
        id: "intent",
        type: "choice",
        instructions: "這封郵件的主要意圖是什麼?",
        criteria: {
          kind: "choice",
          options: [
            { key: "login_issue", description: "無法登入或存取帳戶" },
            { key: "bug_report", description: "阻礙正常工作的缺陷" },
            { key: "feature_request", description: "請求新功能" },
            { key: "billing", description: "付款或訂閱問題" },
            { key: "other", description: "不屬於以上情況的其他意圖" },
          ],
        },
      },
      {
        id: "team_blocked",
        type: "noul",
        instructions: "訊息是否提到多人受到影響?",
        criteria: { kind: "noul" },
      },
      {
        id: "urgency",
        type: "score",
        instructions: "這個請求有多急迫?",
        criteria: {
          kind: "score",
          levels: ["沒有時間壓力", "被阻塞但可能有替代方案", "完全阻塞,需立即處理"],
        },
      },
    ],
  },
};

const RESUME_SCREEN: Record<TemplateContentLocale, TemplateContent> = {
  en: {
    name: "Mixed example 3 (noul + score)",
    state:
      "Candidate resume: 6 years of backend engineering at two SaaS companies. Led the migration of a payments service to Go. Mentions designing event-driven systems with Kafka for order processing.",
    questions: [
      {
        id: "distributed_systems",
        type: "noul",
        instructions: "Does the resume mention experience with distributed systems?",
        criteria: { kind: "noul" },
      },
      {
        id: "backend_level",
        type: "score",
        instructions: "How strong is the candidate's backend engineering experience?",
        criteria: {
          kind: "score",
          levels: [
            "No backend experience",
            "Some backend exposure",
            "Solid backend experience",
            "Deep backend expertise",
          ],
        },
      },
      {
        id: "leadership",
        type: "noul",
        instructions: "Does the resume describe leading a project or team?",
        criteria: { kind: "noul" },
      },
    ],
  },
  "zh-Hans": {
    name: "组合提问示例三",
    state: "候选人简历:两家 SaaS 公司共 6 年后端工程经验。主导过支付服务向 Go 的迁移。提到使用 Kafka 为订单处理设计事件驱动系统。",
    questions: [
      {
        id: "distributed_systems",
        type: "noul",
        instructions: "简历是否提到分布式系统相关经验?",
        criteria: { kind: "noul" },
      },
      {
        id: "backend_level",
        type: "score",
        instructions: "候选人的后端工程经验有多强?",
        criteria: {
          kind: "score",
          levels: ["没有后端经验", "有一些后端接触", "后端经验扎实", "后端深度专家"],
        },
      },
      {
        id: "leadership",
        type: "noul",
        instructions: "简历是否描述了主导项目或团队的经历?",
        criteria: { kind: "noul" },
      },
    ],
  },
  "zh-Hant": {
    name: "組合提問範例三",
    state: "候選人履歷:兩家 SaaS 公司共 6 年後端工程經驗。主導過支付服務向 Go 的遷移。提到使用 Kafka 為訂單處理設計事件驅動系統。",
    questions: [
      {
        id: "distributed_systems",
        type: "noul",
        instructions: "履歷是否提到分散式系統相關經驗?",
        criteria: { kind: "noul" },
      },
      {
        id: "backend_level",
        type: "score",
        instructions: "候選人的後端工程經驗有多強?",
        criteria: {
          kind: "score",
          levels: ["沒有後端經驗", "有一些後端接觸", "後端經驗紮實", "後端深度專家"],
        },
      },
      {
        id: "leadership",
        type: "noul",
        instructions: "履歷是否描述了主導專案或團隊的經歷?",
        criteria: { kind: "noul" },
      },
    ],
  },
};

const CONTENT: Record<string, Record<TemplateContentLocale, TemplateContent>> = {
  "ticket-triage": TRIAGE,
  "ecommerce-choice": ECOMMERCE,
  "bug-composite-score": BUG_SCORE,
  "refund-checks": REFUND,
  "email-intent-routing": EMAIL_INTENT,
  "resume-screening": RESUME_SCREEN,
};

export interface TemplateDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  build: (locale: Locale) => JevProject;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "ticket-triage",
    nameKey: "template.triage.name",
    descriptionKey: "template.triage.description",
    build: (locale) => project(CONTENT["ticket-triage"]![contentLocaleFor(locale)]),
  },
  {
    id: "ecommerce-choice",
    nameKey: "template.ecommerce.name",
    descriptionKey: "template.ecommerce.description",
    build: (locale) => project(CONTENT["ecommerce-choice"]![contentLocaleFor(locale)]),
  },
  {
    id: "bug-composite-score",
    nameKey: "template.bugScore.name",
    descriptionKey: "template.bugScore.description",
    build: (locale) => project(CONTENT["bug-composite-score"]![contentLocaleFor(locale)]),
  },
  {
    id: "refund-checks",
    nameKey: "template.refund.name",
    descriptionKey: "template.refund.description",
    build: (locale) => project(CONTENT["refund-checks"]![contentLocaleFor(locale)]),
  },
  {
    id: "email-intent-routing",
    nameKey: "template.email.name",
    descriptionKey: "template.email.description",
    build: (locale) => project(CONTENT["email-intent-routing"]![contentLocaleFor(locale)]),
  },
  {
    id: "resume-screening",
    nameKey: "template.resume.name",
    descriptionKey: "template.resume.description",
    build: (locale) => project(CONTENT["resume-screening"]![contentLocaleFor(locale)]),
  },
];

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
