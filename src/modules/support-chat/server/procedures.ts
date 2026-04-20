import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import {
  SUPPORT_CHAT_ACCOUNT_AWARE,
  SUPPORT_CHAT_PHASE,
  SUPPORT_CHAT_PUBLIC_ACCESS,
} from "@/modules/support-chat/lib/boundaries";

export const supportChatRouter = createTRPCRouter({
  getBootstrap: baseProcedure.query(async () => {
    return {
      phase: SUPPORT_CHAT_PHASE,
      accountAware: SUPPORT_CHAT_ACCOUNT_AWARE,
      publicAccess: SUPPORT_CHAT_PUBLIC_ACCESS,
    };
  }),
});
