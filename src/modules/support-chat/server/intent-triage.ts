import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import type { SupportChatTopic } from "@/modules/support-chat/server/topics";

export type SupportIntentTriageIntent =
  | "general_topic_help"
  | "account_candidate_lookup"
  | "selected_order_follow_up"
  | "unsafe_mutation"
  | "clarify"
  | "none";

export type SupportIntentTriageConfidence = "high" | "medium" | "low";

export type SupportIntentTriageResult = {
  intent: SupportIntentTriageIntent;
  topic?: SupportChatTopic;
  confidence: SupportIntentTriageConfidence;
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
  "general_topic_help",
  "account_candidate_lookup",
  "selected_order_follow_up",
  "unsafe_mutation",
  "clarify",
  "none",
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
  const confidence = record.confidence;

  if (typeof intent !== "string" || !INTENTS.has(intent as never)) {
    return null;
  }
  if (
    topic != null &&
    (typeof topic !== "string" || !TOPICS.has(topic as never))
  ) {
    return null;
  }
  if (
    typeof confidence !== "string" ||
    !CONFIDENCES.has(confidence as never)
  ) {
    return null;
  }

  return {
    intent: intent as SupportIntentTriageIntent,
    topic: topic as SupportChatTopic | undefined,
    confidence: confidence as SupportIntentTriageConfidence,
  };
}

export async function classifySupportIntent(input: {
  message: string;
  locale: AppLang;
  threadId: string;
  activeTopic?: SupportChatTopic | null;
  hasSelectedOrderContext: boolean;
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
      "Allowed intents: general_topic_help, account_candidate_lookup, selected_order_follow_up, unsafe_mutation, clarify, none.",
      "Allowed topics: booking, payment, cancellation, provider_onboarding.",
      "Use account_candidate_lookup only when the user asks about their own orders/bookings/payments/invoices or asks which of their items match a support issue.",
      "Use general_topic_help for policy/how-it-works questions that do not ask to inspect the user's own items.",
      "Use selected_order_follow_up only when a selected order exists and the message appears to refer to that selected item.",
      "Use unsafe_mutation when the user asks the chat to perform an action such as cancel, refund, charge, or update something.",
      "Use clarify for ambiguous messages that need one short question.",
      'Return shape: {"intent":"...","topic":"...","confidence":"high|medium|low"}',
    ].join("\n");

    const result = await createSupportChatModelResponse({
      instructions,
      input: JSON.stringify({
        message: input.message,
        locale: input.locale,
        activeTopic: input.activeTopic ?? null,
        hasSelectedOrderContext: input.hasSelectedOrderContext,
        allowedIntents: [
          "general_topic_help",
          "account_candidate_lookup",
          "selected_order_follow_up",
          "unsafe_mutation",
          "clarify",
          "none",
        ],
        allowedTopics: [
          "booking",
          "payment",
          "cancellation",
          "provider_onboarding",
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
    console.warn("[support-chat] Intent triage failed", error);
    return {
      ok: false,
      reason: "model_error",
    };
  }
}
