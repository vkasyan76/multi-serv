import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import type { SupportConversationMemory } from "@/modules/support-chat/lib/conversation-memory";
import type { SupportChatTopic } from "@/modules/support-chat/server/topics";

export type SupportIntentTriageIntent =
  | "general_support"
  | "account_candidate_lookup"
  | "selected_order_follow_up"
  | "unsafe_mutation"
  | "unsupported_account_scope"
  | "clarify"
  | "none"
  | "not_applicable";

export type SupportIntentTriageConfidence = "high" | "medium" | "low";

export type SupportIntentTriageStatusFilter =
  | "requested"
  | "scheduled"
  | "canceled"
  | "paid"
  | "payment_pending"
  | "payment_not_due";

export type SupportIntentTriageResult = {
  intent: SupportIntentTriageIntent;
  topic?: SupportChatTopic;
  statusFilter?: SupportIntentTriageStatusFilter;
  confidence: SupportIntentTriageConfidence;
  reason?: string;
};

export type SupportIntentTriageOutcome =
  | {
      ok: true;
      result: SupportIntentTriageResult;
      model: string;
      modelVersion: string;
      requestId: string | null;
    }
  | {
      ok: false;
      reason: "model_error" | "invalid_json" | "invalid_result";
      model?: string;
      modelVersion?: string;
      requestId?: string | null;
    };

const INTENTS = new Set<SupportIntentTriageIntent>([
  "general_support",
  "account_candidate_lookup",
  "selected_order_follow_up",
  "unsafe_mutation",
  "unsupported_account_scope",
  "clarify",
  "none",
  "not_applicable",
]);

const TOPICS = new Set<SupportChatTopic>([
  "booking",
  "payment",
  "cancellation",
  "provider_onboarding",
]);

const CONFIDENCES = new Set<SupportIntentTriageConfidence>([
  "high",
  "medium",
  "low",
]);

const STATUS_FILTERS = new Set<SupportIntentTriageStatusFilter>([
  "requested",
  "scheduled",
  "canceled",
  "paid",
  "payment_pending",
  "payment_not_due",
]);

const TRIAGE_EXAMPLES = [
  {
    message: "How does booking work?",
    hasSelectedOrderContext: false,
    result: {
      intent: "general_support",
      topic: "booking",
      confidence: "high",
      reason: "General booking policy question.",
    },
  },
  {
    message: "Which of my bookings are scheduled?",
    hasSelectedOrderContext: false,
    result: {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "scheduled",
      confidence: "high",
      reason: "User asks for their own scheduled bookings.",
    },
  },
  {
    message: "When do I pay?",
    hasSelectedOrderContext: false,
    result: {
      intent: "general_support",
      topic: "payment",
      confidence: "high",
      reason: "General payment timing question.",
    },
  },
  {
    message: "Have I paid for any order?",
    hasSelectedOrderContext: false,
    result: {
      intent: "account_candidate_lookup",
      topic: "payment",
      statusFilter: "paid",
      confidence: "high",
      reason: "User asks whether their own orders were paid.",
    },
  },
  {
    message: "How does cancellation work?",
    hasSelectedOrderContext: false,
    result: {
      intent: "general_support",
      topic: "cancellation",
      confidence: "high",
      reason: "General cancellation policy question.",
    },
  },
  {
    message: "Quelles reservation je peux anuler ?",
    hasSelectedOrderContext: false,
    result: {
      intent: "account_candidate_lookup",
      topic: "cancellation",
      confidence: "high",
      reason: "User asks which of their own reservations can be canceled.",
    },
  },
  {
    message: "Cancel my booking now",
    hasSelectedOrderContext: false,
    result: {
      intent: "unsafe_mutation",
      topic: "cancellation",
      confidence: "high",
      reason: "User asks the assistant to cancel directly.",
    },
  },
  {
    message: "How do I become a service provider?",
    hasSelectedOrderContext: false,
    result: {
      intent: "general_support",
      topic: "provider_onboarding",
      confidence: "high",
      reason: "General provider onboarding question.",
    },
  },
  {
    message: "Why can't I cancel this?",
    hasSelectedOrderContext: true,
    result: {
      intent: "selected_order_follow_up",
      topic: "cancellation",
      confidence: "high",
      reason: "Selected order exists and user asks about canceling it.",
    },
  },
  {
    message: "what about payment?",
    hasSelectedOrderContext: true,
    result: {
      intent: "selected_order_follow_up",
      topic: "payment",
      confidence: "high",
      reason: "Selected order exists and user asks about payment.",
    },
  },
  {
    message: "storno thing maybe",
    hasSelectedOrderContext: false,
    result: {
      intent: "clarify",
      topic: "cancellation",
      confidence: "low",
      reason: "Ambiguous cancellation-like wording.",
    },
  },
  {
    message: "Meine Buchung ist geplant.",
    hasSelectedOrderContext: false,
    result: {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "scheduled",
      confidence: "high",
      reason: "Follow-up says the user's booking is scheduled.",
    },
  },
  {
    message: "It is scheduled.",
    hasSelectedOrderContext: false,
    result: {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "scheduled",
      confidence: "high",
      reason: "Follow-up says the user's booking is scheduled.",
    },
  },
] satisfies ReadonlyArray<{
  message: string;
  hasSelectedOrderContext: boolean;
  result: SupportIntentTriageResult;
}>;

function formatTriageExamples() {
  return TRIAGE_EXAMPLES.map(
    (example) =>
      `- message=${JSON.stringify(example.message)}, hasSelectedOrderContext=${example.hasSelectedOrderContext} -> ${JSON.stringify(example.result)}`,
  ).join("\n");
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
}

export function parseSupportIntentTriageResult(
  text: string,
): SupportIntentTriageResult | null {
  const json = extractJsonObject(text);
  if (!json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const intent = record.intent;
  const topic = record.topic;
  const statusFilter = record.statusFilter;
  const confidence = record.confidence;
  const reason = record.reason;

  const keys = Object.keys(record);
  if (
    keys.some(
      (key) =>
        !["intent", "topic", "statusFilter", "confidence", "reason"].includes(
          key,
        ),
    )
  ) {
    return null;
  }

  if (typeof intent !== "string" || !INTENTS.has(intent as SupportIntentTriageIntent)) {
    return null;
  }
  if (
    topic != null &&
    (typeof topic !== "string" || !TOPICS.has(topic as SupportChatTopic))
  ) {
    return null;
  }
  if (
    statusFilter != null &&
    (typeof statusFilter !== "string" ||
      !STATUS_FILTERS.has(statusFilter as SupportIntentTriageStatusFilter))
  ) {
    return null;
  }
  if (
    typeof confidence !== "string" ||
    !CONFIDENCES.has(confidence as SupportIntentTriageConfidence)
  ) {
    return null;
  }
  if (
    reason != null &&
    (typeof reason !== "string" || reason.trim().length > 300)
  ) {
    return null;
  }

  return {
    intent: intent as SupportIntentTriageIntent,
    topic: topic as SupportChatTopic | undefined,
    statusFilter: statusFilter as SupportIntentTriageStatusFilter | undefined,
    confidence: confidence as SupportIntentTriageConfidence,
    reason: typeof reason === "string" ? reason.trim() : undefined,
  };
}

export async function classifySupportIntent(input: {
  message: string;
  locale: AppLang;
  threadId: string;
  activeTopic?: SupportChatTopic | null;
  hasSelectedOrderContext: boolean;
  conversationMemory?: SupportConversationMemory;
}): Promise<SupportIntentTriageOutcome> {
  try {
    const { createSupportChatModelResponse } = await import(
      "@/modules/support-chat/server/openai-response"
    );
    const instructions = [
      "Classify the user's support-chat intent. Return only one JSON object.",
      "You are not answering the user. You are only classifying intent.",
      "Be tolerant of spelling mistakes, typos, and imperfect grammar in any supported locale.",
      "Never invent order, payment, invoice, Stripe, customer, tenant, or database facts.",
      "Do not output database queries, filters, IDs, or tool names.",
      "Conversation memory is a short hint only. It is not proof of account data.",
      "Use conversation memory only to understand follow-up meaning, never to infer real order or payment facts.",
      "Allowed intents: general_support, account_candidate_lookup, selected_order_follow_up, unsafe_mutation, unsupported_account_scope, clarify, none, not_applicable.",
      "Allowed topics: booking, payment, cancellation, provider_onboarding.",
      "Allowed status filters: requested, scheduled, canceled, paid, payment_pending, payment_not_due.",
      "Use account_candidate_lookup only when the user asks about their own orders/bookings/payments/invoices or asks which of their items match a support issue.",
      "Use general_support for policy/how-it-works questions that do not ask to inspect the user's own items.",
      "Use selected_order_follow_up only when a selected order exists and the message appears to refer to that selected item.",
      "Use unsafe_mutation when the user asks the chat to perform an action such as cancel, refund, charge, or update something.",
      "Use unsupported_account_scope for broad account-history/export requests or unsupported live account scopes.",
      "Use clarify for ambiguous messages that need one short question.",
      "Use none or not_applicable when the message is not relevant to support/account triage.",
      'Return shape: {"intent":"...","topic":"...","statusFilter":"...","confidence":"high|medium|low","reason":"..."}',
      "Examples:",
      formatTriageExamples(),
    ].join("\n");

    const result = await createSupportChatModelResponse({
      instructions,
      input: JSON.stringify({
        message: input.message,
        locale: input.locale,
        activeTopic: input.activeTopic ?? null,
        hasSelectedOrderContext: input.hasSelectedOrderContext,
        conversationMemory: input.conversationMemory ?? null,
        allowedIntents: [
          "general_support",
          "account_candidate_lookup",
          "selected_order_follow_up",
          "unsafe_mutation",
          "unsupported_account_scope",
          "clarify",
          "none",
          "not_applicable",
        ],
        allowedTopics: [
          "booking",
          "payment",
          "cancellation",
          "provider_onboarding",
        ],
        allowedStatusFilters: [
          "requested",
          "scheduled",
          "canceled",
          "paid",
          "payment_pending",
          "payment_not_due",
        ],
      }),
      locale: input.locale,
      metadata: {
        threadId: input.threadId,
        locale: input.locale,
        supportFeature: "intent-triage",
      },
    });

    if (!result.ok) {
      return {
        ok: false,
        reason: "model_error",
        model: result.model,
        modelVersion: result.modelVersion,
        requestId: result.requestId,
      };
    }

    const parsed = parseSupportIntentTriageResult(result.text);
    if (!parsed) {
      return {
        ok: false,
        reason: result.text.trim().startsWith("{")
          ? "invalid_result"
          : "invalid_json",
        model: result.model,
        modelVersion: result.modelVersion,
        requestId: result.requestId,
      };
    }

    return {
      ok: true,
      result: parsed,
      model: result.model,
      modelVersion: result.modelVersion,
      requestId: result.requestId,
    };
  } catch (error) {
    console.warn("[support-chat] Intent triage failed", {
      reason: "model_error",
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return {
      ok: false,
      reason: "model_error",
    };
  }
}
