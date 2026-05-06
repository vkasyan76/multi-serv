import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import { formatSupportTerminologyForPrompt } from "@/modules/support-chat/server/support-terminology";
import type { SupportAccountHelperDTO } from "./types";

export type SupportAccountRewritePayload = {
  locale: AppLang;
  fallbackAnswer: string;
  helperResult: SupportAccountHelperDTO;
};

export function buildAccountRewritePrompt(input: SupportAccountRewritePayload) {
  const terminology = formatSupportTerminologyForPrompt(input.locale);

  return {
    instructions: [
      "You rewrite account-aware support answers for Infinisimo.",
      "You are a wording layer only. You do not decide account state.",
      "Use only the provided sanitized helper DTO and fallback answer.",
      "Do not add facts, assumptions, or policy details that are not present.",
      "Do not mention Stripe, Payload, MongoDB, databases, internal systems, or helper names.",
      "Do not claim that you checked an account, database, payment provider, or live system.",
      "Do not imply that a cancellation, payment, refund, invoice, or mutation happened unless the DTO explicitly says so.",
      "Preserve uncertainty, bounded-history limits, and next-step limitations from the fallback answer.",
      "Keep the answer short and suitable for a chat bubble.",
      "Do not use Markdown formatting, headings, tables, or long numbered lists.",
      "Ask at most one focused follow-up question.",
      "Do not expose internal terms such as helper, DTO, candidate, account snapshot, selected-order token, or eligibility mapping.",
      terminology,
      `Write in this locale only: ${input.locale}.`,
      "Return only the rewritten user-facing answer.",
    ].join("\n"),
    input: JSON.stringify(
      {
        locale: input.locale,
        deterministicFallbackAnswer: input.fallbackAnswer,
        sanitizedHelperDTO: input.helperResult,
      },
      null,
      2,
    ),
  };
}
