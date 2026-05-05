import "server-only";

import type { Payload } from "payload";
import { type AppLang } from "@/lib/i18n/app-lang";
import {
  type GenerateSupportResponseResult,
  type SupportChatSource,
} from "@/modules/support-chat/server/generate-support-response";
import type { SupportAccountContextSnapshot } from "@/modules/support-chat/server/account-aware/server-responses";
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
    sourceLocale: source.sourceLocale,
    score: source.score,
    matchedTerms: source.matchedTerms.map((term) => ({ term })),
  }));
}

function redactionTypeRows(redactionTypes: string[]) {
  return redactionTypes.map((type) => ({ type }));
}

function accountContextSnapshotRows(snapshots: SupportAccountContextSnapshot[]) {
  return snapshots
    .map((snapshot) => ({
      kind: snapshot.kind,
      helper: snapshot.helper,
      resultCategory: snapshot.resultCategory,
      statusFilter: snapshot.statusFilter,
      orders: snapshot.orders.map((order) => ({
        orderId: order.orderId,
        referenceType: order.referenceType,
        referenceId: order.referenceId,
        displayReference: order.displayReference,
        label: order.label,
        description: order.description,
        providerDisplayName: order.providerDisplayName,
        serviceNames: (order.serviceNames ?? []).map((name) => ({ name })),
        firstSlotStart: order.firstSlotStart,
        createdAt: order.createdAt,
        serviceStatusCategory: order.serviceStatusCategory,
        paymentStatusCategory: order.paymentStatusCategory,
        invoiceStatusCategory: order.invoiceStatusCategory,
        nextStepKey: order.nextStepKey,
      })),
    }))
    .filter((snapshot) => snapshot.orders.length > 0);
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

function relationshipId(value: unknown) {
  return typeof value === "string"
    ? value
    : ((value as { id?: string } | null)?.id ?? null);
}

function canAppendToThread(thread: unknown, payloadUserId?: string) {
  const ownerId = relationshipId(
    (thread as { user?: unknown } | null | undefined)?.user
  );

  if (!ownerId) return true;
  return Boolean(payloadUserId && ownerId === payloadUserId);
}

function nextThreadStatus(
  currentStatus: unknown,
  needsHumanSupport: boolean
) {
  if (needsHumanSupport) return "escalated";
  if (currentStatus === "escalated" || currentStatus === "closed") {
    return currentStatus;
  }
  return "open";
}

async function countThreadMessages(db: Payload, threadId: string) {
  const { totalDocs } = await db.count({
    collection: "support_chat_messages",
    where: { thread: { equals: threadId } },
    overrideAccess: true,
  });

  return totalDocs;
}

async function findOrCreateThread(input: {
  db: Payload;
  threadId: string;
  locale: AppLang;
  payloadUserId?: string;
}) {
  const existing = await findThread(input.db, input.threadId);
  if (existing) {
    if (!canAppendToThread(existing, input.payloadUserId)) {
      throw new Error("Support chat thread ownership mismatch.");
    }
    return { thread: existing, created: false };
  }

  try {
    const created = await input.db.create({
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
    return { thread: created, created: true };
  } catch (error) {
    const raced = await findThread(input.db, input.threadId);
    if (raced) {
      if (!canAppendToThread(raced, input.payloadUserId)) {
        throw new Error("Support chat thread ownership mismatch.");
      }
      return { thread: raced, created: false };
    }
    throw error;
  }
}

export async function persistSupportInteraction(
  input: PersistSupportInteractionInput
) {
  const now = new Date();
  const payloadUserId = await resolvePayloadUserId(input.db, input.userId);
  const { thread, created } = await findOrCreateThread({
    db: input.db,
    threadId: input.response.threadId,
    locale: input.locale,
    payloadUserId,
  });

  const userText = redactSupportChatText(input.message);
  const assistantText = redactSupportChatText(input.response.assistantMessage);
  const accountContextSnapshots = accountContextSnapshotRows(
    input.response.accountContextSnapshots ?? []
  );

  await input.db.create({
    collection: "support_chat_messages",
    data: {
      thread: thread.id,
      role: "user",
      text: userText.redactedText,
      redactedText: userText.redactedText,
      redactionApplied: userText.redactionApplied,
      redactionTypes: redactionTypeRows(userText.redactionTypes),
      locale: input.locale,
      responseOrigin: "server",
      needsHumanSupport: false,
      groundingKind: "none",
    },
    depth: 0,
    overrideAccess: true,
  });

  await input.db.create({
    collection: "support_chat_messages",
    data: {
      thread: thread.id,
      role: "assistant",
      text: assistantText.redactedText,
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
      accountAnswerMode: input.response.accountAnswerMode,
      accountRewriteModel: input.response.accountRewriteModel,
      accountRewriteModelVersion: input.response.accountRewriteModelVersion,
      accountRewriteRejectedReason: input.response.accountRewriteRejectedReason,
      accountRewriteFallbackUsed: input.response.accountRewriteFallbackUsed,
      ...(accountContextSnapshots.length
        ? { accountContextSnapshots }
        : {}),
      triageIntent: input.response.triage?.intent,
      triageTopic: input.response.triage?.topic,
      triageStatusFilter: input.response.triage?.statusFilter,
      triageConfidence: input.response.triage?.confidence,
      triageReason: input.response.triage?.reason,
      triageMappedHelper: input.response.triageMappedHelper,
      triageEligibilityAllowed: input.response.triageEligibilityAllowed,
      triageEligibilityReason: input.response.triageEligibilityReason,
      groundingKind: input.response.groundingKind,
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

  const messageCount = await countThreadMessages(input.db, thread.id);

  await input.db.update({
    collection: "support_chat_threads",
    id: thread.id,
    data: {
      ...(created && payloadUserId ? { user: payloadUserId } : {}),
      locale: input.locale,
      status: nextThreadStatus(
        thread.status,
        input.response.needsHumanSupport
      ),
      lastMessageAt: now.toISOString(),
      lastDisposition: input.response.disposition,
      lastNeedsHumanSupport: input.response.needsHumanSupport,
      lastAccountContextKind: accountContextSnapshots[0]?.kind ?? null,
      messageCount,
      retentionUntil: addDays(now, SUPPORT_CHAT_RETENTION_DAYS).toISOString(),
    },
    depth: 0,
    overrideAccess: true,
  });
}
