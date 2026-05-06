import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import { formatSupportChatAnswerForWidget } from "@/modules/support-chat/server/answer-style";
import { buildSupportPrompt } from "@/modules/support-chat/server/build-support-prompt";
import type {
  SupportChatModelRequest,
  SupportChatModelResult,
} from "@/modules/support-chat/server/openai-response";
import type { SupportKnowledgeMatch } from "@/modules/support-chat/server/retrieve-knowledge";
import { getSupportChatCopy } from "@/modules/support-chat/server/support-chat-copy";
import type { AccountAwareServerResponse } from "@/modules/support-chat/server/account-aware/server-responses";
import type { SupportGroundingKind } from "@/modules/support-chat/server/grounding";

const MIN_STRONG_SOURCE_SCORE = 4;

export type GroundedAnswerDisposition =
  | "answered"
  | "uncertain"
  | "escalate"
  | "unsupported_account_question";

export type GroundedKnowledgeAnswerResult = {
  assistantMessage: string;
  disposition: GroundedAnswerDisposition;
  needsHumanSupport: boolean;
  responseOrigin: "server" | "model";
  groundingKind: SupportGroundingKind;
  modelMetadata?: {
    model?: string;
    modelVersion?: string;
    requestId?: string | null;
  };
};

type KnowledgeModelResponder = (
  request: SupportChatModelRequest,
) => Promise<SupportChatModelResult>;

export function hasStrongKnowledgeGrounding(matches: SupportKnowledgeMatch[]) {
  return matches.some(
    (match) =>
      match.score >= MIN_STRONG_SOURCE_SCORE &&
      match.sourceType !== "fallback-guidance",
  );
}

export function resolveAccountGroundingKind(
  response: AccountAwareServerResponse,
): SupportGroundingKind {
  return response.accountHelperMetadata.resultCategory
    ? "account_safe_dto"
    : "none";
}

export async function createKnowledgeGroundedAnswer(input: {
  message: string;
  locale: AppLang;
  threadId: string;
  matches: SupportKnowledgeMatch[];
  modelResponder?: KnowledgeModelResponder;
}): Promise<GroundedKnowledgeAnswerResult> {
  const copy = getSupportChatCopy(input.locale).serverMessages;

  if (!input.matches.length || !hasStrongKnowledgeGrounding(input.matches)) {
    return {
      assistantMessage: copy.uncertain,
      disposition: "uncertain",
      needsHumanSupport: false,
      responseOrigin: "server",
      groundingKind: "none",
    };
  }

  const prompt = buildSupportPrompt({
    message: input.message,
    locale: input.locale,
    sources: input.matches,
  });
  const modelResponder =
    input.modelResponder ??
    (await import("@/modules/support-chat/server/openai-response"))
      .createSupportChatModelResponse;
  const modelResult = await modelResponder({
    instructions: prompt.instructions,
    input: prompt.input,
    locale: input.locale,
    metadata: {
      threadId: input.threadId,
      locale: input.locale,
    },
  });

  if (!modelResult.ok) {
    return {
      assistantMessage: modelResult.fallbackMessage,
      disposition: "escalate",
      needsHumanSupport: true,
      responseOrigin: "server",
      groundingKind: "none",
      modelMetadata: {
        model: modelResult.model,
        modelVersion: modelResult.modelVersion,
        requestId: modelResult.requestId,
      },
    };
  }

  return {
    assistantMessage: formatSupportChatAnswerForWidget(modelResult.text),
    disposition: "answered",
    needsHumanSupport: false,
    responseOrigin: "model",
    groundingKind: "knowledge",
    modelMetadata: {
      model: modelResult.model,
      modelVersion: modelResult.modelVersion,
      requestId: modelResult.requestId,
    },
  };
}
