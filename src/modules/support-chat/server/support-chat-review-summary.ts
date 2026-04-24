import "server-only";

import type { Payload } from "payload";
import { SUPPORTED_APP_LANGS } from "@/lib/i18n/app-lang";
import type { SupportChatMessage } from "@/payload-types";

async function countMessages(
  db: Payload,
  where?: Parameters<Payload["count"]>[0]["where"]
) {
  const { totalDocs } = await db.count({
    collection: "support_chat_messages",
    where,
    overrideAccess: true,
  });
  return totalDocs;
}

async function countThreads(
  db: Payload,
  where?: Parameters<Payload["count"]>[0]["where"]
) {
  const { totalDocs } = await db.count({
    collection: "support_chat_threads",
    where,
    overrideAccess: true,
  });
  return totalDocs;
}

async function listAllAssistantMessages(db: Payload) {
  const docs: SupportChatMessage[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await db.find({
      collection: "support_chat_messages",
      where: { role: { equals: "assistant" } },
      sort: "-createdAt",
      page,
      limit: 200,
      depth: 0,
      overrideAccess: true,
    });

    docs.push(...((result.docs ?? []) as SupportChatMessage[]));
    totalPages = result.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return docs;
}

export async function getSupportChatReviewSummary(db: Payload) {
  const [
    threads,
    messages,
    assistantMessages,
    answered,
    uncertain,
    escalate,
    unsupportedAccount,
    needsHumanSupportCount,
    serverResponses,
    modelResponses,
    assistantDocs,
    localeCounts,
  ] = await Promise.all([
    countThreads(db),
    countMessages(db),
    countMessages(db, { role: { equals: "assistant" } }),
    countMessages(db, { disposition: { equals: "answered" } }),
    countMessages(db, { disposition: { equals: "uncertain" } }),
    countMessages(db, { disposition: { equals: "escalate" } }),
    countMessages(db, {
      disposition: { equals: "unsupported_account_question" },
    }),
    countMessages(db, { needsHumanSupport: { equals: true } }),
    countMessages(db, { responseOrigin: { equals: "server" } }),
    countMessages(db, { responseOrigin: { equals: "model" } }),
    listAllAssistantMessages(db),
    Promise.all(
      SUPPORTED_APP_LANGS.map(async (locale) => ({
        locale,
        count: await countThreads(db, { locale: { equals: locale } }),
      }))
    ),
  ]);

  const sourceDocCounts = new Map<string, number>();
  for (const message of assistantDocs) {
    for (const source of message.sources ?? []) {
      sourceDocCounts.set(
        source.documentId,
        (sourceDocCounts.get(source.documentId) ?? 0) + 1
      );
    }
  }

  const topSourceDocuments = Array.from(sourceDocCounts.entries())
    .map(([documentId, count]) => ({ documentId, count }))
    .sort((a, b) => b.count - a.count || a.documentId.localeCompare(b.documentId))
    .slice(0, 5);

  return {
    totals: {
      threads,
      messages,
      assistantMessages,
    },
    dispositions: {
      answered,
      uncertain,
      escalate,
      unsupported_account_question: unsupportedAccount,
    },
    needsHumanSupportCount,
    responseOrigins: {
      server: serverResponses,
      model: modelResponses,
    },
    locales: localeCounts.filter((item) => item.count > 0),
    topSourceDocuments,
  };
}
