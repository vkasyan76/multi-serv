import "server-only";

import { type AppLang } from "@/lib/i18n/app-lang";
import { type SupportKnowledgeMatch } from "@/modules/support-chat/server/retrieve-knowledge";

export type BuildSupportPromptInput = {
  message: string;
  locale: AppLang;
  sources: SupportKnowledgeMatch[];
};

const SUPPORT_CHAT_GUARDRAILS = [
  "Answer only from the provided support context.",
  "Do not invent policy, process, deadlines, fees, refunds, or platform actions.",
  "Do not rely on general marketplace/common-practice assumptions.",
  "Do not claim to inspect live order, payment, invoice, account, Stripe, Payload, or database state.",
  "If the support context is unclear or incomplete, say you are not certain.",
  "If the user asks for account-specific help, explain that this chat can only provide general guidance.",
  "If the request is ambiguous, ask one short clarifying question instead of guessing.",
  "Keep answers concise, practical, and support-oriented.",
  "Answer in the requested route locale when safe.",
  "If the source material is thin or only available in another language, stay conservative.",
  "Do not creatively translate or extend policy meaning.",
  "If the source is not clear enough, say so and hand off.",
] as const;

export function buildSupportPrompt(input: BuildSupportPromptInput) {
  // Keep this helper formatting-only; support decisions stay in the orchestrator.
  const sourceLocales = Array.from(
    new Set(input.sources.map((source) => source.locale))
  ).join(", ");
  const context = input.sources
    .map(
      (source, index) => `Source ${index + 1}
Document: ${source.documentId}
Version: ${source.documentVersion}
Locale: ${source.locale}
Section: ${source.sectionId}
Source type: ${source.sourceType}
Content:
${source.text}`
    )
    .join("\n\n---\n\n");

  return {
    instructions: `You are Infinisimo support chat.
Requested locale: ${input.locale}
Knowledge locales in context: ${sourceLocales}

${SUPPORT_CHAT_GUARDRAILS.map((rule) => `- ${rule}`).join("\n")}`,
    input: `Support context:
${context}

User question:
${input.message}`,
  };
}
