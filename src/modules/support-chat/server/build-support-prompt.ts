import "server-only";

import { type AppLang } from "@/lib/i18n/app-lang";
import { type SupportKnowledgeMatch } from "@/modules/support-chat/server/retrieve-knowledge";

export type BuildSupportPromptInput = {
  message: string;
  locale: AppLang;
  sources: SupportKnowledgeMatch[];
};

export function buildSupportPrompt(input: BuildSupportPromptInput) {
  // Keep this helper formatting-only; support decisions stay in the orchestrator.
  const context = input.sources
    .map(
      (source, index) => `Source ${index + 1}
Document: ${source.documentId}
Version: ${source.documentVersion}
Section: ${source.sectionId}
Source type: ${source.sourceType}
Content:
${source.text}`
    )
    .join("\n\n---\n\n");

  return {
    instructions: `You are Infinisimo support chat.
Answer only from the provided support context.
Do not invent policy, account state, order state, payment state, or platform actions.
Do not present legal, financial, tax, medical, or other professional advice beyond platform rules.
Answer concisely and operationally.
Use the requested locale (${input.locale}) if possible, but do not invent untranslated policy meaning.
If the context is not enough, say you are not certain and direct the user to support.`,
    input: `Support context:
${context}

User question:
${input.message}`,
  };
}
