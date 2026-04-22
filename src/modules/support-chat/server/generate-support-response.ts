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
  score: number;
  matchedTerms: string[];
};

export type GenerateSupportResponseInput = {
  message: string;
  threadId?: string;
  locale: AppLang;
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
};

const MIN_STRONG_SOURCE_SCORE = 4;

const SUPPORT_CHAT_SERVER_MESSAGES = {
  empty: "Please enter a support question so I can help.",
  abusive:
    "I can help with support questions, but I cannot respond to abusive messages. Please contact support if you need help.",
  nonsense:
    "I could not understand that request. Please rephrase your support question or contact support.",
  clarify:
    "What are you trying to do: register, book a service, manage a provider profile, pay for an order, cancel, or dispute something?",
  unsupportedAccount:
    "I cannot check live order, payment, invoice, refund, or account details in this chat yet. I can explain the general policy or usual next steps from Infinisimo support material. For your specific account or order, please use your account pages or contact support.",
  uncertain:
    "I do not have enough support information to answer that reliably. I can help with general registration, provider setup, booking, payment, cancellation, dispute, and marketplace usage questions. For this specific issue, please contact support.",
} as const;

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
  /\bdid\s+my\s+payment\s+go\s+through\b/i,
  /\bcheck\s+my\s+payment\b/i,
  /\bwhy\s+was\s+i\s+charged\b/i,
  /\bwhy\s+was\s+my\s+card\s+charged\b/i,
  /\bcancel\s+my\s+(booking|order)\b/i,
  /\bcheck\s+my\s+invoice\b/i,
  /\brefund\s+(this|my)\s+(payment|order|booking)\b/i,
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
    score: match.score,
    matchedTerms: match.matchedTerms,
  };
}

function invalidInputMessage(disposition: SupportChatInputPrecheckDisposition) {
  if (disposition === "empty") return SUPPORT_CHAT_SERVER_MESSAGES.empty;
  if (disposition === "abusive") return SUPPORT_CHAT_SERVER_MESSAGES.abusive;
  return SUPPORT_CHAT_SERVER_MESSAGES.nonsense;
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

  if (precheck !== "in_scope") {
    return supportResponse({
      threadId,
      assistantMessage: invalidInputMessage(precheck),
      sources: [],
      disposition: "escalate",
      responseOrigin: "server",
      needsHumanSupport: false,
    });
  }

  if (isAmbiguousSupportRequest(message)) {
    return supportResponse({
      threadId,
      assistantMessage: SUPPORT_CHAT_SERVER_MESSAGES.clarify,
      sources: [],
      disposition: "uncertain",
      responseOrigin: "server",
      needsHumanSupport: false,
    });
  }

  const hasUnsupportedAccountRequest = hasAccountSpecificRequest(message);
  const matches = await retrieveSupportKnowledge({
    query: message,
    locale: input.locale,
  });
  const sources = matches.map(toSupportChatSource);

  if (hasUnsupportedAccountRequest) {
    return supportResponse({
      threadId,
      assistantMessage: SUPPORT_CHAT_SERVER_MESSAGES.unsupportedAccount,
      sources,
      disposition: "unsupported_account_question",
      responseOrigin: "server",
    });
  }

  if (!matches.length || !hasStrongSource(matches)) {
    return supportResponse({
      threadId,
      assistantMessage: SUPPORT_CHAT_SERVER_MESSAGES.uncertain,
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
