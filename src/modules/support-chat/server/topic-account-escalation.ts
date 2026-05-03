import "server-only";

import type { AccountCandidateSelectionHelper } from "@/modules/support-chat/server/account-aware/action-tokens";
import type { SupportOrderCandidateStatusFilter } from "@/modules/support-chat/server/account-aware/types";
import type { SupportTopicContext } from "@/modules/support-chat/server/topics";
import { isSupportTopicContextValid } from "@/modules/support-chat/server/topics";

export type TopicAccountEscalation = {
  statusFilter?: SupportOrderCandidateStatusFilter;
  selectionHelper: AccountCandidateSelectionHelper;
};

const MAX_ESCALATION_CHARS = 80;
const MAX_ESCALATION_WORDS = 6;

const STATUS_PATTERNS = {
  requested: [
    /\brequested\b/u,
    /\bawaiting\s+(provider\s+)?confirmation\b/u,
    /\bsolicitad[ao]\b/u,
    /\bpendiente\s+de\s+confirmacion\b/u,
    /\bdemandee?\b/u,
    /\ben\s+attente\s+de\s+confirmation\b/u,
    /\bangefragt\b/u,
    /\bwartet\s+auf\s+bestatigung\b/u,
    /\brichiesta\b/u,
    /\bin\s+attesa\s+di\s+conferma\b/u,
    /\baguardando\s+confirmacao\b/u,
    /\boczekuje\s+na\s+potwierdzenie\b/u,
    /\bsolicitata\b/u,
    /\bin\s+asteptarea\s+confirmarii\b/u,
    /очікує\s+підтвердження/u,
    /запит/u,
  ],
  scheduled: [
    /\bscheduled\b/u,
    /\bconfirmed\b/u,
    /\balready\s+scheduled\b/u,
    /\bprogramad[ao]\b/u,
    /\bconfirmad[ao]\b/u,
    /\bya\s+programad[ao]\b/u,
    /\bplanifiee?\b/u,
    /\bconfirmee?\b/u,
    /\bgeplante?\b/u,
    /\bbestatigt\b/u,
    /\bprogrammata\b/u,
    /\bconfermata\b/u,
    /\bagendad[ao]\b/u,
    /\bzaplanowan[ae]\b/u,
    /\bpotwierdzon[ae]\b/u,
    /\bprogramata\b/u,
    /\bconfirmata\b/u,
    /запланован[ае]/u,
    /підтверджен[ае]/u,
    /вже\s+запланован[ае]/u,
  ],
  canceled: [
    /\bcancell?ed\b/u,
    /\bcancelad[ao]\b/u,
    /\bannulee?\b/u,
    /\bstorniert\b/u,
    /\bannullata\b/u,
    /\banulad[ao]\b/u,
    /\banulowan[ae]\b/u,
    /\banulata\b/u,
    /скасован[ае]/u,
  ],
  paid: [
    /\bpaid\b/u,
    /\bpagad[ao]\b/u,
    /\bpaye[e]?\b/u,
    /\bbezahlt\b/u,
    /\bpagato\b/u,
    /\bzaplacon[ey]\b/u,
    /\bachitat[ae]?\b/u,
    /сплачен[ое]/u,
  ],
  paymentPending: [
    /\bpending\b/u,
    /\bunpaid\b/u,
    /\bdue\b/u,
    /\bpendiente\b/u,
    /\bsin\s+pagar\b/u,
    /\bimpagado\b/u,
    /\ben\s+attente\b/u,
    /\bnon\s+paye\b/u,
    /\bausstehend\b/u,
    /\bunbezahlt\b/u,
    /\bin\s+attesa\b/u,
    /\bnon\s+pagato\b/u,
    /\bpendente\b/u,
    /\bnao\s+pago\b/u,
    /\boczekuje\b/u,
    /\bniezaplacone\b/u,
    /неоплачен[ое]/u,
    /очікує\s+оплати/u,
  ],
  paymentNotDue: [
    /\bnot\s+due\b/u,
    /\bno\s+vence\b/u,
    /\bpas\s+encore\s+du\b/u,
    /\bnoch\s+nicht\s+fallig\b/u,
    /\bnon\s+ancora\s+dovuto\b/u,
    /\bainda\s+nao\s+vence\b/u,
    /\bjeszcze\s+nie\s+wymagalne\b/u,
    /\bnu\s+este\s+inca\s+scadent\b/u,
    /ще\s+не\s+настав/u,
  ],
} as const;

const PERSONAL_ACCOUNT_OBJECT_PATTERNS = [
  /\b(my|mine)\b.*\b(orders?|bookings?|payments?|invoices?)\b/u,
  /\bdo\s+i\s+have\b.*\b(orders?|bookings?|payments?|invoices?)\b/u,
  /\bwhich\b.*\b(orders?|bookings?)\b.*\b(can|could)\s+i\b/u,
  /які.*(замовлення|бронювання).*(можу|можна)/u,
  /\b(orders?|bookings?)\b.*\bi\b.*\bcancel\b/u,
  /\bmeine\b.*\bbuchung\b/u,
  /\bmeine[rmn]?\b.*\b(buchung(en)?|bestellungen?|zahlungen?|rechnungen?)\b/u,
  /\bbei\s+mir\b.*\b(buchung(en)?|bestellungen?|zahlungen?|rechnungen?)\b/u,
  /\bhabe\s+ich\b.*\b(buchung(en)?|bestellungen?|zahlungen?|rechnungen?)\b/u,
  /\bwelche\b.*\b(buchung(en)?|bestellungen?)\b.*\bkann\s+ich\b/u,
  /\b(buchung(en)?|bestellungen?)\b.*\bich\b.*\bstornieren\b/u,
  /\b(ma|mon|mes)\b.*\b(commandes?|reservations?|paiements?|factures?)\b/u,
  /\bquelles?\b.*\b(commandes?|reservations?)\b.*\bpuis\s+je\b/u,
  /\bquelles?\b.*\b(commandes?|reservations?)\b.*\bpeux\s+je\b/u,
  /\b(mi|mis)\b.*\b(pedidos?|reservas?|pagos?|facturas?)\b/u,
  /\bque\b.*\b(pedidos?|reservas?)\b.*\bpuedo\b/u,
  /\b(mio|mia|miei|mie)\b.*\b(ordini?|prenotazioni?|pagamenti?|fatture?)\b/u,
  /\bquali\b.*\b(ordini?|prenotazioni?)\b.*\bposso\b/u,
  /\b(meu|minha|meus|minhas)\b.*\b(pedidos?|reservas?|pagamentos?|faturas?)\b/u,
  /\bquais\b.*\b(pedidos?|reservas?)\b.*\bposso\b/u,
  /\b(moj|moja|moje|moich)\b.*\b(zamowienia?|rezerwacje?|platnosci|faktury)\b/u,
  /\bktore\b.*\b(zamowienia?|rezerwacje?)\b.*\bmoge\b/u,
  /\b(meu|mea|mele)\b.*\b(comenzi|comanda|rezervari|rezervare|plati|facturi)\b/u,
  /\bce\b.*\b(comenzi|rezervari|rezervare)\b.*\bpot\b/u,
  /(моє|мою|мої|моїх).*(замовлення|бронювання|оплат|платеж|рахунок|рахунки)/u,
] as const;

const CANCELLATION_LOOKUP_PATTERNS = [
  /\bcancel\b/u,
  /\bcancelar\b/u,
  /скасувати/u,
  /\bstornieren\b/u,
  /\bstornierbar\b/u,
  /\bannuler\b/u,
  /\bannull\w+\b/u,
  /\banular\b/u,
  /\banul\w+\b/u,
  /скасувати/u,
] as const;

function normalizeEscalationText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(patterns: readonly RegExp[], value: string) {
  return patterns.some((pattern) => pattern.test(value));
}

function isShortEscalationMessage(message: string) {
  const normalized = normalizeEscalationText(message);
  if (!normalized || normalized.length > MAX_ESCALATION_CHARS) return false;
  return normalized.split(/\s+/g).length <= MAX_ESCALATION_WORDS;
}

export function detectTopicAccountEscalation(input: {
  message: string;
  context?: SupportTopicContext | null;
}): TopicAccountEscalation | null {
  if (!isSupportTopicContextValid(input.context)) return null;

  const text = normalizeEscalationText(input.message);
  if (!hasAny(PERSONAL_ACCOUNT_OBJECT_PATTERNS, text)) return null;

  const isExplicitCancellationLookup =
    input.context.topic === "cancellation" &&
    hasAny(CANCELLATION_LOOKUP_PATTERNS, text);

  if (!isShortEscalationMessage(input.message) && !isExplicitCancellationLookup) {
    return null;
  }

  if (input.context.topic === "cancellation") {
    if (hasAny(STATUS_PATTERNS.scheduled, text)) {
      return {
        statusFilter: "scheduled",
        selectionHelper: "canCancelOrderForCurrentUser",
      };
    }
    if (hasAny(STATUS_PATTERNS.requested, text)) {
      return {
        statusFilter: "requested",
        selectionHelper: "canCancelOrderForCurrentUser",
      };
    }
    if (hasAny(STATUS_PATTERNS.canceled, text)) {
      return {
        statusFilter: "canceled",
        selectionHelper: "getOrderStatusForCurrentUser",
      };
    }
    if (isExplicitCancellationLookup) {
      return {
        selectionHelper: "canCancelOrderForCurrentUser",
      };
    }
    return null;
  }

  if (input.context.topic === "payment") {
    if (hasAny(STATUS_PATTERNS.paid, text)) {
      return {
        statusFilter: "paid",
        selectionHelper: "getPaymentStatusForCurrentUser",
      };
    }
    if (hasAny(STATUS_PATTERNS.paymentNotDue, text)) {
      return {
        statusFilter: "payment_not_due",
        selectionHelper: "getPaymentStatusForCurrentUser",
      };
    }
    if (hasAny(STATUS_PATTERNS.paymentPending, text)) {
      return {
        statusFilter: "payment_pending",
        selectionHelper: "getPaymentStatusForCurrentUser",
      };
    }
    return null;
  }

  if (input.context.topic === "booking") {
    if (hasAny(STATUS_PATTERNS.scheduled, text)) {
      return {
        statusFilter: "scheduled",
        selectionHelper: "getOrderStatusForCurrentUser",
      };
    }
    if (hasAny(STATUS_PATTERNS.requested, text)) {
      return {
        statusFilter: "requested",
        selectionHelper: "getOrderStatusForCurrentUser",
      };
    }
  }

  return null;
}
