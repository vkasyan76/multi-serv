import "server-only";

import crypto from "node:crypto";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { SUPPORTED_APP_LANGS } from "@/lib/i18n/app-lang";
import {
  SUPPORT_CHAT_ACCOUNT_AWARE,
  SUPPORT_CHAT_PHASE,
  SUPPORT_CHAT_PUBLIC_ACCESS,
} from "@/modules/support-chat/lib/boundaries";
import { SUPPORT_CHAT_CAPABILITIES } from "@/modules/support-chat/lib/scope";
import { supportChatAdminProcedures } from "@/modules/support-chat/server/admin-procedures";
import { generateSupportResponse } from "@/modules/support-chat/server/generate-support-response";
import { persistSupportInteraction } from "@/modules/support-chat/server/persist-support-interaction";
import { checkSupportChatRateLimit } from "@/modules/support-chat/server/rate-limit";
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

      const response = await generateSupportResponse({
        message: input.message,
        threadId,
        locale,
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
});
