import test from "node:test";
import assert from "node:assert/strict";

import { SUPPORTED_APP_LANGS, type AppLang } from "@/lib/i18n/app-lang";
import enSupportChat from "@/i18n/messages/en/supportChat.json";
import deSupportChat from "@/i18n/messages/de/supportChat.json";
import frSupportChat from "@/i18n/messages/fr/supportChat.json";
import itSupportChat from "@/i18n/messages/it/supportChat.json";
import esSupportChat from "@/i18n/messages/es/supportChat.json";
import ptSupportChat from "@/i18n/messages/pt/supportChat.json";
import plSupportChat from "@/i18n/messages/pl/supportChat.json";
import roSupportChat from "@/i18n/messages/ro/supportChat.json";
import ukSupportChat from "@/i18n/messages/uk/supportChat.json";
import {
  detectSupportChatStarterTopic,
  type SupportChatTopic,
} from "./topics";

type StarterPromptKey = "booking" | "payment" | "cancel" | "provider";

const SUPPORT_CHAT_COPY: Record<
  AppLang,
  { suggestionPrompts: Record<StarterPromptKey, string> }
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

const EXPECTED_TOPICS: Record<StarterPromptKey, SupportChatTopic> = {
  booking: "booking",
  payment: "payment",
  cancel: "cancellation",
  provider: "provider_onboarding",
};

test("detects English starter prompts", () => {
  assert.deepEqual(
    detectSupportChatStarterTopic({
      message: "I need help with a booking.",
      locale: "en",
    }),
    { topic: "booking", source: "starter_prompt" }
  );
  assert.deepEqual(
    detectSupportChatStarterTopic({
      message: "I have a payment question.",
      locale: "en",
    }),
    { topic: "payment", source: "starter_prompt" }
  );
  assert.deepEqual(
    detectSupportChatStarterTopic({
      message: "I need help canceling a booking.",
      locale: "en",
    }),
    { topic: "cancellation", source: "starter_prompt" }
  );
  assert.deepEqual(
    detectSupportChatStarterTopic({
      message: "I want to become a provider.",
      locale: "en",
    }),
    { topic: "provider_onboarding", source: "starter_prompt" }
  );
});

test("detects Spanish provider starter prompt", () => {
  assert.deepEqual(
    detectSupportChatStarterTopic({
      message: "Quiero convertirme en proveedor.",
      locale: "es",
    }),
    { topic: "provider_onboarding", source: "starter_prompt" }
  );
});

test("detects starter prompts across launched locales", () => {
  for (const locale of SUPPORTED_APP_LANGS) {
    for (const key of Object.keys(EXPECTED_TOPICS) as StarterPromptKey[]) {
      const result = detectSupportChatStarterTopic({
        message: SUPPORT_CHAT_COPY[locale].suggestionPrompts[key],
        locale,
      });

      assert.deepEqual(
        result,
        { topic: EXPECTED_TOPICS[key], source: "starter_prompt" },
        `${locale}:${key}`
      );
    }
  }
});

test("normalizes starter prompt whitespace only", () => {
  assert.deepEqual(
    detectSupportChatStarterTopic({
      message: "  I   want to become a provider.  ",
      locale: "en",
    }),
    { topic: "provider_onboarding", source: "starter_prompt" }
  );
});

test("matches English fallback starter prompts outside English locale", () => {
  assert.deepEqual(
    detectSupportChatStarterTopic({
      message: "I want to become a provider.",
      locale: "es",
    }),
    { topic: "provider_onboarding", source: "starter_prompt" }
  );
});

test("does not fuzzy-match similar free-form topic questions", () => {
  for (const message of [
    "How do I become a provider?",
    "I want provider setup help.",
    "Can you help me with a reservation?",
    "I have a billing question.",
  ]) {
    assert.equal(
      detectSupportChatStarterTopic({ message, locale: "en" }),
      null,
      message
    );
  }
});
