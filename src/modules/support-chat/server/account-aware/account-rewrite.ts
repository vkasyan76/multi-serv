import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import type {
  SupportChatModelRequest,
  SupportChatModelResult,
} from "@/modules/support-chat/server/openai-response";
import type { AccountAwareServerResponse } from "./server-responses";
import {
  buildAccountRewritePrompt,
  type SupportAccountRewritePayload,
} from "./account-rewrite-prompt";
import { validateAccountRewriteDraft } from "./account-rewrite-guardrails";
import type {
  SupportAccountAnswerMode,
  SupportAccountHelperDTO,
  SupportAccountRewriteRejectedReason,
} from "./types";

const APPROVED_REWRITE_RESULT_CATEGORIES = new Set([
  "order_status",
  "payment_status",
  "cancellation_eligibility",
  "payment_overview",
]);

export type SupportAccountRewriteMetadata = {
  accountAnswerMode?: SupportAccountAnswerMode;
  accountRewriteModel?: string;
  accountRewriteModelVersion?: string;
  accountRewriteRejectedReason?: SupportAccountRewriteRejectedReason;
  accountRewriteFallbackUsed?: boolean;
};

type CreateRewriteModelResponse = (
  request: SupportChatModelRequest,
) => Promise<SupportChatModelResult>;

async function createDefaultRewriteModelResponse(
  request: SupportChatModelRequest,
) {
  const { createSupportChatModelResponse } = await import(
    "@/modules/support-chat/server/openai-response"
  );
  return createSupportChatModelResponse(request);
}

function rewriteEnabled() {
  return process.env.SUPPORT_CHAT_ACCOUNT_REWRITE_ENABLED === "true";
}

function metadata(input: SupportAccountRewriteMetadata) {
  return input;
}

function withRewriteMetadata(
  response: AccountAwareServerResponse,
  rewriteMetadata: SupportAccountRewriteMetadata,
): AccountAwareServerResponse {
  return {
    ...response,
    ...rewriteMetadata,
  };
}

export function isAccountRewriteEligible(
  response: AccountAwareServerResponse,
) {
  return (
    response.disposition === "answered" &&
    response.accountHelperMetadata.serverAuthored === true &&
    Boolean(response.accountHelperMetadata.resultCategory) &&
    APPROVED_REWRITE_RESULT_CATEGORIES.has(
      response.accountHelperMetadata.resultCategory ?? "",
    )
  );
}

function failureReason(
  result: Extract<SupportChatModelResult, { ok: false }>,
): SupportAccountRewriteRejectedReason {
  return result.reason === "empty_output" ? "empty_output" : "model_error";
}

export async function rewriteAccountAwareServerResponse(input: {
  response: AccountAwareServerResponse;
  helperResult?: SupportAccountHelperDTO;
  locale: AppLang;
  threadId: string;
  createModelResponse?: CreateRewriteModelResponse;
}): Promise<AccountAwareServerResponse> {
  if (!isAccountRewriteEligible(input.response) || !input.helperResult) {
    return withRewriteMetadata(
      input.response,
      metadata({ accountAnswerMode: "server_deterministic" }),
    );
  }

  if (!rewriteEnabled()) {
    return withRewriteMetadata(
      input.response,
      metadata({
        accountAnswerMode: "model_rewrite_disabled",
        accountRewriteRejectedReason: "feature_disabled",
        accountRewriteFallbackUsed: true,
      }),
    );
  }

  const payload: SupportAccountRewritePayload = {
    locale: input.locale,
    fallbackAnswer: input.response.assistantMessage,
    helperResult: input.helperResult,
  };
  const prompt = buildAccountRewritePrompt(payload);
  const createModelResponse =
    input.createModelResponse ?? createDefaultRewriteModelResponse;

  const result = await createModelResponse({
    instructions: prompt.instructions,
    input: prompt.input,
    locale: input.locale,
    metadata: {
      threadId: input.threadId,
      locale: input.locale,
      accountAnswerMode: "rewrite",
      resultCategory: input.helperResult.resultCategory,
    },
  });

  if (!result.ok) {
    return withRewriteMetadata(
      input.response,
      metadata({
        accountAnswerMode: "model_rewrite_rejected",
        accountRewriteModel: result.model,
        accountRewriteModelVersion: result.modelVersion,
        accountRewriteRejectedReason: failureReason(result),
        accountRewriteFallbackUsed: true,
      }),
    );
  }

  const validation = validateAccountRewriteDraft({
    draft: result.text,
    locale: input.locale,
    fallbackAnswer: input.response.assistantMessage,
    helperResult: input.helperResult,
  });

  if (!validation.ok) {
    return withRewriteMetadata(
      input.response,
      metadata({
        accountAnswerMode: "model_rewrite_rejected",
        accountRewriteModel: result.model,
        accountRewriteModelVersion: result.modelVersion,
        accountRewriteRejectedReason: validation.reason,
        accountRewriteFallbackUsed: true,
      }),
    );
  }

  return withRewriteMetadata(
    {
      ...input.response,
      assistantMessage: result.text.trim(),
    },
    metadata({
      accountAnswerMode: "model_rewritten",
      accountRewriteModel: result.model,
      accountRewriteModelVersion: result.modelVersion,
      accountRewriteFallbackUsed: false,
    }),
  );
}
