import type { AppLang } from "@/lib/i18n/app-lang";
import type { SupportConversationMemory } from "@/modules/support-chat/lib/conversation-memory";
import type { SupportIntentTriageResult } from "@/modules/support-chat/server/intent-triage";

export type SupportTriageEvalCase = {
  id: string;
  locale: AppLang;
  message: string;
  memory?: SupportConversationMemory;
  expected: Partial<SupportIntentTriageResult>;
  notIntent?: SupportIntentTriageResult["intent"];
};

export const SUPPORT_TRIAGE_EVAL_CASES: SupportTriageEvalCase[] = [
  {
    id: "de-scheduled-booking-follow-up",
    locale: "de",
    message: "Meine Buchung ist geplant.",
    memory: {
      previousUserMessage: "Ich brauche Hilfe mit einer Buchung.",
      previousAssistantMessage: "Welche Art von Buchungshilfe brauchst du?",
      activeTopic: "booking",
      hasSelectedOrderContext: false,
      lastAssistantAskedForSelection: false,
    },
    expected: {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "scheduled",
      confidence: "high",
    },
  },
  {
    id: "en-scheduled-booking-follow-up",
    locale: "en",
    message: "It is scheduled.",
    memory: {
      previousUserMessage: "I need help with a booking.",
      previousAssistantMessage: "What kind of booking help do you need?",
      activeTopic: "booking",
      hasSelectedOrderContext: false,
      lastAssistantAskedForSelection: false,
    },
    expected: {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "scheduled",
      confidence: "high",
    },
  },
  {
    id: "generic-cancellation-policy",
    locale: "en",
    message: "How does cancellation work?",
    expected: {
      topic: "cancellation",
    },
    notIntent: "account_candidate_lookup",
  },
];
