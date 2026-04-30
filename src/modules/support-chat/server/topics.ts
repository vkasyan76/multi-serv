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
  source: "starter_prompt" | "follow_up";
};

export type SupportTopicContext = {
  type: "support_topic";
  topic: SupportChatTopic;
  source: SupportChatTopicDetection["source"];
  selectedAt: string;
  expiresAt: string;
  continuationTerms?: string[];
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

const TOPIC_CONTEXT_TTL_MS = 30 * 60 * 1000;
const MAX_FOLLOW_UP_CHARS = 60;
const MAX_FOLLOW_UP_WORDS = 5;

const GENERIC_FOLLOW_UP_PHRASES = [
  "what next",
  "what now",
  "what do i do next",
  "how",
  "how do i do that",
  "where",
  "where can i find it",
  "tell me more",
  "continue",
  "que sigue",
  "qué sigue",
  "como",
  "cómo",
  "donde",
  "dónde",
  "cuentame mas",
  "cuéntame más",
  "ensuite",
  "comment",
  "ou",
  "où",
  "dites m en plus",
  "was jetzt",
  "wie",
  "wo",
  "mehr",
  "cosa devo fare",
  "come",
  "dove",
  "dimmi di piu",
  "dimmi di più",
  "o que segue",
  "como",
  "onde",
  "conte me mais",
  "co dalej",
  "jak",
  "gdzie",
  "powiedz wiecej",
  "powiedz więcej",
  "ce urmeaza",
  "ce urmează",
  "cum",
  "unde",
  "spune mi mai mult",
  "що далі",
  "як",
  "де",
  "розкажи більше",
] as const;

const CONTINUATION_TERMS: Record<SupportChatTopic, readonly string[]> = {
  booking: [
    "booking",
    "reservation",
    "order",
    "slot",
    "book",
    "reserva",
    "pedido",
    "reservacion",
    "réservation",
    "commande",
    "buchung",
    "bestellung",
    "prenotazione",
    "ordine",
    "rezerwacja",
    "zamowienie",
    "zamówienie",
    "rezervare",
    "comanda",
    "бронювання",
    "замовлення",
  ],
  payment: [
    "payment",
    "invoice",
    "paid",
    "pay",
    "pago",
    "factura",
    "pagado",
    "paiement",
    "facture",
    "payé",
    "zahlung",
    "rechnung",
    "bezahlt",
    "pagamento",
    "fattura",
    "pagato",
    "platnosc",
    "płatność",
    "faktura",
    "zaplacone",
    "zapłacone",
    "plata",
    "plată",
    "achitat",
    "оплата",
    "рахунок",
    "сплачено",
  ],
  cancellation: [
    "cancel",
    "cancellation",
    "cancelar",
    "cancelacion",
    "cancelación",
    "annuler",
    "annulation",
    "stornieren",
    "stornierung",
    "scheduled",
    "already scheduled",
    "requested",
    "awaiting confirmation",
    "geplant",
    "schon geplant",
    "bereits geplant",
    "angefragt",
    "wartet auf bestatigung",
    "wartet auf bestaetigung",
    "annullare",
    "annullamento",
    "anular",
    "cancelar",
    "anulowac",
    "anulować",
    "anulowanie",
    "anuleaza",
    "anulează",
    "anulare",
    "скасувати",
    "скасування",
  ],
  provider_onboarding: [
    "provider",
    "profile",
    "stripe",
    "availability",
    "dashboard",
    "proveedor",
    "perfil",
    "disponibilidad",
    "panel",
    "prestataire",
    "profil",
    "disponibilité",
    "tableau",
    "anbieter",
    "profil",
    "verfügbarkeit",
    "dashboard",
    "fornitore",
    "professionista",
    "profilo",
    "disponibilita",
    "disponibilità",
    "fornecedor",
    "perfil",
    "disponibilidade",
    "dostawca",
    "profil",
    "dostepnosc",
    "dostępność",
    "furnizor",
    "profil",
    "disponibilitate",
    "постачальник",
    "профіль",
    "доступність",
    "панель",
  ],
};

function normalizeStarterPrompt(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function normalizeFollowUpText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isShortFollowUpMessage(message: string) {
  const normalized = normalizeFollowUpText(message);
  if (!normalized || normalized.length > MAX_FOLLOW_UP_CHARS) return false;

  return normalized.split(/\s+/g).length <= MAX_FOLLOW_UP_WORDS;
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

export function createSupportTopicContext(input: {
  topic: SupportChatTopic;
  source: SupportChatTopicDetection["source"];
  now?: Date;
}): SupportTopicContext {
  const now = input.now ?? new Date();

  return {
    type: "support_topic",
    topic: input.topic,
    source: input.source,
    selectedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TOPIC_CONTEXT_TTL_MS).toISOString(),
    continuationTerms: [...CONTINUATION_TERMS[input.topic]],
  };
}

export function isSupportTopicContextValid(
  context: SupportTopicContext | null | undefined,
  now: Date = new Date()
): context is SupportTopicContext {
  if (!context || context.type !== "support_topic") return false;
  if (!context.topic || !context.expiresAt) return false;
  if (!(context.topic in CONTINUATION_TERMS)) return false;

  return new Date(context.expiresAt).getTime() > now.getTime();
}

export function isSupportTopicContextFollowUp(input: {
  message: string;
  context?: SupportTopicContext | null;
  now?: Date;
}) {
  if (!isSupportTopicContextValid(input.context, input.now)) return false;
  if (!isShortFollowUpMessage(input.message)) return false;

  const normalized = normalizeFollowUpText(input.message);
  if (!normalized) return false;

  if (
    GENERIC_FOLLOW_UP_PHRASES.some(
      (phrase) => normalizeFollowUpText(phrase) === normalized
    )
  ) {
    return true;
  }

  return CONTINUATION_TERMS[input.context.topic].some(
    (term) => normalizeFollowUpText(term) === normalized
  );
}
