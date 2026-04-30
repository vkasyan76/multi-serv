import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import enSupportChat from "@/i18n/messages/en/supportChat.json";
import deSupportChat from "@/i18n/messages/de/supportChat.json";
import frSupportChat from "@/i18n/messages/fr/supportChat.json";
import itSupportChat from "@/i18n/messages/it/supportChat.json";
import esSupportChat from "@/i18n/messages/es/supportChat.json";
import ptSupportChat from "@/i18n/messages/pt/supportChat.json";
import plSupportChat from "@/i18n/messages/pl/supportChat.json";
import roSupportChat from "@/i18n/messages/ro/supportChat.json";
import ukSupportChat from "@/i18n/messages/uk/supportChat.json";

export type SupportChatTopic =
  | "booking"
  | "payment"
  | "cancellation"
  | "provider_onboarding";

export type SupportChatTopicDetection = {
  topic: SupportChatTopic;
  source: "starter_prompt";
};

type SupportChatStarterPromptKey =
  | "booking"
  | "payment"
  | "cancel"
  | "provider";

type SupportChatStarterPromptCopy = {
  suggestionPrompts: Record<SupportChatStarterPromptKey, string>;
};

const SUPPORT_CHAT_STARTER_PROMPTS: Record<
  AppLang,
  SupportChatStarterPromptCopy
> = {
  en: enSupportChat,
  de: deSupportChat,
  fr: frSupportChat,
  it: itSupportChat,
  es: esSupportChat,
  pt: ptSupportChat,
  pl: plSupportChat,
  ro: roSupportChat,
  uk: ukSupportChat,
};

const STARTER_PROMPT_TOPICS: Record<
  SupportChatStarterPromptKey,
  SupportChatTopic
> = {
  booking: "booking",
  payment: "payment",
  cancel: "cancellation",
  provider: "provider_onboarding",
};

function normalizeStarterPrompt(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function starterPromptEntries(locale: AppLang) {
  const localeCopy = SUPPORT_CHAT_STARTER_PROMPTS[locale];
  const fallbackCopy = SUPPORT_CHAT_STARTER_PROMPTS.en;

  // Match only UI-owned starter prompts. General free text and fuzzy topic
  // detection belong to later topic-routing work, not this contract layer.
  return [localeCopy, fallbackCopy].flatMap((copy) =>
    Object.entries(copy.suggestionPrompts).map(([key, prompt]) => ({
      topic: STARTER_PROMPT_TOPICS[key as SupportChatStarterPromptKey],
      prompt: normalizeStarterPrompt(prompt),
    }))
  );
}

export function detectSupportChatStarterTopic(input: {
  message: string;
  locale: AppLang;
}): SupportChatTopicDetection | null {
  const normalizedMessage = normalizeStarterPrompt(input.message);
  if (!normalizedMessage) return null;

  const match = starterPromptEntries(input.locale).find(
    (entry) => entry.prompt === normalizedMessage
  );

  return match ? { topic: match.topic, source: "starter_prompt" } : null;
}
