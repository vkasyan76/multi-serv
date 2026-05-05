import "server-only";

import type { Payload } from "payload";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import type {
  SupportChatMessage,
  SupportChatThread,
  User,
} from "@/payload-types";
import type {
  AdminSupportAssistantOutcome,
  AdminSupportMessageRow,
  AdminSupportReviewState,
  AdminSupportUserSummary,
} from "@/modules/support-chat/server/admin-procedures";

function safeText(message: SupportChatMessage) {
  return message.redactedText ?? message.text ?? null;
}

function userSummary(value: unknown): AdminSupportUserSummary {
  if (!value || typeof value === "string") return null;

  const user = value as Partial<User> & { id?: string };
  if (!user.id) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    username: user.username ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    roles: user.roles ?? [],
    language: user.language ? normalizeToSupported(user.language) : null,
    country: user.country ?? null,
  };
}

function assistantOutcome(
  disposition: SupportChatThread["lastDisposition"]
): AdminSupportAssistantOutcome {
  if (disposition === "escalate") return "escalated";
  return disposition ?? null;
}

function reviewState(thread: SupportChatThread): AdminSupportReviewState {
  if (
    thread.status === "escalated" ||
    thread.lastNeedsHumanSupport ||
    thread.lastDisposition === "escalate"
  ) {
    return "needs_review";
  }
  if (thread.lastDisposition === "unsupported_account_question") {
    return "account_blocked";
  }
  if (
    thread.lastDisposition === "uncertain" &&
    thread.lastAccountContextKind === "candidate_selection"
  ) {
    return "order_selection_requested";
  }
  if (thread.lastDisposition === "uncertain") return "uncertain";
  return "answered";
}

function latestUserMessagePreview(messages: AdminSupportMessageRow[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  if (!latest?.text) return null;

  return latest.text.replace(/\s+/g, " ").trim().slice(0, 180);
}

export async function listSupportMessages(db: Payload, id: string) {
  const thread = (await db.findByID({
    collection: "support_chat_threads",
    id,
    depth: 1,
    disableErrors: true,
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
    accountContextSnapshots: (message.accountContextSnapshots ?? []).map(
      (snapshot) => ({
        kind: snapshot.kind,
        helper: snapshot.helper ?? null,
        resultCategory: snapshot.resultCategory ?? null,
        statusFilter: snapshot.statusFilter ?? null,
        orders: (snapshot.orders ?? []).map((order) => ({
          orderId: order.orderId ?? null,
          referenceType: order.referenceType ?? null,
          referenceId: order.referenceId ?? null,
          displayReference: order.displayReference ?? null,
          label: order.label ?? null,
          description: order.description ?? null,
          providerDisplayName: order.providerDisplayName ?? null,
          serviceNames: (order.serviceNames ?? []).map((item) => item.name),
          firstSlotStart: order.firstSlotStart ?? null,
          createdAt: order.createdAt ?? null,
          serviceStatusCategory: order.serviceStatusCategory ?? null,
          paymentStatusCategory: order.paymentStatusCategory ?? null,
          invoiceStatusCategory: order.invoiceStatusCategory ?? null,
          nextStepKey: order.nextStepKey ?? null,
        })),
      })
    ),
    triageIntent: message.triageIntent ?? null,
    triageTopic: message.triageTopic ?? null,
    triageStatusFilter: message.triageStatusFilter ?? null,
    triageConfidence: message.triageConfidence ?? null,
    triageReason: message.triageReason ?? null,
    groundingKind: message.groundingKind ?? null,
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
      reviewState: reviewState(thread),
      lastAssistantOutcome: assistantOutcome(thread.lastDisposition),
      lastNeedsHumanSupport: Boolean(thread.lastNeedsHumanSupport),
      latestUserMessagePreview: latestUserMessagePreview(messages),
      lastMessageAt: thread.lastMessageAt ?? null,
      retentionUntil: thread.retentionUntil,
      createdAt: thread.createdAt,
      user: userSummary(thread.user),
    },
    messages,
  };
}
