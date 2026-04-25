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

type SupportChatServerCopy = {
  serverMessages: {
    rateLimit: string;
    outage: string;
    empty: string;
    abusive: string;
    nonsense: string;
    clarify: string;
    unsupportedAccount: string;
    uncertain: string;
  };
};

const SUPPORT_CHAT_SERVER_COPY: Record<AppLang, SupportChatServerCopy> = {
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

export function getSupportChatCopy(locale: AppLang): SupportChatServerCopy {
  return SUPPORT_CHAT_SERVER_COPY[locale] ?? SUPPORT_CHAT_SERVER_COPY.en;
}
