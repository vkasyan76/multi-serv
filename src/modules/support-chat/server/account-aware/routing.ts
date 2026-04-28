import "server-only";

import type { AccountCandidateSelectionHelper } from "./action-tokens";
import type {
  SupportAccountHelperInput,
  SupportAccountHelperName,
  SupportAccountReferenceType,
} from "./types";
import { detectCandidateSelectionIntent } from "./intent-normalizer";

type ExactReferenceSupportAccountHelperName = Exclude<
  SupportAccountHelperName,
  "getRecentSupportOrderCandidatesForCurrentUser"
>;

export type SupportAccountRoute =
  | {
      kind: "helper";
      helper: ExactReferenceSupportAccountHelperName;
      input: SupportAccountHelperInput;
    }
  | {
      kind: "missing_reference";
      helper: ExactReferenceSupportAccountHelperName;
      referenceType: SupportAccountReferenceType;
    }
  | {
      kind: "candidate_selection";
      selectionHelper: AccountCandidateSelectionHelper;
    }
  | { kind: "unsupported_reference" }
  | { kind: "broad_or_deferred" }
  | { kind: "none" };

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
  /\bcharged\s+twice\b/i,
  /\bwhy\s+was\s+(my\s+)?card\s+charged\b/i,
  /\binvoice\b.*\bstatus\b/i,
  /\binvoice\s+status\b/i,
  /\bcheck\s+(my\s+)?invoice\b/i,
];

const CANCEL_ELIGIBILITY_PATTERNS = [
  /\bcan\s+i\s+cancel\s+(my\s+|this\s+|the\s+)?(?:last\s+|latest\s+|recent\s+|most\s+recent\s+)?(order|booking)\b/i,
  /\bcancel\s+(my\s+|this\s+|the\s+)?(?:last\s+|latest\s+|recent\s+|most\s+recent\s+)?(order|booking)\b/i,
  /\bcancelable\b/i,
  /\bcancellation\s+eligibility\b/i,
];

function hasAny(patterns: RegExp[], message: string) {
  return patterns.some((pattern) => pattern.test(message));
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
}): AccountCandidateSelectionHelper {
  if (input.hasCancelEligibility) return "canCancelOrderForCurrentUser";
  if (input.hasPaymentStatus) return "getPaymentStatusForCurrentUser";
  return "getOrderStatusForCurrentUser";
}

export function routeSupportAccountAwareRequest(
  message: string,
): SupportAccountRoute {
  const trimmed = message.trim();
  if (!trimmed) return { kind: "none" };

  const ids = exactObjectIds(trimmed);
  const hasOrderStatus = hasAny(ORDER_STATUS_PATTERNS, trimmed);
  const hasPaymentStatus = hasAny(PAYMENT_STATUS_PATTERNS, trimmed);
  const hasCancelEligibility = hasAny(CANCEL_ELIGIBILITY_PATTERNS, trimmed);
  const isAccountAware =
    hasOrderStatus || hasPaymentStatus || hasCancelEligibility;

  if (
    BROAD_OR_DEFERRED_PATTERNS.some((pattern) => pattern.test(trimmed)) &&
    /\b(orders?|bookings?|payments?|invoices?|account|provider)\b/i.test(trimmed)
  ) {
    return { kind: "broad_or_deferred" };
  }

  if (
    ids.length === 0 &&
    detectCandidateSelectionIntent(trimmed)
  ) {
    return {
      kind: "candidate_selection",
      selectionHelper: candidateSelectionHelper({
        hasCancelEligibility,
        hasPaymentStatus,
      }),
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
    if (hasPaymentStatus) {
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
      return hasPaymentStatus && /\binvoice\b/i.test(trimmed)
        ? helperInput("getPaymentStatusForCurrentUser", "invoice_id", trimmed)
        : helperInput(
            hasCancelEligibility
              ? "canCancelOrderForCurrentUser"
              : hasPaymentStatus
                ? "getPaymentStatusForCurrentUser"
                : "getOrderStatusForCurrentUser",
            "order_id",
            trimmed,
          );
    }

    return {
      kind: "candidate_selection",
      selectionHelper: candidateSelectionHelper({
        hasCancelEligibility,
        hasPaymentStatus,
      }),
    };
  }

  if (hasCancelEligibility) {
    return helperInput("canCancelOrderForCurrentUser", "order_id", id);
  }

  if (hasPaymentStatus) {
    return helperInput(
      "getPaymentStatusForCurrentUser",
      /\binvoice\b/i.test(trimmed) ? "invoice_id" : "order_id",
      id,
    );
  }

  return helperInput("getOrderStatusForCurrentUser", "order_id", id);
}
