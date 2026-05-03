import "server-only";

import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import {
  normalizeToSupported,
  SUPPORTED_APP_LANGS,
} from "@/lib/i18n/app-lang";
import {
  SUPPORT_CHAT_ACCOUNT_AWARE,
  SUPPORT_CHAT_PHASE,
  SUPPORT_CHAT_PUBLIC_ACCESS,
} from "@/modules/support-chat/lib/boundaries";
import { SUPPORT_CHAT_CAPABILITIES } from "@/modules/support-chat/lib/scope";
import { supportChatAdminProcedures } from "@/modules/support-chat/server/admin-procedures";
import { buildAccountAwareActionResponse } from "@/modules/support-chat/server/account-aware/server-responses";
import { generateSupportResponse } from "@/modules/support-chat/server/generate-support-response";
import { persistSupportInteraction } from "@/modules/support-chat/server/persist-support-interaction";
import { checkSupportChatRateLimit } from "@/modules/support-chat/server/rate-limit";
import { checkSupportEmailRateLimit } from "@/modules/support-chat/server/support-email-rate-limit";
import { sendSupportEmailHandoff } from "@/modules/support-chat/server/support-email";
import { getSupportChatCopy } from "@/modules/support-chat/server/support-chat-copy";
import { z } from "zod";

function supportChatRateLimitKey(input: {
  userId?: string | null;
  headers: Record<string, string>;
}) {
  if (input.userId) return `user:${input.userId}`;

  const forwardedFor = input.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const ip = forwardedFor || input.headers["x-real-ip"] || "anonymous";
  return `ip:${ip}`;
}

export const supportChatRouter = createTRPCRouter({
  ...supportChatAdminProcedures,
  getBootstrap: baseProcedure.query(async () => {
    return {
      phase: SUPPORT_CHAT_PHASE,
      accountAware: SUPPORT_CHAT_ACCOUNT_AWARE,
      publicAccess: SUPPORT_CHAT_PUBLIC_ACCESS,
      capabilities: SUPPORT_CHAT_CAPABILITIES,
    };
  }),
  sendMessage: baseProcedure
    .input(
      z.object({
        message: z.string().trim().min(1).max(2000),
        threadId: z.string().uuid().optional(),
        locale: z.enum(SUPPORTED_APP_LANGS).optional(),
        action: z
          .object({
            type: z.literal("account_candidate_select"),
            token: z.string().min(1).max(4000),
          })
          .optional(),
        selectedOrderContext: z
          .object({
            type: z.literal("selected_order"),
            token: z.string().min(1).max(4000),
          })
          .optional(),
        supportTopicContext: z
          .object({
            type: z.literal("support_topic"),
            token: z.string().min(1).max(4000),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const locale = input.locale ?? ctx.appLang;
      const copy = getSupportChatCopy(locale).serverMessages;
      const threadId = input.threadId ?? crypto.randomUUID();
      const rateLimit = checkSupportChatRateLimit(
        supportChatRateLimitKey({
          userId: ctx.userId,
          headers: ctx.headers,
        })
      );

      if (!rateLimit.allowed) {
        return {
          threadId,
          assistantMessage: copy.rateLimit,
          sources: [],
          disposition: "escalate" as const,
          needsHumanSupport: false,
          responseOrigin: "server" as const,
        };
      }

      const accountContext = {
        db: ctx.db,
        userId: ctx.userId,
      };

      const response = input.action
        ? {
            threadId,
            sources: [],
            responseOrigin: "server" as const,
            ...(await buildAccountAwareActionResponse({
              token: input.action.token,
              threadId,
              locale,
              accountContext,
            })),
          }
        : await generateSupportResponse({
            message: input.message,
            threadId,
            locale,
            accountContext,
            selectedOrderContext: input.selectedOrderContext,
            supportTopicContext: input.supportTopicContext,
          });

      try {
        await persistSupportInteraction({
          db: ctx.db,
          userId: ctx.userId,
          locale,
          message: input.message,
          response,
        });
      } catch (error) {
        // Logging must not make a support answer unavailable.
        console.warn("[support-chat] Failed to persist interaction", error);
      }

      return response;
    }),
  sendSupportEmail: baseProcedure
    .input(
      z.object({
        message: z.string().trim().min(10).max(4000),
        locale: z.enum(SUPPORTED_APP_LANGS).optional(),
        threadId: z.string().uuid().optional(),
        currentUrl: z.string().url().max(2048).optional(),
        selectedOrderContext: z
          .object({
            type: z.literal("selected_order"),
            token: z.string().min(1).max(4000),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      const rateLimit = checkSupportEmailRateLimit(`user:${ctx.userId}`);
      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many support email attempts. Please try again later.",
        });
      }

      const locale = normalizeToSupported(input.locale ?? ctx.appLang ?? "en");
      const result = await sendSupportEmailHandoff({
        db: ctx.db,
        clerkUserId: ctx.userId,
        message: input.message,
        locale,
        threadId: input.threadId,
        currentUrl: input.currentUrl,
        selectedOrderContext: input.selectedOrderContext,
      });

      if (!result.ok) {
        throw new TRPCError({
          code:
            result.reason === "missing_user_email"
              ? "BAD_REQUEST"
              : "INTERNAL_SERVER_ERROR",
          message:
            result.reason === "missing_user_email"
              ? "No registered account email is available."
              : "Support email is not configured.",
        });
      }

      if (result.result.status !== "sent") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Support email was not sent.",
        });
      }

      return { ok: true as const };
    }),
});
