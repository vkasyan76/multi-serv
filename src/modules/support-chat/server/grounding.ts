import type { SupportAccountContextSnapshot } from "@/modules/support-chat/server/account-aware/server-responses";
import type { SupportChatSource } from "@/modules/support-chat/server/generate-support-response";

export type SupportGroundingKind = "knowledge" | "account_safe_dto" | "none";

export type SupportGroundingInput =
  | { kind: "knowledge"; sources: SupportChatSource[] }
  | {
      kind: "account_safe_dto";
      snapshots: SupportAccountContextSnapshot[];
    }
  | { kind: "none" };

export function resolveSupportGroundingKind(input: {
  sources?: SupportChatSource[];
  accountContextSnapshots?: SupportAccountContextSnapshot[];
}): SupportGroundingKind {
  if (input.accountContextSnapshots?.length) return "account_safe_dto";
  if (input.sources?.length) return "knowledge";
  return "none";
}
