import "server-only";

import type { Payload } from "payload";
import type {
  SupportChatMessage,
  SupportChatThread,
} from "@/payload-types";
import type { AdminSupportMessageRow } from "@/modules/support-chat/server/admin-procedures";

function relationshipId(value: unknown) {
  return typeof value === "string"
    ? value
    : ((value as { id?: string } | null)?.id ?? null);
}

function safeText(message: SupportChatMessage) {
  return message.redactedText ?? message.text ?? null;
}

export async function listSupportMessages(db: Payload, id: string) {
  const thread = (await db.findByID({
    collection: "support_chat_threads",
    id,
    depth: 0,
    overrideAccess: true,
  })) as SupportChatThread | null;

  if (!thread?.id) return null;

  const docs: SupportChatMessage[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const messagesRes = await db.find({
      collection: "support_chat_messages",
      where: { thread: { equals: thread.id } },
      sort: "createdAt",
      depth: 0,
      limit: 200,
      page,
      overrideAccess: true,
    });

    docs.push(...((messagesRes.docs ?? []) as SupportChatMessage[]));
    totalPages = messagesRes.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  const messages: AdminSupportMessageRow[] = docs.map((message) => ({
    id: message.id,
    role: message.role,
    text: safeText(message),
    redactedText: message.redactedText ?? null,
    redactionApplied: Boolean(message.redactionApplied),
    redactionTypes: (message.redactionTypes ?? []).map((item) => item.type),
    locale: message.locale,
    responseOrigin: message.responseOrigin,
    disposition: message.disposition ?? null,
    needsHumanSupport: Boolean(message.needsHumanSupport),
    model: message.model ?? null,
    modelVersion: message.modelVersion ?? null,
    promptVersion: message.promptVersion ?? null,
    guardrailVersion: message.guardrailVersion ?? null,
    retrievalVersion: message.retrievalVersion ?? null,
    knowledgePackVersion: message.knowledgePackVersion ?? null,
    openAIRequestId: message.openAIRequestId ?? null,
    sources: (message.sources ?? []).map((source) => ({
      documentId: source.documentId,
      documentVersion: source.documentVersion,
      chunkId: source.chunkId,
      sectionId: source.sectionId,
      sectionTitle: source.sectionTitle ?? null,
      sourceType: source.sourceType,
      sourceLocale: source.sourceLocale,
      score: source.score,
      matchedTerms: (source.matchedTerms ?? []).map((term) => term.term),
    })),
    createdAt: message.createdAt,
  }));

  return {
    thread: {
      id: thread.id,
      threadId: thread.threadId,
      locale: thread.locale,
      status: thread.status,
      messageCount: thread.messageCount,
      lastDisposition: thread.lastDisposition ?? null,
      lastNeedsHumanSupport: Boolean(thread.lastNeedsHumanSupport),
      lastMessageAt: thread.lastMessageAt ?? null,
      retentionUntil: thread.retentionUntil,
      userId: relationshipId(thread.user),
    },
    messages,
  };
}
