import "server-only";

import type { Payload, Where } from "payload";
import type { SupportChatThread } from "@/payload-types";
import type { AdminSupportThreadRow } from "@/modules/support-chat/server/admin-procedures";

function relationshipId(value: unknown) {
  return typeof value === "string"
    ? value
    : ((value as { id?: string } | null)?.id ?? null);
}

export async function listSupportThreads(
  db: Payload,
  input: {
    page: number;
    limit: number;
    locale?: SupportChatThread["locale"];
    status?: "open" | "escalated" | "closed";
    lastDisposition?:
      | "answered"
      | "uncertain"
      | "escalate"
      | "unsupported_account_question";
    needsHumanSupport?: boolean;
  }
) {
  const and: Where[] = [];

  if (input.locale) {
    and.push({ locale: { equals: input.locale } });
  }

  if (input.status) {
    and.push({ status: { equals: input.status } });
  }

  if (input.lastDisposition) {
    and.push({ lastDisposition: { equals: input.lastDisposition } });
  }

  if (typeof input.needsHumanSupport === "boolean") {
    and.push({ lastNeedsHumanSupport: { equals: input.needsHumanSupport } });
  }

  const result = await db.find({
    collection: "support_chat_threads",
    where: and.length ? { and } : undefined,
    page: input.page,
    limit: input.limit,
    sort: "-lastMessageAt",
    depth: 0,
    overrideAccess: true,
  });

  const items: AdminSupportThreadRow[] = ((result.docs ?? []) as SupportChatThread[])
    .filter((thread) => Boolean(thread.id))
    .map((thread) => ({
      id: thread.id,
      threadId: thread.threadId,
      locale: thread.locale,
      userId: relationshipId(thread.user),
      status: thread.status,
      lastDisposition: thread.lastDisposition ?? null,
      lastNeedsHumanSupport: Boolean(thread.lastNeedsHumanSupport),
      messageCount: thread.messageCount,
      lastMessageAt: thread.lastMessageAt ?? null,
      retentionUntil: thread.retentionUntil,
    }));

  return {
    items,
    page: result.page ?? input.page,
    totalPages: result.totalPages ?? 1,
    totalItems: result.totalDocs ?? items.length,
    hasMore: (result.hasNextPage ?? false) || (result.page ?? 1) < (result.totalPages ?? 1),
  };
}
