import "server-only";

import type { Payload, Where } from "payload";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import type { SupportChatMessage, SupportChatThread, User } from "@/payload-types";
import type {
  AdminSupportAssistantOutcome,
  AdminSupportReviewState,
  AdminSupportThreadRow,
  AdminSupportUserSummary,
} from "@/modules/support-chat/server/admin-procedures";

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
  if (thread.status === "closed") return "closed";
  if (thread.status === "escalated" || thread.lastNeedsHumanSupport) {
    return "needs_review";
  }
  return "answered";
}

async function latestUserMessagePreview(db: Payload, threadId: string) {
  const result = await db.find({
    collection: "support_chat_messages",
    where: {
      and: [
        { thread: { equals: threadId } },
        { role: { equals: "user" } },
      ],
    },
    sort: "-createdAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const message = result.docs[0] as SupportChatMessage | undefined;
  const text = message?.redactedText ?? message?.text;
  if (!text) return null;

  return text.replace(/\s+/g, " ").trim().slice(0, 180);
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
    depth: 1,
    overrideAccess: true,
  });

  const threads = ((result.docs ?? []) as SupportChatThread[]).filter((thread) =>
    Boolean(thread.id)
  );

  const previews = await Promise.all(
    threads.map((thread) => latestUserMessagePreview(db, thread.id))
  );

  const items: AdminSupportThreadRow[] = threads.map((thread, index) => ({
      id: thread.id,
      threadId: thread.threadId,
      locale: thread.locale,
      user: userSummary(thread.user),
      status: thread.status,
      reviewState: reviewState(thread),
      lastAssistantOutcome: assistantOutcome(thread.lastDisposition),
      lastNeedsHumanSupport: Boolean(thread.lastNeedsHumanSupport),
      messageCount: thread.messageCount,
      latestUserMessagePreview: previews[index] ?? null,
      lastMessageAt: thread.lastMessageAt ?? null,
      retentionUntil: thread.retentionUntil,
      createdAt: thread.createdAt,
    }));

  return {
    items,
    page: result.page ?? input.page,
    totalPages: result.totalPages ?? 1,
    totalItems: result.totalDocs ?? items.length,
    hasMore: (result.hasNextPage ?? false) || (result.page ?? 1) < (result.totalPages ?? 1),
  };
}
