import "server-only";

import type { AccountCandidateSelectionHelper } from "./action-tokens";
import type {
  SupportAccountHelperInput,
  SupportAccountHelperName,
  SupportAccountReferenceType,
  SupportOrderCandidateStatusFilter,
} from "./types";
import {
  detectBroadOrDeferredIntent,
  detectCandidateSelectionIntent,
  detectCandidateStatusFilter,
  detectCancelEligibilityIntent,
  detectOrderStatusIntent,
  detectPaidOrderCandidateLookupIntent,
  detectPaymentOverviewIntent,
  detectPaymentStatusIntent,
  detectSelectedOrderCancelFollowUpIntent,
  detectSelectedOrderDetailFollowUpIntent,
  detectSelectedOrderPaymentFollowUpIntent,
  detectSelectedOrderStatusFollowUpIntent,
} from "./intent-normalizer";

type ExactReferenceSupportAccountHelperName = Exclude<
  SupportAccountHelperName,
  | "getSupportOrderCandidatesForCurrentUser"
  | "getRecentSupportOrderCandidatesForCurrentUser"
  | "getSupportPaymentOverviewForCurrentUser"
>;

export type SupportAccountResponseIntent = "invoice_lifecycle_explanation";

export type SupportAccountRoute =
  | {
      kind: "helper";
      helper: ExactReferenceSupportAccountHelperName;
      input: SupportAccountHelperInput;
      responseIntent?: SupportAccountResponseIntent;
    }
  | {
      kind: "missing_reference";
      helper: ExactReferenceSupportAccountHelperName;
      referenceType: SupportAccountReferenceType;
    }
  | {
      kind: "candidate_selection";
      selectionHelper: AccountCandidateSelectionHelper;
      statusFilter?: SupportOrderCandidateStatusFilter;
    }
  | { kind: "payment_overview" }
  | { kind: "unsupported_reference" }
  | { kind: "broad_or_deferred" }
  | { kind: "none" };

type RouteSupportAccountAwareOptions = {
  selectedOrder?: SupportAccountHelperInput & { referenceType: "order_id" };
  suppressCandidateSelection?: boolean;
};

const OBJECT_ID_RE = /\b[a-f0-9]{24}\b/gi;
const EXPLICIT_BAD_REF_RE =
  /\b(?:order|booking|invoice)\s*(?:id|#|number|reference|ref)\s*[:#-]?\s*([a-z0-9_-]{6,})\b/i;

const BROAD_OR_DEFERRED_PATTERNS = [
  /\bhistory\b/i,
  /\ball\s+(my\s+)?(orders|payments|invoices|bookings)\b/i,
  /\bcheck\s+my\s+account\b/i,
  /\bshow\s+(me\s+)?(my\s+)?(orders|payments|invoices|bookings)\b/i,
  /\b(all|every)\s+(of\s+)?(my\s+)?(orders|payments|invoices|bookings)\b/i,
  /\bpayment\s+history\b/i,
  /\border\s+history\b/i,
  /\binvoice\s+history\b/i,
];

const ALWAYS_BROAD_OR_DEFERRED_PATTERNS = [
  /\bhistory\b/i,
  /\bexport\b/i,
  /\ball\s+(my\s+)?(orders|payments|invoices|bookings)\b/i,
  /\b(all|every)\s+(of\s+)?(my\s+)?(orders|payments|invoices|bookings)\b/i,
  /\bpayment\s+history\b/i,
  /\border\s+history\b/i,
  /\binvoice\s+history\b/i,
];

const ORDER_STATUS_PATTERNS = [
  /\border\s+status\b/i,
  /\bbooking\s+status\b/i,
  /\bwhere\s+is\s+my\s+(order|booking)\b/i,
  /\bcheck\s+(my\s+)?(order|booking)\b/i,
  /\bstatus\s+of\s+(my\s+|this\s+|the\s+)?(order|booking)\b/i,
  /\bprovider\s+confirmed\s+(the\s+)?(order|booking)\b/i,
];

const PAYMENT_STATUS_PATTERNS = [
  /\bpayment\s+status\b/i,
  /\b(my\s+)?payment\s+go\s+through\b/i,
  /\bcheck\s+(my\s+)?payment\b/i,
  /\b(last|latest|recent|most\s+recent)\s+(payment|payments)\b/i,
  /\b(payment|payments)\s+(last|latest|recent)\b/i,
  /\bcharged\s+twice\b/i,
  /\bwhy\s+was\s+(my\s+)?card\s+charged\b/i,
  /\binvoice\b.*\bstatus\b/i,
  /\binvoice\s+status\b/i,
  /\bcheck\s+(my\s+)?invoice\b/i,
];

const PAYMENT_OVERVIEW_PATTERNS = [
  /\bdid\s+i\s+pay\s+already\b/i,
  /\bhave\s+i\s+paid\b/i,
  /\bpaid\s+already\b/i,
  /\bdo\s+i\s+have\s+(any\s+)?paid\s+(orders|bookings)\b/i,
  /\bany\s+paid\s+(orders|bookings)\b/i,
  /\bdo\s+i\s+have\s+unpaid\s+(orders|bookings)\b/i,
  /\bwhat\s+payments\s+are\s+still\s+pending\b/i,
  /\bwhich\s+payments\s+are\s+still\s+pending\b/i,
];

const CANCEL_ELIGIBILITY_PATTERNS = [
  /\bcan\s+i\s+cancel\s+(my\s+|this\s+|the\s+)?(?:last\s+|latest\s+|recent\s+|most\s+recent\s+)?(order|booking)\b/i,
  /\bcancel\s+(my\s+|this\s+|the\s+)?(?:last\s+|latest\s+|recent\s+|most\s+recent\s+)?(order|booking)\b/i,
  /\bcancelable\b/i,
  /\bcancellation\s+eligibility\b/i,
];

const DIRECT_MUTATION_PATTERNS = [
  /\bcancel\s+my\s+(order|booking)\s+now\b/i,
  /\bcancel\s+(this|the)\s+(order|booking)\s+now\b/i,
  /\bstorniere?\s+meine\s+(buchung|bestellung)\s+(jetzt|sofort)\b/i,
  /\bannule\s+(ma|mon|mes)\s+(commande|reservation)\b/i,
  /\b(cancela|anula)\s+(mi|mis)\s+(pedido|pedidos|reserva|reservas)\b/i,
  /\banuluj\s+(moje|moja|moj)\s+(zamowienie|rezerwacje?)\b/u,
  /\banuleaza\s+(comanda|rezervarea)\s+mea\b/u,
  /скасуй\s+(моє|мою|мої)\s+(замовлення|бронювання)/u,
] as const;

const PERSONAL_ACCOUNT_OBJECT_PATTERNS = [
  /\b(my|mine)\b.*\b(orders?|bookings?|payments?|invoices?)\b/u,
  /\b(orders?|bookings?|payments?|invoices?)\b.*\b(my|mine)\b/u,
  /\bdo\s+i\s+have\b.*\b(orders?|bookings?|payments?|invoices?)\b/u,
  /\b(orders?|bookings?)\b.*\bi\b.*\bcancel\b/u,
  /\bmeine\b.*\bbuchung\b/u,
  /\bmeine[rmn]?\b.*\b(buchungen?|bestellungen?|zahlungen?|rechnungen?)\b/u,
  /\b(buchungen?|bestellungen?|zahlungen?|rechnungen?)\b.*\bmeine[rmn]?\b/u,
  /\bbei\s+mir\b.*\b(buchungen?|bestellungen?|zahlungen?|rechnungen?)\b/u,
  /\bhabe\s+ich\b.*\b(buchungen?|bestellungen?|zahlungen?|rechnungen?)\b/u,
  /\b(buchungen?|bestellungen?)\b.*\bich\b.*\bstornieren\b/u,
  /\b(ma|mon|mes)\b.*\b(commandes?|reservations?|paiements?|factures?)\b/u,
  /\b(mi|mis)\b.*\b(pedidos?|reservas?|pagos?|facturas?)\b/u,
  /\b(mio|mia|miei|mie)\b.*\b(ordini?|prenotazioni?|pagamenti?|fatture?)\b/u,
  /\b(meu|minha|meus|minhas)\b.*\b(pedidos?|reservas?|pagamentos?|faturas?)\b/u,
  /\b(moj|moja|moje|moich)\b.*\b(zamowienia?|rezerwacje?|platnosci|faktury)\b/u,
  /\b(meu|mea|mele)\b.*\b(comenzi|comanda|rezervari|rezervare|plati|facturi)\b/u,
  /(моє|мою|мої|моїх).*(замовлення|бронювання|оплат|платеж|рахунок|рахунки)/u,
] as const;

const LIST_ACCOUNT_OBJECT_PATTERNS = [
  /\b(show|list|find|which)\b.*\b(orders?|bookings?|payments?|invoices?)\b/u,
  /\b(zeige|zeig|liste|finde|welche)\b.*\b(buchungen?|bestellungen?|zahlungen?|rechnungen?)\b/u,
  /\b(afficher|quelles?|quels?)\b.*\b(commandes?|reservations?|paiements?|factures?)\b/u,
  /\b(mostra|quali)\b.*\b(ordini?|prenotazioni?|pagamenti?|fatture?)\b/u,
  /\b(mostrar|que)\b.*\b(pedidos?|reservas?|pagos?|facturas?)\b/u,
  /\b(mostrar|quais)\b.*\b(pedidos?|reservas?|pagamentos?|faturas?)\b/u,
  /\b(pokaz|ktore)\b.*\b(zamowienia?|rezerwacje?|platnosci|faktury)\b/u,
  /\b(arata|ce)\b.*\b(comenzi|comanda|rezervari|rezervarile|rezervare|plati|facturi)\b/u,
  /(показати|які).*(замовлення|бронювання|оплат|платеж|рахунок|рахунки)/u,
] as const;

const EXPLICIT_ACCOUNT_LOOKUP_PATTERNS = [
  /\bcheck\b.*\bpayment\s+reference\b/u,
  /\bpayment\s+reference\b.*\bpay\b/u,
  /\bcheck\b.*\b(orders?|bookings?)\b.*\b(provider|last\s+week|last\s+month|recent|latest|date)\b/u,
] as const;

const SELECTED_ORDER_REFERENCE_PATTERNS = [
  /\b(this|that|selected)\s+(order|booking)\b/i,
  /\b(this|that)\s+one\b/i,
];

const SELECTED_ORDER_FOLLOW_UP_PATTERNS = [
  /^\s*why\b.*\b(this|that|selected)\s+(order|booking)\b/i,
  /^\s*what\s+about\b.*\b(this|that|selected)\s+(order|booking)\b/i,
  /^\s*and\s+what\s+about\b.*\b(this|that|selected)\s+(order|booking)\b/i,
  /^\s*can\s+i\b.*\b(this|that|selected)\s+(order|booking)\b/i,
  /^\s*could\s+i\b.*\b(this|that|selected)\s+(order|booking)\b/i,
  /^\s*should\s+i\b.*\b(this|that|selected)\s+(order|booking)\b/i,
  /^\s*what\s+should\s+i\b.*\b(this|that|selected)\s+(order|booking)\b/i,
  /\bwhat\s+happened\b/i,
  /\bnext\s+step\b/i,
  /\bwhat\s+is\s+its\s+status\b/i,
  /\bwhat's\s+its\s+status\b/i,
  /\bcan\s+i\s+cancel\s+it\b/i,
  /\bcould\s+i\s+cancel\s+it\b/i,
  /\bwhy\s+was\s+it\s+canceled\b/i,
  /\bwhy\s+is\s+it\s+(not\s+)?paid\b/i,
  /\bwhy\s+is\s+payment\s+not\s+due\b/i,
  /\bwhat\s+about\s+(the\s+)?payment\b/i,
];

const SELECTED_ORDER_STATUS_PATTERNS = [
  /\bstatus\b/i,
  /\breason\b/i,
  /\bwhy\b/i,
  /\bwhat\s+happened\b/i,
  /\bnext\s+step\b/i,
  /\bwhat\s+should\s+i\s+do\b/i,
];

const SELECTED_ORDER_PAYMENT_PATTERNS = [
  /\bpayment\b/i,
  /\bpaid\b/i,
  /\bpay\b/i,
  /\bdue\b/i,
  /\binvoice\b/i,
  /\bcharged\b/i,
];

const SELECTED_ORDER_INVOICE_LIFECYCLE_PATTERNS = [
  /\bwhy\b.*\b(invoice|invoiced|not\s+invoiced)\b/i,
  /\bwhy\b.*\bno\s+invoice\b/i,
  /\bwhy\b.*\bnot\s+issued\b/i,
  /\bno\s+invoice\b/i,
  /\binvoice\b.*\b(not\s+issued|not\s+created|missing|not\s+there)\b/i,
  /\bnot\s+invoiced\s+yet\b/i,
  /\bwhat\s+does\s+not\s+invoiced\s+yet\s+mean\b/i,
  /\bwhy\s+can't\s+i\s+pay\b/i,
  /\bwhy\s+can\s+i\s+not\s+pay\b/i,
  /\bwhat\s+needs\s+to\s+happen\s+next\b/i,
  /\bwhy\s+is\s+it\s+still\s+awaiting\s+confirmation\b/i,
  /\bwhy\s+is\s+it\s+scheduled\s+but\s+not\s+invoiced\b/i,
];

const SELECTED_ORDER_INVOICE_LIFECYCLE_NORMALIZED_PATTERNS = [
  // These patterns only decide whether an existing selected order can be reused.
  // They must not become broad account search or model-style intent parsing.
  /\bpourquoi\b.*\bfacture\b/u,
  /\bfacture\b.*\b(pas\s+encore|pas|non)\b/u,
  /\bfacture\b.*\b(emise|emise|cree|creee)\b/u,
  /\bpourquoi\b.*\bpayer\b/u,
  /\brechnung\b.*\b(nicht|noch\s+nicht|ausgestellt|erstellt)\b/u,
  /\bwarum\b.*\b(rechnung|bezahlen|zahlen)\b/u,
  /\bfattura\b.*\b(non|ancora|emessa|creata)\b/u,
  /\bperche\b.*\b(fattura|pagare)\b/u,
  /\bfactura\b.*\b(no|todavia|emitida|creada)\b/u,
  /\bpor\s+que\b.*\b(factura|pagar)\b/u,
  /\bfatura\b.*\b(nao|ainda|emitida|criada)\b/u,
  /\bpor\s+que\b.*\b(fatura|pagar)\b/u,
  /\bfaktura\b.*\b(nie|jeszcze|wystawiona|wystawiono)\b/u,
  /\bdlaczego\b.*\b(faktura|zaplacic|platnosc)\b/u,
  /\bfactura\b.*\b(nu|inca|emisa|creata)\b/u,
  /\bde\s+ce\b.*\b(factura|plati|plata)\b/u,
  /рахунок.*(не|ще|виставлено|створено)/u,
  /(не|ще|виставлено|створено).*рахунок/u,
  /чому.*(рахунок|оплатити|оплата)/u,
];

const SELECTED_ORDER_CANCEL_PATTERNS = [
  /\bcancel\b/i,
  /\bcancelable\b/i,
  /\bcancellation\b/i,
];

function hasAny(patterns: readonly RegExp[], message: string) {
  return patterns.some((pattern) => pattern.test(message));
}

function normalizeSelectedOrderText(message: string) {
  return message
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDirectMutationRequest(message: string) {
  const normalizedMessage = normalizeSelectedOrderText(message);
  return (
    hasAny(DIRECT_MUTATION_PATTERNS, message) ||
    hasAny(DIRECT_MUTATION_PATTERNS, normalizedMessage)
  );
}

function hasExplicitCandidateLookupIntent(message: string) {
  const normalizedMessage = normalizeSelectedOrderText(message).replace(
    /[łŁ]/g,
    "l",
  );

  return (
    hasAny(EXPLICIT_ACCOUNT_LOOKUP_PATTERNS, message.toLocaleLowerCase()) ||
    hasAny(EXPLICIT_ACCOUNT_LOOKUP_PATTERNS, normalizedMessage) ||
    hasAny(PERSONAL_ACCOUNT_OBJECT_PATTERNS, normalizedMessage) ||
    hasAny(LIST_ACCOUNT_OBJECT_PATTERNS, normalizedMessage)
  );
}

function hasCancelLookupVerb(message: string) {
  const normalizedMessage = normalizeSelectedOrderText(message);
  return /\b(cancel|cancelable|stornier\w+|annuler|annul\w+|anular|anul\w+)\b/u.test(
    normalizedMessage,
  );
}

function exactObjectIds(message: string) {
  return Array.from(new Set(message.match(OBJECT_ID_RE) ?? []));
}

function hasExplicitInvalidReference(message: string) {
  const match = message.match(EXPLICIT_BAD_REF_RE)?.[1];
  return Boolean(match && !/^[a-f0-9]{24}$/i.test(match));
}

function helperInput(
  helper: ExactReferenceSupportAccountHelperName,
  referenceType: SupportAccountReferenceType,
  reference: string,
): SupportAccountRoute {
  return {
    kind: "helper",
    helper,
    input: { referenceType, reference },
  };
}

function candidateSelectionHelper(input: {
  hasCancelEligibility: boolean;
  hasPaymentStatus: boolean;
  statusFilter?: SupportOrderCandidateStatusFilter;
}): AccountCandidateSelectionHelper {
  if (
    input.statusFilter === "payment_not_due" ||
    input.statusFilter === "payment_pending" ||
    input.statusFilter === "paid"
  ) {
    return "getPaymentStatusForCurrentUser";
  }
  if (input.hasCancelEligibility) return "canCancelOrderForCurrentUser";
  if (input.hasPaymentStatus) return "getPaymentStatusForCurrentUser";
  return "getOrderStatusForCurrentUser";
}

function selectedOrderFollowUpHelper(input: {
  message: string;
  hasCancelEligibility: boolean;
  hasPaymentStatus: boolean;
}): {
  helper: AccountCandidateSelectionHelper;
  responseIntent?: SupportAccountResponseIntent;
} | null {
  const normalizedMessage = normalizeSelectedOrderText(input.message);
  const hasSelectedReference = hasAny(
    SELECTED_ORDER_REFERENCE_PATTERNS,
    input.message,
  );
  const hasInvoiceLifecycleQuestion = hasAny(
    SELECTED_ORDER_INVOICE_LIFECYCLE_PATTERNS,
    input.message,
  ) || hasAny(
    SELECTED_ORDER_INVOICE_LIFECYCLE_NORMALIZED_PATTERNS,
    normalizedMessage,
  );
  const hasFollowUpShape = hasAny(
    SELECTED_ORDER_FOLLOW_UP_PATTERNS,
    input.message,
  ) ||
    hasInvoiceLifecycleQuestion ||
    detectSelectedOrderCancelFollowUpIntent(input.message) ||
    detectSelectedOrderDetailFollowUpIntent(input.message) ||
    detectSelectedOrderPaymentFollowUpIntent(input.message) ||
    detectSelectedOrderStatusFollowUpIntent(input.message);

  if (!hasSelectedReference && !hasFollowUpShape) return null;
  if (
    input.hasCancelEligibility ||
    hasAny(SELECTED_ORDER_CANCEL_PATTERNS, input.message) ||
    detectSelectedOrderCancelFollowUpIntent(input.message)
  ) {
    return { helper: "canCancelOrderForCurrentUser" };
  }

  // Invoice lifecycle questions need the combined order DTO because invoice,
  // payment, service status, next step, and access role all affect the answer.
  if (hasInvoiceLifecycleQuestion) {
    return {
      helper: "getOrderStatusForCurrentUser",
      responseIntent: "invoice_lifecycle_explanation",
    };
  }

  if (
    input.hasPaymentStatus ||
    hasAny(SELECTED_ORDER_PAYMENT_PATTERNS, input.message) ||
    detectSelectedOrderPaymentFollowUpIntent(input.message)
  ) {
    return { helper: "getPaymentStatusForCurrentUser" };
  }
  if (
    hasAny(SELECTED_ORDER_STATUS_PATTERNS, input.message) ||
    detectSelectedOrderDetailFollowUpIntent(input.message) ||
    detectSelectedOrderStatusFollowUpIntent(input.message)
  ) {
    return { helper: "getOrderStatusForCurrentUser" };
  }

  return hasSelectedReference ? { helper: "getOrderStatusForCurrentUser" } : null;
}

export function routeSupportAccountAwareRequest(
  message: string,
  options?: RouteSupportAccountAwareOptions,
): SupportAccountRoute {
  const trimmed = message.trim();
  if (!trimmed) return { kind: "none" };

  const ids = exactObjectIds(trimmed);
  const hasOrderStatus =
    hasAny(ORDER_STATUS_PATTERNS, trimmed) || detectOrderStatusIntent(trimmed);
  const hasPaymentStatus =
    hasAny(PAYMENT_STATUS_PATTERNS, trimmed) || detectPaymentStatusIntent(trimmed);
  const hasCancelEligibility =
    hasAny(CANCEL_ELIGIBILITY_PATTERNS, trimmed) ||
    detectCancelEligibilityIntent(trimmed);
  const hasPaymentOverview =
    hasAny(PAYMENT_OVERVIEW_PATTERNS, trimmed) ||
    detectPaymentOverviewIntent(trimmed);
  const hasPaidOrderCandidateLookup =
    detectPaidOrderCandidateLookupIntent(trimmed);
  const statusFilter = detectCandidateStatusFilter(trimmed);
  const hasCandidateLookup = hasExplicitCandidateLookupIntent(trimmed);
  const hasDirectMutation = hasDirectMutationRequest(trimmed);
  const suppressCandidateSelection = options?.suppressCandidateSelection;
  const isAccountAware =
    hasOrderStatus ||
    hasPaymentStatus ||
    hasCancelEligibility ||
    hasPaymentOverview ||
    statusFilter;

  if (detectBroadOrDeferredIntent(trimmed)) {
    return { kind: "broad_or_deferred" };
  }

  if (
    ALWAYS_BROAD_OR_DEFERRED_PATTERNS.some((pattern) => pattern.test(trimmed)) &&
    /\b(orders?|bookings?|payments?|invoices?|account|provider)\b/i.test(trimmed)
  ) {
    return { kind: "broad_or_deferred" };
  }

  if (
    !statusFilter &&
    BROAD_OR_DEFERRED_PATTERNS.some((pattern) => pattern.test(trimmed)) &&
    /\b(orders?|bookings?|payments?|invoices?|account|provider)\b/i.test(trimmed)
  ) {
    return { kind: "broad_or_deferred" };
  }

  if (ids.length === 0 && options?.selectedOrder) {
    const selectedHelper = selectedOrderFollowUpHelper({
      message: trimmed,
      hasCancelEligibility,
      hasPaymentStatus,
    });

    if (selectedHelper) {
      return {
        kind: "helper",
        helper: selectedHelper.helper,
        input: options.selectedOrder,
        responseIntent: selectedHelper.responseIntent,
      };
    }
  }

  if (
    ids.length === 0 &&
    !hasDirectMutation &&
    !suppressCandidateSelection &&
    hasPaidOrderCandidateLookup
  ) {
    return {
      kind: "candidate_selection",
      selectionHelper: "getPaymentStatusForCurrentUser",
      statusFilter: "paid",
    };
  }

  if (
    ids.length === 0 &&
    !suppressCandidateSelection &&
    hasPaymentOverview
  ) {
    return { kind: "payment_overview" };
  }

  if (
    ids.length === 0 &&
    !hasDirectMutation &&
    !suppressCandidateSelection &&
    hasCandidateLookup &&
    (
      statusFilter ||
      detectCandidateSelectionIntent(trimmed) ||
      hasCancelEligibility ||
      hasCancelLookupVerb(trimmed)
    )
  ) {
    return {
      kind: "candidate_selection",
      selectionHelper: candidateSelectionHelper({
        hasCancelEligibility,
        hasPaymentStatus,
        statusFilter,
      }),
      statusFilter,
    };
  }

  if (!isAccountAware) return { kind: "none" };

  if (ids.length > 1) {
    if (hasCancelEligibility) {
      return {
        kind: "missing_reference",
        helper: "canCancelOrderForCurrentUser",
        referenceType: "order_id",
      };
    }
    if (hasPaymentStatus || hasPaymentOverview) {
      return {
        kind: "missing_reference",
        helper: "getPaymentStatusForCurrentUser",
        referenceType: /\binvoice\b/i.test(trimmed) ? "invoice_id" : "order_id",
      };
    }
    return {
      kind: "missing_reference",
      helper: "getOrderStatusForCurrentUser",
      referenceType: "order_id",
    };
  }

  const id = ids[0];
  if (!id) {
    if (hasExplicitInvalidReference(trimmed)) {
      return (hasPaymentStatus || hasPaymentOverview) && /\binvoice\b/i.test(trimmed)
        ? helperInput("getPaymentStatusForCurrentUser", "invoice_id", trimmed)
        : helperInput(
            hasCancelEligibility
              ? "canCancelOrderForCurrentUser"
              : hasPaymentStatus || hasPaymentOverview
                ? "getPaymentStatusForCurrentUser"
                : "getOrderStatusForCurrentUser",
            "order_id",
            trimmed,
          );
    }

    if (!hasDirectMutation && !suppressCandidateSelection && hasCandidateLookup) {
      return {
        kind: "candidate_selection",
        selectionHelper: candidateSelectionHelper({
          hasCancelEligibility,
          hasPaymentStatus,
          statusFilter,
        }),
        statusFilter,
      };
    }

    return {
      kind: "none",
    };
  }

  if (hasCancelEligibility) {
    return helperInput("canCancelOrderForCurrentUser", "order_id", id);
  }

  if (hasPaymentStatus || hasPaymentOverview) {
    return helperInput(
      "getPaymentStatusForCurrentUser",
      /\binvoice\b/i.test(trimmed) ? "invoice_id" : "order_id",
      id,
    );
  }

  return helperInput("getOrderStatusForCurrentUser", "order_id", id);
}
