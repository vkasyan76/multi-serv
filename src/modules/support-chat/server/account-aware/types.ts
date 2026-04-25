import "server-only";

export const SUPPORT_ACCOUNT_HELPER_NAMES = [
  "getOrderStatusForCurrentUser",
  "getPaymentStatusForCurrentUser",
  "canCancelOrderForCurrentUser",
] as const;

export type SupportAccountHelperName =
  (typeof SUPPORT_ACCOUNT_HELPER_NAMES)[number];

export const SUPPORT_ACCOUNT_DENIED_REASONS = [
  "unauthenticated",
  "missing_reference",
  "invalid_reference",
  "not_found_or_not_owned",
  "unsupported_reference_type",
] as const;

export type SupportAccountHelperDeniedReason =
  (typeof SUPPORT_ACCOUNT_DENIED_REASONS)[number];

export type SupportAccountHelperResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: SupportAccountHelperDeniedReason };

export const SUPPORT_ACCOUNT_REFERENCE_TYPES = [
  "order_id",
  "invoice_id",
] as const;

export type SupportAccountReferenceType =
  (typeof SUPPORT_ACCOUNT_REFERENCE_TYPES)[number];

export const SUPPORT_ACCOUNT_DEFERRED_REFERENCE_TYPES = [
  "payment_reference",
  "public_order_display_reference",
  "latest_order",
  "recent_payment",
  "provider_name",
  "date_based_lookup",
  "service_name_lookup",
  "natural_language_reference",
  "order_history",
  "payment_history",
] as const;

export type SupportAccountDeferredReferenceType =
  (typeof SUPPORT_ACCOUNT_DEFERRED_REFERENCE_TYPES)[number];

export type SupportAccountHelperInput = {
  referenceType: SupportAccountReferenceType;
  reference: string;
};

export type SupportAccountOrderReferenceInput = {
  referenceType: "order_id";
  reference: string;
};

export type SupportAccountPaymentReferenceInput = {
  referenceType: "order_id" | "invoice_id";
  reference: string;
};

export type SupportAccountOrderServiceStatusCategory =
  | "scheduled"
  | "completed"
  | "accepted"
  | "disputed"
  | "canceled"
  | "unknown";

export type SupportAccountPaymentStatusCategory =
  | "not_due"
  | "pending"
  | "paid"
  | "failed"
  | "canceled"
  | "refunded"
  | "unknown";

export type SupportAccountInvoiceStatusCategory =
  | "none"
  | "draft"
  | "issued"
  | "overdue"
  | "paid"
  | "void"
  | "unknown";

export type SupportAccountCancellationBlockReason =
  | "already_canceled"
  | "order_paid"
  | "not_slot_order"
  | "wrong_service_status"
  | "invoice_exists"
  | "missing_slots"
  | "invalid_slot_dates"
  | "cutoff_passed"
  | "slot_paid"
  | "unknown";

export type SupportAccountNextStepKey =
  | "view_orders"
  | "view_invoice"
  | "pay_invoice"
  | "cancel_in_app"
  | "contact_support"
  | "wait_for_provider"
  | "no_action_needed";

export type SupportAccountHelperBaseDTO = {
  helper: SupportAccountHelperName;
  referenceType: SupportAccountReferenceType;
  resultCategory: string;
  nextStepKey: SupportAccountNextStepKey;
};

export type SupportOrderStatusDTO = SupportAccountHelperBaseDTO & {
  helper: "getOrderStatusForCurrentUser";
  referenceType: "order_id";
  resultCategory: "order_status";
  serviceStatusCategory: SupportAccountOrderServiceStatusCategory;
  paymentStatusCategory: SupportAccountPaymentStatusCategory;
  invoiceStatusCategory: SupportAccountInvoiceStatusCategory;
  createdAt?: string;
  firstSlotStart?: string;
  lastUpdatedAt?: string;
};

export type SupportPaymentStatusDTO = SupportAccountHelperBaseDTO & {
  helper: "getPaymentStatusForCurrentUser";
  referenceType: "order_id" | "invoice_id";
  resultCategory: "payment_status";
  paymentStatusCategory: SupportAccountPaymentStatusCategory;
  invoiceStatusCategory: SupportAccountInvoiceStatusCategory;
  issuedAt?: string;
  paidAt?: string;
  paymentDueAt?: string;
};

export type SupportCancellationEligibilityDTO =
  SupportAccountHelperBaseDTO & {
    helper: "canCancelOrderForCurrentUser";
    referenceType: "order_id";
    resultCategory: "cancellation_eligibility";
    canCancel: boolean;
    blockReason?: SupportAccountCancellationBlockReason;
    firstSlotStart?: string;
    cutoffAt?: string;
  };

export type SupportAccountHelperDTO =
  | SupportOrderStatusDTO
  | SupportPaymentStatusDTO
  | SupportCancellationEligibilityDTO;

export type SupportAccountResult =
  SupportAccountHelperResult<SupportAccountHelperDTO>;

export const SUPPORT_ACCOUNT_AUTHORITATIVE_IDENTITY = {
  authUserSource: "ctx.userId",
  authProvider: "clerk",
  ownershipUserSource: "payload.users.id",
  resolutionRule:
    "Resolve ctx.userId to the existing Payload user before ownership checks.",
  forbiddenRule: "Never trust user-provided ids for ownership checks.",
} as const;
