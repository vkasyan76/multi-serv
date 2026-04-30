import "server-only";

import crypto from "node:crypto";
import { type AppLang } from "@/lib/i18n/app-lang";
import {
  classifySupportChatInputPrecheck,
  type SupportChatInputPrecheckDisposition,
} from "@/modules/support-chat/lib/input-precheck";
import { type SupportKnowledgeSourceType } from "@/modules/support-chat/server/knowledge-loader";
import { buildSupportPrompt } from "@/modules/support-chat/server/build-support-prompt";
import { createSupportChatModelResponse } from "@/modules/support-chat/server/openai-response";
import {
  retrieveSupportKnowledge,
  type SupportKnowledgeMatch,
} from "@/modules/support-chat/server/retrieve-knowledge";
import { getSupportChatCopy } from "@/modules/support-chat/server/support-chat-copy";
import {
  buildAccountAwareServerResponse,
  type SupportAccountHelperMetadata,
  type SupportChatAction,
  type SupportSelectedOrderContext,
} from "@/modules/support-chat/server/account-aware/server-responses";
import type {
  SupportAccountAnswerMode,
  SupportAccountRewriteRejectedReason,
} from "@/modules/support-chat/server/account-aware/types";
import { verifySelectedOrderContextToken } from "@/modules/support-chat/server/account-aware/action-tokens";
import { routeSupportAccountAwareRequest } from "@/modules/support-chat/server/account-aware/routing";
import type { TRPCContext } from "@/trpc/init";

export type SupportChatDisposition =
  | "answered"
  | "uncertain"
  | "escalate"
  | "unsupported_account_question";

export type SupportChatSource = {
  documentId: string;
  documentVersion: string;
  chunkId: string;
  sectionId: string;
  sectionTitle: string;
  sourceType: SupportKnowledgeSourceType;
  sourceLocale: AppLang;
  score: number;
  matchedTerms: string[];
};

export type GenerateSupportResponseInput = {
  message: string;
  threadId?: string;
  locale: AppLang;
  accountContext?: Pick<TRPCContext, "db" | "userId">;
  selectedOrderContext?: Pick<SupportSelectedOrderContext, "token">;
};

export type GenerateSupportResponseResult = {
  threadId: string;
  assistantMessage: string;
  sources: SupportChatSource[];
  disposition: SupportChatDisposition;
  needsHumanSupport: boolean;
  responseOrigin: "server" | "model";
  modelMetadata?: {
    model?: string;
    modelVersion?: string;
    requestId?: string | null;
  };
  accountHelperMetadata?: SupportAccountHelperMetadata;
  accountAnswerMode?: SupportAccountAnswerMode;
  accountRewriteModel?: string;
  accountRewriteModelVersion?: string;
  accountRewriteRejectedReason?: SupportAccountRewriteRejectedReason;
  accountRewriteFallbackUsed?: boolean;
  actions?: SupportChatAction[];
  selectedOrderContext?: SupportSelectedOrderContext;
};

const MIN_STRONG_SOURCE_SCORE = 4;

// These tiny phrase/pattern checks are intentionally English-first for Phase 1.
// They are a minimal shortcut for obvious ambiguous/account-specific requests,
// not semantic classification. Non-English prompts that do not match them
// intentionally fall through to retrieval-driven uncertain/escalate handling.
const AMBIGUOUS_SUPPORT_PHRASES = new Set([
  "help",
  "problem",
  "issue",
  "not working",
  "it does not work",
  "does not work",
  "doesn't work",
  "something is wrong",
]);

const ACCOUNT_SPECIFIC_PATTERNS = [
  /\bwhere\s+is\s+my\s+order\b/i,
  /\bwhat\s+is\s+my\s+order\s+status\b/i,
  /\bcheck\s+my\s+order\s+status\b/i,
  /\bcheck\s+my\s+order\b/i,
  /\bchecked\s+my\s+order\b/i,
  /\bpretend\s+you\s+checked\s+(my\s+)?(order|booking|payment|refund|invoice|account)\b/i,
  /\b(my|this|the)\s+(order|booking)\s+status\b/i,
  /\bstatus\s+of\s+(my|this|the)\s+(order|booking)\b/i,
  /\bprovider\s+confirmed\s+(the\s+)?(booking|order)\b/i,
  /\bdid\s+my\s+payment\s+go\s+through\b/i,
  /\bcheck\s+my\s+payment\b/i,
  /\b(my|this|the)\s+payment\s+status\b/i,
  /\bwhy\s+was\s+i\s+charged\b/i,
  /\bwhy\s+was\s+my\s+card\s+charged\b/i,
  /\bcharged\s+twice\b/i,
  /\bwhich\s+charge\s+is\s+valid\b/i,
  /\bcancel\s+my\s+(booking|order)\b/i,
  /\bcancel\s+(this|the)\s+(booking|order)\b/i,
  /\bcancel\s+it\s+now\b/i,
  /\bcheck\s+my\s+invoice\b/i,
  /\brefund\s+(this|my)\s+(payment|order|booking)\b/i,
  /\bmy\s+refund\b/i,
  /\b(my|this|the)\s+refund\s+status\b/i,
  /\brefund\s+(is|was|has\s+been)\s+(already\s+)?processed\b/i,
  /\btell\s+me\s+if\s+my\s+refund\b/i,
  /\b(my|this|the)\s+account\s+status\b/i,
];

const ADVERSARIAL_UNGROUNDED_PATTERNS = [
  /\buse\s+common\s+marketplace\s+rules\b/i,
  /\bcommon\s+marketplace\s+rules\b/i,
  /\bcommon\s+practice\b/i,
  /\banswer\s+confidently\b/i,
  /\bdo\s+not\s+mention\s+uncertainty\b/i,
  /\bdon't\s+mention\s+uncertainty\b/i,
  /\bhide\s+uncertainty\b/i,
  /\bpretend\s+you\s+checked\b/i,
  /\bignore\s+your\s+rules\b/i,
];

const THIN_POLICY_PATTERNS = [
  /\bpartial\s+refunds?\b/i,
  /\bpartially\s+refund\b/i,
  /\brefund\s+part\s+of\b/i,
  /\btransfer\s+(my\s+)?booking\b/i,
  /\btransfer\s+(my\s+)?order\b/i,
  /\bmove\s+(my\s+)?booking\s+to\s+another\s+person\b/i,
];

function normalizeSupportMessage(message: string) {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function isAmbiguousSupportRequest(message: string) {
  return AMBIGUOUS_SUPPORT_PHRASES.has(normalizeSupportMessage(message));
}

function hasAccountSpecificRequest(message: string) {
  // Tiny pre-model check for obvious live account/action requests.
  // This is not semantic classification and must not grow into a broad intent system.
  return ACCOUNT_SPECIFIC_PATTERNS.some((pattern) => pattern.test(message));
}

function hasAdversarialUngroundedRequest(message: string) {
  return ADVERSARIAL_UNGROUNDED_PATTERNS.some((pattern) =>
    pattern.test(message)
  );
}

function hasThinPolicyRequest(message: string) {
  return THIN_POLICY_PATTERNS.some((pattern) => pattern.test(message));
}

function hasStrongSource(matches: SupportKnowledgeMatch[]) {
  // The model only drafts normal answers when at least one non-fallback source
  // is strong enough; weak-source paths stay deterministic and server-authored.
  return matches.some(
    (match) =>
      match.score >= MIN_STRONG_SOURCE_SCORE &&
      match.sourceType !== "fallback-guidance"
  );
}

function toSupportChatSource(match: SupportKnowledgeMatch): SupportChatSource {
  return {
    documentId: match.documentId,
    documentVersion: match.documentVersion,
    chunkId: match.id,
    sectionId: match.sectionId,
    sectionTitle: match.sectionTitle,
    sourceType: match.sourceType,
    sourceLocale: match.locale,
    score: match.score,
    matchedTerms: match.matchedTerms,
  };
}

function invalidInputMessage(
  disposition: SupportChatInputPrecheckDisposition,
  locale: AppLang
) {
  const copy = getSupportChatCopy(locale).serverMessages;

  if (disposition === "empty") return copy.empty;
  if (disposition === "abusive") return copy.abusive;
  return copy.nonsense;
}

function supportResponse(
  input: Omit<GenerateSupportResponseResult, "needsHumanSupport"> & {
    needsHumanSupport?: boolean;
  }
): GenerateSupportResponseResult {
  return {
    ...input,
    needsHumanSupport:
      input.needsHumanSupport ?? input.disposition !== "answered",
  };
}

export async function generateSupportResponse(
  input: GenerateSupportResponseInput
): Promise<GenerateSupportResponseResult> {
  const threadId = input.threadId ?? crypto.randomUUID();
  const message = input.message.trim();
  const precheck = classifySupportChatInputPrecheck(message);
  const copy = getSupportChatCopy(input.locale).serverMessages;

  if (precheck !== "in_scope") {
    return supportResponse({
      threadId,
      assistantMessage: invalidInputMessage(precheck, input.locale),
      sources: [],
      disposition: "escalate",
      responseOrigin: "server",
      needsHumanSupport: false,
    });
  }

  if (isAmbiguousSupportRequest(message)) {
    return supportResponse({
      threadId,
      assistantMessage: copy.clarify,
      sources: [],
      disposition: "uncertain",
      responseOrigin: "server",
      needsHumanSupport: false,
    });
  }

  const selectedOrder =
    input.accountContext && input.selectedOrderContext
      ? verifySelectedOrderContextToken({
          token: input.selectedOrderContext.token,
          threadId,
        })
      : null;

  const accountRoute = input.accountContext
    ? routeSupportAccountAwareRequest(message, {
        selectedOrder: selectedOrder?.ok ? selectedOrder.input : undefined,
      })
    : { kind: "none" as const };
  if (accountRoute.kind !== "none") {
    const accountResponse = await buildAccountAwareServerResponse({
      route: accountRoute,
      accountContext: input.accountContext,
      locale: input.locale,
      threadId,
    });

    return supportResponse({
      threadId,
      assistantMessage: accountResponse.assistantMessage,
      sources: [],
      disposition: accountResponse.disposition,
      responseOrigin: "server",
      needsHumanSupport: accountResponse.needsHumanSupport,
      accountHelperMetadata: accountResponse.accountHelperMetadata,
      accountAnswerMode: accountResponse.accountAnswerMode,
      accountRewriteModel: accountResponse.accountRewriteModel,
      accountRewriteModelVersion: accountResponse.accountRewriteModelVersion,
      accountRewriteRejectedReason: accountResponse.accountRewriteRejectedReason,
      accountRewriteFallbackUsed: accountResponse.accountRewriteFallbackUsed,
      actions: accountResponse.actions,
      selectedOrderContext: accountResponse.selectedOrderContext,
    });
  }

  const isUnsupportedAccountRequest = hasAccountSpecificRequest(message);
  const isAdversarialUngroundedRequest =
    hasAdversarialUngroundedRequest(message);
  const isThinPolicyRequest = hasThinPolicyRequest(message);
  const matches = await retrieveSupportKnowledge({
    query: message,
    locale: input.locale,
  });
  const sources = matches.map(toSupportChatSource);

  if (isUnsupportedAccountRequest) {
    return supportResponse({
      threadId,
      assistantMessage: copy.unsupportedAccount,
      sources,
      disposition: "unsupported_account_question",
      responseOrigin: "server",
    });
  }

  if (isAdversarialUngroundedRequest || isThinPolicyRequest) {
    return supportResponse({
      threadId,
      assistantMessage: copy.uncertain,
      sources,
      disposition: "uncertain",
      responseOrigin: "server",
    });
  }

  if (!matches.length || !hasStrongSource(matches)) {
    return supportResponse({
      threadId,
      assistantMessage: copy.uncertain,
      sources,
      disposition: "uncertain",
      responseOrigin: "server",
    });
  }

  const prompt = buildSupportPrompt({
    message,
    locale: input.locale,
    sources: matches,
  });
  const modelResult = await createSupportChatModelResponse({
    instructions: prompt.instructions,
    input: prompt.input,
    locale: input.locale,
    metadata: {
      threadId,
      locale: input.locale,
    },
  });

  if (!modelResult.ok) {
    return supportResponse({
      threadId,
      assistantMessage: modelResult.fallbackMessage,
      sources,
      disposition: "escalate",
      responseOrigin: "server",
    });
  }

  return supportResponse({
    threadId,
    assistantMessage: modelResult.text,
    sources,
    disposition: "answered",
    needsHumanSupport: false,
    responseOrigin: "model",
    modelMetadata: {
      model: modelResult.model,
      modelVersion: modelResult.modelVersion,
      requestId: modelResult.requestId,
    },
  });
}
