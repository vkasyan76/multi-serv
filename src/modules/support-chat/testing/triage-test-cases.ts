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
  {
    id: "fr-scheduled-cancellation-follow-up",
    locale: "fr",
    message: "Elle est deja confirmee.",
    memory: {
      previousUserMessage: "J'ai besoin d'aide pour annuler une reservation.",
      previousAssistantMessage: "Votre reservation est-elle demandee ou planifiee ?",
      activeTopic: "cancellation",
      hasSelectedOrderContext: false,
      lastAssistantAskedForSelection: false,
    },
    expected: {
      intent: "account_candidate_lookup",
      topic: "cancellation",
      statusFilter: "scheduled",
      confidence: "high",
    },
  },
  {
    id: "it-paid-payment-follow-up",
    locale: "it",
    message: "E gia pagato?",
    memory: {
      previousUserMessage: "Ho una domanda sul pagamento.",
      previousAssistantMessage: "La domanda riguarda un pagamento gia fatto o ancora dovuto?",
      activeTopic: "payment",
      hasSelectedOrderContext: false,
      lastAssistantAskedForSelection: false,
    },
    expected: {
      intent: "account_candidate_lookup",
      topic: "payment",
      statusFilter: "paid",
      confidence: "high",
    },
  },
  {
    id: "unsafe-cancel-now",
    locale: "en",
    message: "Cancel my booking now.",
    expected: {
      intent: "unsafe_mutation",
      topic: "cancellation",
      confidence: "high",
    },
  },
  {
    id: "broad-export-payments",
    locale: "en",
    message: "Export my payments.",
    expected: {
      intent: "unsupported_account_scope",
      topic: "payment",
      confidence: "high",
    },
  },
];
