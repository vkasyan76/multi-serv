import "server-only";

import type { TRPCContext } from "@/trpc/init";
import type {
  SupportIntentTriageResult,
} from "@/modules/support-chat/server/intent-triage";
import type { SupportAccountRoute } from "@/modules/support-chat/server/account-aware/routing";
import type {
  SupportAccountHelperInput,
  SupportOrderCandidateStatusFilter,
} from "@/modules/support-chat/server/account-aware/types";

export type SupportTriageEligibilityReason =
  | "not_signed_in"
  | "account_aware_disabled"
  | "low_confidence"
  | "unsafe_mutation"
  | "broad_or_deferred"
  | "unsupported_intent"
  | "unsupported_topic"
  | "unsupported_status_filter"
  | "missing_selected_order"
  | "no_allowed_mapping";

export type SupportTriageEligibilityResult =
  | {
      allowed: true;
      route: Exclude<SupportAccountRoute, { kind: "none" }>;
      mappedHelper: string;
      statusFilter?: SupportOrderCandidateStatusFilter;
    }
  | {
      allowed: false;
      reason: SupportTriageEligibilityReason;
    };

type SelectedOrderInput = SupportAccountHelperInput & {
  referenceType: "order_id";
};

type TriageEligibilityInput = {
  triage: SupportIntentTriageResult;
  accountContext?: Pick<TRPCContext, "db" | "userId">;
  selectedOrder?: SelectedOrderInput;
  accountAwareEnabled: boolean;
  broadOrDeferred: boolean;
};

type CandidateMapping = {
  selectionHelper:
    | "getOrderStatusForCurrentUser"
    | "getPaymentStatusForCurrentUser"
    | "canCancelOrderForCurrentUser";
  statusFilter: SupportOrderCandidateStatusFilter;
};

function selectedOrderHelperForTriage(triage: SupportIntentTriageResult) {
  if (triage.topic === "booking") return "getOrderStatusForCurrentUser";
  if (triage.topic === "payment") return "getPaymentStatusForCurrentUser";
  if (triage.topic === "cancellation") return "canCancelOrderForCurrentUser";
  return null;
}

function candidateRouteForTriage(
  triage: SupportIntentTriageResult,
): SupportTriageEligibilityResult {
  if (!triage.topic) return { allowed: false, reason: "unsupported_topic" };
  if (
    triage.topic !== "booking" &&
    triage.topic !== "payment" &&
    triage.topic !== "cancellation"
  ) {
    return { allowed: false, reason: "unsupported_topic" };
  }
  if (!triage.statusFilter) {
    return { allowed: false, reason: "unsupported_status_filter" };
  }

  let mapping: CandidateMapping | null = null;

  if (
    triage.topic === "booking" &&
    (triage.statusFilter === "requested" ||
      triage.statusFilter === "scheduled" ||
      triage.statusFilter === "canceled")
  ) {
    mapping = {
      selectionHelper: "getOrderStatusForCurrentUser",
      statusFilter: triage.statusFilter,
    };
  }

  if (
    triage.topic === "payment" &&
    (triage.statusFilter === "paid" ||
      triage.statusFilter === "payment_pending" ||
      triage.statusFilter === "payment_not_due")
  ) {
    mapping = {
      selectionHelper: "getPaymentStatusForCurrentUser",
      statusFilter: triage.statusFilter,
    };
  }

  if (triage.topic === "cancellation" && triage.statusFilter === "scheduled") {
    mapping = {
      selectionHelper: "canCancelOrderForCurrentUser",
      statusFilter: "scheduled",
    };
  }

  if (!mapping) return { allowed: false, reason: "no_allowed_mapping" };

  return {
    allowed: true,
    mappedHelper: mapping.selectionHelper,
    statusFilter: mapping.statusFilter,
    route: {
      kind: "candidate_selection",
      selectionHelper: mapping.selectionHelper,
      statusFilter: mapping.statusFilter,
    },
  };
}

export function evaluateSupportTriageEligibility(
  input: TriageEligibilityInput,
): SupportTriageEligibilityResult {
  if (!input.accountAwareEnabled) {
    return { allowed: false, reason: "account_aware_disabled" };
  }
  if (input.broadOrDeferred) {
    return { allowed: false, reason: "broad_or_deferred" };
  }
  if (input.triage.confidence !== "high") {
    return { allowed: false, reason: "low_confidence" };
  }
  if (input.triage.intent === "unsafe_mutation") {
    return { allowed: false, reason: "unsafe_mutation" };
  }
  if (input.triage.intent === "unsupported_account_scope") {
    return { allowed: false, reason: "broad_or_deferred" };
  }
  if (
    input.triage.intent !== "account_candidate_lookup" &&
    input.triage.intent !== "selected_order_follow_up"
  ) {
    return { allowed: false, reason: "unsupported_intent" };
  }
  if (!input.accountContext?.userId) {
    return { allowed: false, reason: "not_signed_in" };
  }
  if (input.triage.intent === "account_candidate_lookup") {
    return candidateRouteForTriage(input.triage);
  }
  if (input.triage.intent === "selected_order_follow_up") {
    if (!input.selectedOrder) {
      return { allowed: false, reason: "missing_selected_order" };
    }
    const helper = selectedOrderHelperForTriage(input.triage);
    if (!helper) {
      return { allowed: false, reason: "unsupported_topic" };
    }
    return {
      allowed: true,
      mappedHelper: helper,
      route: {
        kind: "helper",
        helper,
        input: input.selectedOrder,
      },
    };
  }

  return { allowed: false, reason: "unsupported_intent" };
}
