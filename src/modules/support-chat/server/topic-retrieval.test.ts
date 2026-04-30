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
import { retrieveSupportKnowledge } from "@/modules/support-chat/server/retrieve-knowledge";
import {
  applyTopicRetrievalBias,
  getPreferredTopicSectionIds,
  topicRetrievalQuery,
} from "@/modules/support-chat/server/topic-retrieval";
import {
  createSupportTopicContext,
  isSupportTopicContextFollowUp,
  detectSupportChatStarterTopic,
  type SupportChatTopic,
} from "@/modules/support-chat/server/topics";

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

const STARTER_TO_TOPIC: Record<StarterPromptKey, SupportChatTopic> = {
  booking: "booking",
  payment: "payment",
  cancel: "cancellation",
  provider: "provider_onboarding",
};

async function retrieveForStarter(locale: AppLang, key: StarterPromptKey) {
  const prompt = SUPPORT_CHAT_COPY[locale].suggestionPrompts[key];
  const topic = detectSupportChatStarterTopic({ message: prompt, locale });
  assert.ok(topic, `${locale}:${key} should detect a starter topic`);

  const matches = await retrieveSupportKnowledge({
    query: topicRetrievalQuery({ message: prompt, topic }),
    locale,
    limit: 10,
  });

  return applyTopicRetrievalBias({ matches, topic });
}

function topSectionIds(matches: Array<{ sectionId: string }>, count = 3) {
  return matches.slice(0, count).map((match) => match.sectionId);
}

function assertPreferredInTop(input: {
  locale: AppLang;
  key: StarterPromptKey;
  matches: Array<{ sectionId: string }>;
  top?: number;
}) {
  const topic = STARTER_TO_TOPIC[input.key];
  const preferred = new Set(getPreferredTopicSectionIds(topic));
  const topIds = topSectionIds(input.matches, input.top);

  assert.ok(
    topIds.some((sectionId) => preferred.has(sectionId)),
    `${input.locale}:${input.key} expected preferred ${topic} section in top ${input.top ?? 3}; got ${topIds.join(", ")}`
  );
}

test("Spanish provider starter retrieves provider-onboarding sections", async () => {
  const matches = await retrieveForStarter("es", "provider");
  const topIds = topSectionIds(matches, 5);

  assertPreferredInTop({
    locale: "es",
    key: "provider",
    matches,
    top: 3,
  });
  assert.ok(
    topIds.some((sectionId) => sectionId.startsWith("provider-")),
    `expected provider onboarding section in top 5; got ${topIds.join(", ")}`
  );
  assert.notEqual(
    matches[0]?.sectionId,
    "calendar-requested-slots",
    "provider starter should not be led by requested-booking calendar material"
  );
});

test("provider starter retrieval is biased across launched locales", async () => {
  for (const locale of SUPPORTED_APP_LANGS) {
    const matches = await retrieveForStarter(locale, "provider");
    assertPreferredInTop({ locale, key: "provider", matches, top: 3 });
  }
});

test("booking, payment, and cancellation starters prefer their topic sections across launched locales", async () => {
  for (const locale of SUPPORTED_APP_LANGS) {
    for (const key of ["booking", "payment", "cancel"] as StarterPromptKey[]) {
      const matches = await retrieveForStarter(locale, key);
      assertPreferredInTop({ locale, key, matches, top: 5 });
    }
  }
});

test("topic retrieval query leaves untopicized messages unchanged", () => {
  const message = "How do I use the marketplace?";

  assert.equal(topicRetrievalQuery({ message }), message);
});

test("topic bias leaves matches unchanged without a topic", async () => {
  const matches = await retrieveSupportKnowledge({
    query: "provider setup",
    locale: "en",
    limit: 3,
  });

  assert.deepEqual(applyTopicRetrievalBias({ matches }), matches);
});

test("provider follow-up context reuses provider-onboarding retrieval bias", async () => {
  const context = createSupportTopicContext({
    topic: "provider_onboarding",
    source: "starter_prompt",
  });
  const message = "what next?";
  assert.equal(isSupportTopicContextFollowUp({ message, context }), true);

  const topic = { topic: context.topic, source: "follow_up" as const };
  const matches = applyTopicRetrievalBias({
    matches: await retrieveSupportKnowledge({
      query: topicRetrievalQuery({ message, topic }),
      locale: "en",
      limit: 10,
    }),
    topic,
  });

  assertPreferredInTop({ locale: "en", key: "provider", matches, top: 3 });
});

test("Ukrainian cancellation term reuses cancellation retrieval bias only with context", async () => {
  const message = "скасувати";
  const context = createSupportTopicContext({
    topic: "cancellation",
    source: "starter_prompt",
  });
  assert.equal(isSupportTopicContextFollowUp({ message, context }), true);

  const topic = { topic: context.topic, source: "follow_up" as const };
  const matches = applyTopicRetrievalBias({
    matches: await retrieveSupportKnowledge({
      query: topicRetrievalQuery({ message, topic }),
      locale: "uk",
      limit: 10,
    }),
    topic,
  });
  assertPreferredInTop({ locale: "uk", key: "cancel", matches, top: 3 });

  const untopicizedMatches = await retrieveSupportKnowledge({
    query: topicRetrievalQuery({ message }),
    locale: "uk",
    limit: 10,
  });

  assert.equal(
    topSectionIds(untopicizedMatches, 3).some((sectionId) =>
      new Set(getPreferredTopicSectionIds("cancellation")).has(sectionId)
    ),
    false
  );
});
