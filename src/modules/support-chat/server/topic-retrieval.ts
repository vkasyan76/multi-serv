import "server-only";

import type { SupportKnowledgeMatch } from "@/modules/support-chat/server/retrieve-knowledge";
import type {
  SupportChatTopic,
  SupportChatTopicDetection,
} from "@/modules/support-chat/server/topics";

type SupportTopicRetrievalProfile = {
  retrievalQuery: string;
  preferredSectionIds: readonly string[];
};

const TOPIC_SCORE_BOOST = 20;

const TOPIC_RETRIEVAL_PROFILES: Record<
  SupportChatTopic,
  SupportTopicRetrievalProfile
> = {
  booking: {
    retrievalQuery:
      "customer booking request booking requirements provider confirmation scheduled booking slots availability orders service lifecycle payment later",
    preferredSectionIds: [
      "faq-customer-start",
      "booking-customer-requirements",
      "booking-order-created-payment-later",
      "booking-service-lifecycle",
      "calendar-available-future-slots",
      "calendar-requested-slots",
      "calendar-slot-statuses",
    ],
  },
  payment: {
    retrievalQuery:
      "payment question payment method payment requested invoice paid pending provider payout stripe onboarding payment issue fees currency",
    preferredSectionIds: [
      "booking-payment-method",
      "booking-order-created-payment-later",
      "booking-service-lifecycle",
      "booking-provider-payment-request",
      "booking-payment-issues",
      "booking-currency-and-fees",
      "terms-payments",
      "terms-confirmations-disputes-deadlines",
    ],
  },
  cancellation: {
    retrievalQuery:
      "cancel booking cancellation requested booking scheduled booking cancellation window provider decline release slots",
    preferredSectionIds: [
      "booking-cancellation-window",
      "terms-cancellations",
      "calendar-requested-slots",
    ],
  },
  provider_onboarding: {
    retrievalQuery:
      "provider setup general profile location terms provider profile business name categories services hourly rate vat stripe onboarding payouts availability calendar",
    preferredSectionIds: [
      "provider-who-can-become-provider",
      "provider-terms-before-provider-profile",
      "provider-profile-fields",
      "provider-business-name-url",
      "provider-categories-and-services",
      "provider-hourly-rate",
      "provider-vat",
      "provider-payouts-stripe",
      "provider-availability-next-step",
      "faq-provider-start",
    ],
  },
};

function topicProfile(topic?: SupportChatTopicDetection | null) {
  return topic ? TOPIC_RETRIEVAL_PROFILES[topic.topic] : null;
}

export function getPreferredTopicSectionIds(topic: SupportChatTopic) {
  return TOPIC_RETRIEVAL_PROFILES[topic].preferredSectionIds;
}

export function topicRetrievalQuery(input: {
  message: string;
  topic?: SupportChatTopicDetection | null;
}) {
  const profile = topicProfile(input.topic);
  if (!profile) return input.message;

  // Topic terms are server-owned English anchors for the English knowledge pack.
  // They compensate for localized starter prompts without turning free text into
  // broad semantic routing.
  return `${input.message}\n\n${profile.retrievalQuery}`;
}

export function applyTopicRetrievalBias(input: {
  matches: SupportKnowledgeMatch[];
  topic?: SupportChatTopicDetection | null;
}): SupportKnowledgeMatch[] {
  const profile = topicProfile(input.topic);
  if (!profile) return input.matches;

  const preferred = new Set(profile.preferredSectionIds);

  return input.matches
    .map((match) => ({
      ...match,
      score: preferred.has(match.sectionId)
        ? match.score + TOPIC_SCORE_BOOST
        : match.score,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.documentId.localeCompare(b.documentId) ||
        a.sectionId.localeCompare(b.sectionId)
    );
}
