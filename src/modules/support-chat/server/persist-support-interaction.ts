import "server-only";

import type { Payload } from "payload";
import { type AppLang } from "@/lib/i18n/app-lang";
import {
  type GenerateSupportResponseResult,
  type SupportChatSource,
} from "@/modules/support-chat/server/generate-support-response";
import { redactSupportChatText } from "@/modules/support-chat/server/redaction";
import {
  SUPPORT_CHAT_GUARDRAIL_VERSION,
  SUPPORT_CHAT_KNOWLEDGE_PACK_VERSION,
  SUPPORT_CHAT_PROMPT_VERSION,
  SUPPORT_CHAT_RETENTION_DAYS,
  SUPPORT_CHAT_RETRIEVAL_VERSION,
} from "@/modules/support-chat/server/versioning";

type PersistSupportInteractionInput = {
  db: Payload;
  userId?: string | null;
  locale: AppLang;
  message: string;
  response: GenerateSupportResponseResult;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function resolvePayloadUserId(db: Payload, userId?: string | null) {
  if (!userId) return undefined;

  const byClerk = await db.find({
    collection: "users",
    limit: 1,
    where: { clerkUserId: { equals: userId } },
    depth: 0,
    overrideAccess: true,
  });

  if (byClerk.docs[0]?.id) return byClerk.docs[0].id;

  const byPayloadId = await db.find({
    collection: "users",
    limit: 1,
    where: { id: { equals: userId } },
    depth: 0,
    overrideAccess: true,
  });

  return byPayloadId.docs[0]?.id;
}

function sourceRows(sources: SupportChatSource[]) {
  return sources.map((source) => ({
    documentId: source.documentId,
    documentVersion: source.documentVersion,
    chunkId: source.chunkId,
    sectionId: source.sectionId,
    sectionTitle: source.sectionTitle,
    sourceType: source.sourceType,
    score: source.score,
    matchedTerms: source.matchedTerms.map((term) => ({ term })),
  }));
}

function redactionTypeRows(redactionTypes: string[]) {
  return redactionTypes.map((type) => ({ type }));
}

async function findThread(db: Payload, threadId: string) {
  const existing = await db.find({
    collection: "support_chat_threads",
    limit: 1,
    where: { threadId: { equals: threadId } },
    depth: 0,
    overrideAccess: true,
  });

  return existing.docs[0];
}

async function findOrCreateThread(input: {
  db: Payload;
  threadId: string;
  locale: AppLang;
  payloadUserId?: string;
}) {
  const existing = await findThread(input.db, input.threadId);
  if (existing) return existing;

  try {
    return await input.db.create({
      collection: "support_chat_threads",
      data: {
        threadId: input.threadId,
        user: input.payloadUserId,
        locale: input.locale,
        status: "open",
        messageCount: 0,
        retentionUntil: addDays(
          new Date(),
          SUPPORT_CHAT_RETENTION_DAYS
        ).toISOString(),
      },
      depth: 0,
      overrideAccess: true,
    });
  } catch (error) {
    const raced = await findThread(input.db, input.threadId);
    if (raced) return raced;
    throw error;
  }
}

export async function persistSupportInteraction(
  input: PersistSupportInteractionInput
) {
  const now = new Date();
  const payloadUserId = await resolvePayloadUserId(input.db, input.userId);
  const thread = await findOrCreateThread({
    db: input.db,
    threadId: input.response.threadId,
    locale: input.locale,
    payloadUserId,
  });

  const userText = redactSupportChatText(input.message);
  const assistantText = redactSupportChatText(input.response.assistantMessage);

  await input.db.create({
    collection: "support_chat_messages",
    data: {
      thread: thread.id,
      role: "user",
      text: input.message,
      redactedText: userText.redactedText,
      redactionApplied: userText.redactionApplied,
      redactionTypes: redactionTypeRows(userText.redactionTypes),
      locale: input.locale,
      responseOrigin: "server",
      needsHumanSupport: false,
    },
    depth: 0,
    overrideAccess: true,
  });

  await input.db.create({
    collection: "support_chat_messages",
    data: {
      thread: thread.id,
      role: "assistant",
      text: input.response.assistantMessage,
      redactedText: assistantText.redactedText,
      redactionApplied: assistantText.redactionApplied,
      redactionTypes: redactionTypeRows(assistantText.redactionTypes),
      locale: input.locale,
      responseOrigin: input.response.responseOrigin,
      disposition: input.response.disposition,
      needsHumanSupport: input.response.needsHumanSupport,
      model:
        input.response.responseOrigin === "model"
          ? input.response.modelMetadata?.model
          : undefined,
      modelVersion:
        input.response.responseOrigin === "model"
          ? input.response.modelMetadata?.modelVersion
          : undefined,
      promptVersion: SUPPORT_CHAT_PROMPT_VERSION,
      guardrailVersion: SUPPORT_CHAT_GUARDRAIL_VERSION,
      retrievalVersion: SUPPORT_CHAT_RETRIEVAL_VERSION,
      knowledgePackVersion: SUPPORT_CHAT_KNOWLEDGE_PACK_VERSION,
      openAIRequestId:
        input.response.responseOrigin === "model"
          ? input.response.modelMetadata?.requestId
          : undefined,
      sources: sourceRows(input.response.sources),
    },
    depth: 0,
    overrideAccess: true,
  });

  await input.db.update({
    collection: "support_chat_threads",
    id: thread.id,
    data: {
      user: payloadUserId ?? undefined,
      locale: input.locale,
      status: input.response.needsHumanSupport ? "escalated" : "open",
      lastMessageAt: now.toISOString(),
      lastDisposition: input.response.disposition,
      lastNeedsHumanSupport: input.response.needsHumanSupport,
      messageCount: Number(thread.messageCount ?? 0) + 2,
      retentionUntil: addDays(now, SUPPORT_CHAT_RETENTION_DAYS).toISOString(),
    },
    depth: 0,
    overrideAccess: true,
  });
}
