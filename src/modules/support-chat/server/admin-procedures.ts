import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { type AppLang, SUPPORTED_APP_LANGS } from "@/lib/i18n/app-lang";
import type {
  SupportChatMessage,
  SupportChatThread,
  User,
} from "@/payload-types";
import { baseProcedure } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { listSupportMessages } from "@/modules/support-chat/server/list-support-messages";
import { listSupportThreads } from "@/modules/support-chat/server/list-support-threads";
import { getSupportChatReviewSummary } from "@/modules/support-chat/server/support-chat-review-summary";

function isPayloadObjectId(value: string) {
  return /^[a-f0-9]{24}$/i.test(value);
}

async function resolvePayloadUserId(ctx: TRPCContext, userId: string) {
  const byClerk = await ctx.db.find({
    collection: "users",
    limit: 1,
    where: { clerkUserId: { equals: userId } },
    depth: 0,
    overrideAccess: true,
  });

  if (byClerk.docs[0]?.id) return byClerk.docs[0].id;

  if (!isPayloadObjectId(userId)) return null;

  const byPayloadId = await ctx.db.find({
    collection: "users",
    limit: 1,
    where: { id: { equals: userId } },
    depth: 0,
    overrideAccess: true,
  });

  return byPayloadId.docs[0]?.id ?? null;
}

async function requireSuperAdmin(ctx: TRPCContext) {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

  const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
  if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

  const user = (await ctx.db.findByID({
    collection: "users",
    id: payloadUserId,
    depth: 0,
    overrideAccess: true,
  })) as User | null;

  if (!user?.roles?.includes("super-admin")) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

const ADMIN_REVIEW_FILTERS = [
  "answered",
  "order_selection_requested",
  "uncertain",
  "account_blocked",
  "needs_review",
] as const;

const adminListThreadsInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  locale: z.enum(SUPPORTED_APP_LANGS).optional(),
  review: z.enum(ADMIN_REVIEW_FILTERS).optional(),
});

export const supportChatAdminProcedures = {
  adminReviewSummary: baseProcedure.query(async ({ ctx }) => {
    await requireSuperAdmin(ctx);
    return getSupportChatReviewSummary(ctx.db);
  }),

  adminListThreads: baseProcedure
    .input(adminListThreadsInput)
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      return listSupportThreads(ctx.db, input);
    }),

  adminGetThreadMessages: baseProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      const detail = await listSupportMessages(ctx.db, input.id);

      if (!detail) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return detail;
    }),
};

export type AdminSupportThreadRow = {
  id: string;
  threadId: string;
  locale: AppLang;
  user: AdminSupportUserSummary;
  status: SupportChatThread["status"];
  reviewState: AdminSupportReviewState;
  lastAssistantOutcome: AdminSupportAssistantOutcome;
  lastNeedsHumanSupport: boolean;
  messageCount: number;
  latestUserMessagePreview: string | null;
  lastMessageAt: string | null;
  retentionUntil: string;
  createdAt: string;
};

export type AdminSupportUserSummary = {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  language: AppLang | null;
  country: string | null;
} | null;

export type AdminSupportReviewState =
  | "needs_review"
  | "order_selection_requested"
  | "uncertain"
  | "account_blocked"
  | "answered";

export type AdminSupportAssistantOutcome =
  | "answered"
  | "uncertain"
  | "escalated"
  | "unsupported_account_question"
  | null;

export type AdminSupportMessageRow = {
  id: string;
  role: SupportChatMessage["role"];
  text: string | null;
  redactedText: string | null;
  redactionApplied: boolean;
  redactionTypes: string[];
  locale: AppLang;
  responseOrigin: SupportChatMessage["responseOrigin"];
  disposition: Exclude<SupportChatMessage["disposition"], undefined> | null;
  needsHumanSupport: boolean;
  model: string | null;
  modelVersion: string | null;
  promptVersion: string | null;
  guardrailVersion: string | null;
  retrievalVersion: string | null;
  knowledgePackVersion: string | null;
  openAIRequestId: string | null;
  accountContextSnapshots: Array<{
    kind: string;
    helper: string | null;
    resultCategory: string | null;
    statusFilter: string | null;
    orders: Array<{
      orderId: string | null;
      referenceType: string | null;
      referenceId: string | null;
      displayReference: string | null;
      label: string | null;
      description: string | null;
      providerDisplayName: string | null;
      serviceNames: string[];
      firstSlotStart: string | null;
      createdAt: string | null;
      serviceStatusCategory: string | null;
      paymentStatusCategory: string | null;
      invoiceStatusCategory: string | null;
      nextStepKey: string | null;
    }>;
  }>;
  triageIntent: string | null;
  triageTopic: string | null;
  triageStatusFilter: string | null;
  triageConfidence: string | null;
  triageReason: string | null;
  triageMappedHelper: string | null;
  triageEligibilityAllowed: boolean | null;
  triageEligibilityReason: string | null;
  groundingKind: string | null;
  sources: Array<{
    documentId: string;
    documentVersion: string;
    chunkId: string;
    sectionId: string;
    sectionTitle: string | null;
    sourceType: NonNullable<
      NonNullable<SupportChatMessage["sources"]>[number]["sourceType"]
    >;
    sourceLocale: AppLang;
    score: number;
    matchedTerms: string[];
  }>;
  createdAt: string;
};
