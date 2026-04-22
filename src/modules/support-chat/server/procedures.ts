import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { SUPPORTED_APP_LANGS } from "@/lib/i18n/app-lang";
import {
  SUPPORT_CHAT_ACCOUNT_AWARE,
  SUPPORT_CHAT_PHASE,
  SUPPORT_CHAT_PUBLIC_ACCESS,
} from "@/modules/support-chat/lib/boundaries";
import { SUPPORT_CHAT_CAPABILITIES } from "@/modules/support-chat/lib/scope";
import { generateSupportResponse } from "@/modules/support-chat/server/generate-support-response";
import { persistSupportInteraction } from "@/modules/support-chat/server/persist-support-interaction";
import { z } from "zod";

export const supportChatRouter = createTRPCRouter({
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
        message: z.string().max(2000),
        threadId: z.string().uuid().optional(),
        locale: z.enum(SUPPORTED_APP_LANGS).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const locale = input.locale ?? ctx.appLang;
      const response = await generateSupportResponse({
        message: input.message,
        threadId: input.threadId,
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
