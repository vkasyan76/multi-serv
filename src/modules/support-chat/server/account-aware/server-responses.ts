import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import { getSupportChatCopy } from "@/modules/support-chat/server/support-chat-copy";
import type { TRPCContext } from "@/trpc/init";
import {
  canCancelOrderForCurrentUser,
  getOrderStatusForCurrentUser,
  getPaymentStatusForCurrentUser,
  getSupportPaymentOverviewForCurrentUser,
  getSupportOrderCandidatesForCurrentUser,
} from "./helpers";
import {
  createAccountCandidateActionToken,
  createSelectedOrderContextToken,
  verifyAccountCandidateActionToken,
  type AccountCandidateSelectionHelper,
} from "./action-tokens";
import type { SupportAccountRoute } from "./routing";
import type {
  SupportAccountHelperDeniedReason,
  SupportAccountHelperDTO,
  SupportAccountHelperName,
  SupportOrderCandidateDTO,
  SupportOrderCandidateStatusFilter,
} from "./types";
import { SUPPORT_ACCOUNT_HELPER_VERSION } from "./versioning";

type AccountCtx = Pick<TRPCContext, "db" | "userId">;
type AccountResponseIntent = Extract<
  SupportAccountRoute,
  { kind: "helper" }
>["responseIntent"];

export type SupportAccountHelperMetadata = {
  helper?: SupportAccountHelperName;
  helperVersion: string;
  resultCategory?: string;
  deniedReason?: SupportAccountHelperDeniedReason;
  authenticated: boolean;
  requiredInputPresent: boolean;
  serverAuthored: true;
};

export type AccountAwareServerResponse = {
  assistantMessage: string;
  disposition: "answered" | "uncertain" | "unsupported_account_question";
  needsHumanSupport: boolean;
  accountHelperMetadata: SupportAccountHelperMetadata;
  actions?: SupportChatAction[];
  selectedOrderContext?: SupportSelectedOrderContext;
};

export type SupportChatAction = {
  id: string;
  type: "account_candidate_select";
  label: string;
  description?: string;
  token: string;
};

export type SupportSelectedOrderContext = {
  type: "selected_order";
  token: string;
  label?: string;
  description?: string;
};

function fallback(locale: AppLang) {
  return getSupportChatCopy(locale).serverMessages.unsupportedAccount;
}

function categoryLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatCandidateDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function paymentSummary(input: {
  paymentStatusCategory: string;
  invoiceStatusCategory: string;
}) {
  if (
    input.invoiceStatusCategory === "issued" ||
    input.invoiceStatusCategory === "overdue"
  ) {
    return `payment ${categoryLabel(input.paymentStatusCategory)}`;
  }
  if (
    input.invoiceStatusCategory !== "none" &&
    input.invoiceStatusCategory !== "unknown"
  ) {
    return `invoice ${categoryLabel(input.invoiceStatusCategory)}`;
  }
  return `payment ${categoryLabel(input.paymentStatusCategory)}`;
}

function candidateActionLabel(candidate: SupportOrderCandidateDTO) {
  return [
    candidate.tenantDisplayName,
    ...(candidate.serviceNames ?? []),
    formatCandidateDate(candidate.firstSlotStart ?? candidate.createdAt),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" - ");
}

function candidateActionDescription(candidate: SupportOrderCandidateDTO) {
  return [
    categoryLabel(candidate.serviceStatusCategory),
    paymentSummary(candidate),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" - ");
}

function candidateActions(input: {
  candidates: SupportOrderCandidateDTO[];
  helper: AccountCandidateSelectionHelper;
  threadId: string;
}): SupportChatAction[] {
  return input.candidates.map((candidate, index) => {
    const label = candidateActionLabel(candidate) || "Order candidate";
    const description = candidateActionDescription(candidate);
    return {
      id: `${input.helper}:${index}`,
      type: "account_candidate_select",
      label,
      description,
      token: createAccountCandidateActionToken({
        helper: input.helper,
        reference: candidate.orderId,
        threadId: input.threadId,
        displayLabel: label,
        displayDescription: description,
      }),
    };
  });
}

function candidateSelectionMessage(candidates: SupportOrderCandidateDTO[]) {
  if (!candidates.length) {
    return "I can help, but I could not find recent support-safe order candidates. Please open your Orders page or contact support with the exact order ID.";
  }

  return candidates.length === 1
    ? "I found one recent order candidate. Please select it below if it is the order you mean."
    : "I found a few recent order candidates. Which order do you mean?";
}

function statusFilterLabel(filter: SupportOrderCandidateStatusFilter) {
  switch (filter) {
    case "canceled":
      return "canceled";
    case "requested":
      return "requested";
    case "scheduled":
      return "scheduled";
    case "completed_or_accepted":
      return "completed or accepted";
    case "payment_not_due":
      return "payment not due";
    case "payment_pending":
      return "payment pending";
    case "paid":
      return "paid";
  }
}

function filteredCandidateSelectionMessage(
  candidates: SupportOrderCandidateDTO[],
  statusFilter: SupportOrderCandidateStatusFilter | undefined,
) {
  if (!statusFilter) return candidateSelectionMessage(candidates);

  const label = statusFilterLabel(statusFilter);
  if (!candidates.length) {
    return `I could not find recent ${label} booking candidates. This is not a full history check. Please open your Orders page if you need the complete list.`;
  }

  return candidates.length === 1
    ? `I found one recent ${label} booking candidate. Please select it below if it is the order you mean.`
    : `I found recent ${label} booking candidates. Which order do you mean?`;
}

function missingReferenceMessage(route: Extract<SupportAccountRoute, { kind: "missing_reference" }>) {
  if (route.referenceType === "invoice_id") {
    return "Please provide the exact invoice ID so I can check that safely.";
  }
  return "Please provide the exact order ID so I can check that safely.";
}

function orderStatusHeadline(data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>) {
  if (data.accessRole === "tenant") {
    switch (data.serviceStatusCategory) {
      case "requested":
        return "This customer booking request is awaiting your confirmation.";
      case "scheduled":
        return "This customer booking is scheduled.";
      case "completed":
        return "This customer order is marked completed and is awaiting the next service-lifecycle step.";
      case "accepted":
        return "This customer order has been accepted.";
      case "disputed":
        return "This customer order is marked disputed.";
      case "canceled":
        return "This customer order is canceled.";
      default:
        return "I found the order, but its current service status is not available in a support-safe category.";
    }
  }

  switch (data.serviceStatusCategory) {
    case "requested":
      return "This order is awaiting provider confirmation. It is a booking request, not a scheduled booking yet.";
    case "scheduled":
      return "This order is scheduled.";
    case "completed":
      return "This order is marked completed and is awaiting the next service-lifecycle step.";
    case "accepted":
      return "This order has been accepted.";
    case "disputed":
      return "This order is marked disputed.";
    case "canceled":
      return "This order is canceled.";
    default:
      return "I found the order, but its current service status is not available in a support-safe category.";
  }
}

function statusReasonLabel(data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>) {
  if (data.accessRole === "tenant") {
    switch (data.statusReasonKey) {
      case "customer_canceled":
        return "The customer canceled this order.";
      case "provider_declined":
        return "You declined this booking request.";
      case "provider_canceled":
        return "The provider side canceled this order.";
      case "awaiting_provider_confirmation":
        return "This booking request is waiting for your confirmation or decline.";
      case "provider_confirmed":
        return "The provider side has confirmed this booking.";
      case "completed":
        return "The provider side has marked the service completed.";
      case "accepted":
        return "The customer accepted the service completion.";
      case "disputed":
        return "The customer disputed the service completion.";
      default:
        return undefined;
    }
  }

  switch (data.statusReasonKey) {
    case "customer_canceled":
      return "The order was canceled by the customer.";
    case "provider_declined":
      return "The provider declined this booking request.";
    case "provider_canceled":
      return "The provider canceled this order.";
    case "awaiting_provider_confirmation":
      return "The provider has not confirmed or declined this booking request yet.";
    case "provider_confirmed":
      return "The provider has confirmed this booking.";
    case "completed":
      return "The provider has marked the service completed.";
    case "accepted":
      return "The service completion has been accepted.";
    case "disputed":
      return "The order is currently marked as disputed.";
    default:
      return undefined;
  }
}

function nextStepLabel(data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>) {
  if (data.accessRole === "tenant") {
    switch (data.nextStepKey) {
      case "await_provider_confirmation":
        return "Confirm or decline the request from your dashboard.";
      case "pay_invoice":
        return "Review the issued invoice from your dashboard.";
      case "view_orders":
        return "Open your dashboard Orders view for the full order view.";
      case "no_action_needed":
        return "No payment action is needed right now.";
      default:
        return undefined;
    }
  }

  switch (data.nextStepKey) {
    case "await_provider_confirmation":
      return "Wait for the provider to confirm or decline the request.";
    case "pay_invoice":
      return "Open the invoice from your Orders page to pay.";
    case "view_orders":
      return "Open your Orders page for the full order view.";
    case "no_action_needed":
      return "No payment action is needed right now.";
    default:
      return undefined;
  }
}

function orderStatusMessage(data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>) {
  const lines = [orderStatusHeadline(data)];

  // Keep the summary deterministic and bounded to fields the helper already
  // sanitized; do not expose raw order records, Stripe data, or internal notes.
  const context = [
    data.providerDisplayName ? `Provider: ${data.providerDisplayName}` : undefined,
    data.serviceNames?.length ? `Service: ${data.serviceNames.join(", ")}` : undefined,
    formatCandidateDate(data.firstSlotStart ?? data.createdAt)
      ? `Date: ${formatCandidateDate(data.firstSlotStart ?? data.createdAt)}`
      : undefined,
    `Status: ${categoryLabel(data.serviceStatusCategory)}`,
    `Payment: ${paymentSummary(data)}`,
  ].filter((value): value is string => Boolean(value));

  if (context.length) {
    lines.push(context.join("\n"));
  }

  const reason = statusReasonLabel(data);
  if (reason) lines.push(`Reason: ${reason}`);
  if (data.publicStatusReason) {
    lines.push(`Provider/customer note: ${data.publicStatusReason}`);
  }

  const nextStep = nextStepLabel(data);
  if (nextStep) lines.push(`Next step: ${nextStep}`);

  return lines.join("\n\n");
}

function invoiceLifecycleExplanationMessage(
  data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>,
) {
  const providerSide = data.accessRole === "tenant";

  if (data.invoiceStatusCategory === "issued" || data.invoiceStatusCategory === "overdue") {
    return providerSide
      ? "An invoice has already been issued for this customer booking. From the provider side, review the order or invoice in your dashboard for the current payment state."
      : "An invoice has already been issued for this order. Open your Orders page to review the invoice and current payment state.";
  }

  if (data.invoiceStatusCategory === "paid") {
    return providerSide
      ? "This customer booking is already marked paid in the support-safe order status. Review the order in your dashboard if you need the full order view."
      : "This order is already marked paid in the support-safe order status. Open your Orders page if you need the full order view.";
  }

  if (data.invoiceStatusCategory === "void") {
    return providerSide
      ? "The invoice for this customer booking is not currently payable. Review the order in your dashboard or contact support if the customer still needs help."
      : "The invoice for this order is not currently payable. Open your Orders page or contact support if you still need help.";
  }

  switch (data.serviceStatusCategory) {
    case "requested":
      return providerSide
        ? "An invoice has not been issued yet for this customer booking because it is still awaiting your confirmation. Booking requests do not become payable immediately. From the provider side, confirm or decline the request in your dashboard; after the order later reaches the invoice/payment step, the invoice/payment status can change."
        : "An invoice has not been issued yet because this booking request is still awaiting provider confirmation. Booking requests do not become payable immediately. Once the provider confirms and the order later reaches the invoice/payment step, the invoice/payment status can change.";
    case "scheduled":
      return providerSide
        ? "An invoice has not been issued yet for this customer booking because this scheduled order has not reached the invoice/payment step. From the provider side, review the order in your dashboard and check whether the service is ready for the next order step."
        : "An invoice has not been issued yet for this scheduled booking because it has not reached the invoice/payment step. In this flow, payment may be requested later. Please watch your Orders page for invoice or payment updates.";
    case "completed":
    case "accepted":
      return providerSide
        ? "An invoice has not been issued yet for this customer booking even though the order is past the scheduled/requested stage. Review the order in your dashboard and contact support if the invoice/payment step appears stuck."
        : "An invoice has not been issued yet for this order even though it is past the scheduled/requested stage. Please check your Orders page and contact support if the invoice/payment step appears stuck.";
    case "canceled":
      return providerSide
        ? "An invoice has not been issued because this customer booking is canceled. A canceled order is not currently expected to move into the invoice/payment step."
        : "An invoice has not been issued because this order is canceled. A canceled order is not currently expected to move into the invoice/payment step.";
    default:
      return providerSide
        ? "An invoice has not been issued yet for this customer booking because it has not reached a support-safe invoice/payment state. Review the order in your dashboard for the full order view."
        : "An invoice has not been issued yet because this order has not reached a support-safe invoice/payment state. Open your Orders page for the full order view.";
  }
}

function paymentStatusMessage(data: Extract<SupportAccountHelperDTO, { resultCategory: "payment_status" }>) {
  if (data.paymentStatusCategory === "paid") {
    return "This payment is marked paid.";
  }
  if (data.invoiceStatusCategory === "issued" || data.invoiceStatusCategory === "overdue") {
    return "A payment is pending for this order or invoice. You can open the invoice from your Orders page.";
  }
  if (data.invoiceStatusCategory === "none" || data.paymentStatusCategory === "not_due") {
    switch (data.serviceStatusCategory) {
      case "requested":
        return "Payment is not due yet because this is still a booking request awaiting provider confirmation. Booking requests do not become payable immediately. Once the provider confirms and the order later reaches the invoice/payment step, the payment status can change.";
      case "scheduled":
        return "Payment is not due yet because no invoice has been issued for this scheduled booking. In this flow, payment is requested later through the invoice/payment step.";
      case "completed":
      case "accepted":
        return "Payment is not due yet because no invoice has been issued for this order. Please check your Orders page for invoice or payment status updates.";
      case "canceled":
        return "Payment is not due because this order is canceled and no payable invoice is currently associated with it.";
      default:
        return "Payment is not due for this order yet. No payable invoice is currently associated with it.";
    }
  }
  if (data.invoiceStatusCategory === "void" || data.paymentStatusCategory === "canceled") {
    return "This invoice is not currently payable.";
  }
  return "I found the payment record, but its current payment status is not available in a support-safe category.";
}

function cancellationMessage(data: Extract<SupportAccountHelperDTO, { resultCategory: "cancellation_eligibility" }>) {
  if (data.canCancel) {
    return "This order currently appears eligible for in-app cancellation. Please use the cancellation option in your Orders page.";
  }
  return "This order does not currently appear eligible for in-app cancellation. Please use your Orders page or contact support if you need help.";
}

function countPhrase(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function paymentOverviewMessage(data: Extract<SupportAccountHelperDTO, { resultCategory: "payment_overview" }>) {
  if (data.inspectedOrderCount === 0) {
    return "I could not find recent support-safe orders to summarize. This is not a full account or payment history check.";
  }

  const parts = [
    countPhrase(data.categories.paid, "paid order"),
    `${data.categories.paymentPending} with payment pending`,
    `${data.categories.paymentNotDue} where payment is not due yet`,
    `${data.categories.paymentCanceled} with payment canceled`,
    `${data.categories.refunded} refunded`,
  ];

  if (data.categories.unknown > 0) {
    parts.push(`${data.categories.unknown} with an unknown payment status`);
  }

  // This wording is intentionally deterministic: the helper returns a bounded
  // recent-order summary, not a complete payment ledger or Stripe timeline.
  return [
    `From the recent orders I can safely check, I found ${parts.join(", ")}.`,
    `I inspected ${countPhrase(data.inspectedOrderCount, "recent support-safe order")}. This is not a full payment history.`,
  ].join("\n\n");
}

function successMessage(
  data: SupportAccountHelperDTO,
  responseIntent?: AccountResponseIntent,
) {
  switch (data.resultCategory) {
    case "order_status":
      if (responseIntent === "invoice_lifecycle_explanation") {
        return invoiceLifecycleExplanationMessage(data);
      }
      return orderStatusMessage(data);
    case "payment_status":
      return paymentStatusMessage(data);
    case "cancellation_eligibility":
      return cancellationMessage(data);
    case "payment_overview":
      return paymentOverviewMessage(data);
    default:
      return "I found the account item, but I cannot safely summarize it yet.";
  }
}

async function callHelper(ctx: AccountCtx, route: Extract<SupportAccountRoute, { kind: "helper" }>) {
  switch (route.helper) {
    case "getOrderStatusForCurrentUser":
      return getOrderStatusForCurrentUser(ctx, route.input);
    case "getPaymentStatusForCurrentUser":
      return getPaymentStatusForCurrentUser(ctx, route.input);
    case "canCancelOrderForCurrentUser":
      return canCancelOrderForCurrentUser(ctx, route.input);
  }
}

export async function buildAccountAwareServerResponse(input: {
  route: Exclude<SupportAccountRoute, { kind: "none" }>;
  accountContext?: AccountCtx;
  locale: AppLang;
  threadId: string;
}): Promise<AccountAwareServerResponse> {
  const authenticated = Boolean(input.accountContext?.userId);

  if (!authenticated) {
    return {
      assistantMessage: fallback(input.locale),
      disposition: "unsupported_account_question",
      needsHumanSupport: true,
      accountHelperMetadata: {
        helper:
          input.route.kind === "helper" ||
          input.route.kind === "missing_reference"
            ? input.route.helper
            : input.route.kind === "payment_overview"
              ? "getSupportPaymentOverviewForCurrentUser"
            : undefined,
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        authenticated: false,
        requiredInputPresent: input.route.kind === "helper",
        deniedReason: "unauthenticated",
        serverAuthored: true,
      },
    };
  }

  if (input.route.kind === "missing_reference") {
    return {
      assistantMessage: missingReferenceMessage(input.route),
      disposition: "uncertain",
      needsHumanSupport: false,
      accountHelperMetadata: {
        helper: input.route.helper,
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        authenticated,
        requiredInputPresent: false,
        serverAuthored: true,
      },
    };
  }

  if (input.route.kind === "payment_overview") {
    const accountContext = input.accountContext;
    if (!accountContext) {
      return {
        assistantMessage: fallback(input.locale),
        disposition: "unsupported_account_question",
        needsHumanSupport: true,
        accountHelperMetadata: {
          helper: "getSupportPaymentOverviewForCurrentUser",
          helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
          authenticated: false,
          requiredInputPresent: false,
          deniedReason: "unauthenticated",
          serverAuthored: true,
        },
      };
    }

    const result = await getSupportPaymentOverviewForCurrentUser(accountContext);

    if (!result.ok) {
      return {
        assistantMessage: fallback(input.locale),
        disposition: "unsupported_account_question",
        needsHumanSupport: true,
        accountHelperMetadata: {
          helper: "getSupportPaymentOverviewForCurrentUser",
          helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
          authenticated,
          requiredInputPresent: false,
          deniedReason: result.reason,
          serverAuthored: true,
        },
      };
    }

    return {
      assistantMessage: successMessage(result.data),
      disposition: "answered",
      needsHumanSupport: false,
      accountHelperMetadata: {
        helper: "getSupportPaymentOverviewForCurrentUser",
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        resultCategory: result.data.resultCategory,
        authenticated,
        requiredInputPresent: false,
        serverAuthored: true,
      },
    };
  }

  if (input.route.kind === "candidate_selection") {
    const accountContext = input.accountContext;
    if (!accountContext) {
      return {
        assistantMessage: fallback(input.locale),
        disposition: "unsupported_account_question",
        needsHumanSupport: true,
        accountHelperMetadata: {
          helper: "getSupportOrderCandidatesForCurrentUser",
          helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
          authenticated: false,
          requiredInputPresent: false,
          deniedReason: "unauthenticated",
          serverAuthored: true,
        },
      };
    }

    const result = await getSupportOrderCandidatesForCurrentUser(accountContext, {
      statusFilter: input.route.statusFilter,
    });

    if (!result.ok) {
      return {
        assistantMessage: fallback(input.locale),
        disposition: "unsupported_account_question",
        needsHumanSupport: true,
        accountHelperMetadata: {
          helper: "getSupportOrderCandidatesForCurrentUser",
          helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
          authenticated,
          requiredInputPresent: false,
          deniedReason: result.reason,
          serverAuthored: true,
        },
      };
    }

    return {
      assistantMessage: filteredCandidateSelectionMessage(
        result.data.candidates,
        input.route.statusFilter,
      ),
      disposition: "uncertain",
      needsHumanSupport: false,
      accountHelperMetadata: {
        helper: "getSupportOrderCandidatesForCurrentUser",
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        resultCategory: result.data.resultCategory,
        authenticated,
        requiredInputPresent: false,
        serverAuthored: true,
      },
      actions: candidateActions({
        candidates: result.data.candidates,
        helper: input.route.selectionHelper,
        threadId: input.threadId,
      }),
    };
  }

  if (input.route.kind === "broad_or_deferred" || input.route.kind === "unsupported_reference") {
    return {
      assistantMessage: fallback(input.locale),
      disposition: "unsupported_account_question",
      needsHumanSupport: true,
      accountHelperMetadata: {
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        authenticated,
        requiredInputPresent: false,
        serverAuthored: true,
      },
    };
  }

  const accountContext = input.accountContext;
  if (!accountContext) {
    return {
      assistantMessage: fallback(input.locale),
      disposition: "unsupported_account_question",
      needsHumanSupport: true,
      accountHelperMetadata: {
        helper: input.route.helper,
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        authenticated: false,
        requiredInputPresent: true,
        deniedReason: "unauthenticated",
        serverAuthored: true,
      },
    };
  }

  const result = await callHelper(accountContext, input.route);

  if (!result.ok) {
    return {
      assistantMessage:
        result.reason === "missing_reference"
          ? missingReferenceMessage({
              kind: "missing_reference",
              helper: input.route.helper,
              referenceType: input.route.input.referenceType,
            })
          : fallback(input.locale),
      disposition:
        result.reason === "missing_reference"
          ? "uncertain"
          : "unsupported_account_question",
      needsHumanSupport: result.reason !== "missing_reference",
      accountHelperMetadata: {
        helper: input.route.helper,
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        deniedReason: result.reason,
        authenticated,
        requiredInputPresent: result.reason !== "missing_reference",
        serverAuthored: true,
      },
    };
  }

  return {
    assistantMessage: successMessage(result.data, input.route.responseIntent),
    disposition: "answered",
    needsHumanSupport: false,
    accountHelperMetadata: {
      helper: input.route.helper,
      helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
      resultCategory: result.data.resultCategory,
      authenticated,
      requiredInputPresent: true,
      serverAuthored: true,
    },
  };
}

export async function buildAccountAwareActionResponse(input: {
  token: string;
  threadId: string;
  accountContext?: AccountCtx;
  locale: AppLang;
}): Promise<AccountAwareServerResponse> {
  const authenticated = Boolean(input.accountContext?.userId);
  const verified = verifyAccountCandidateActionToken({
    token: input.token,
    threadId: input.threadId,
  });

  if (!verified.ok) {
    return {
      assistantMessage: fallback(input.locale),
      disposition: "unsupported_account_question",
      needsHumanSupport: true,
      accountHelperMetadata: {
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        authenticated,
        requiredInputPresent: true,
        serverAuthored: true,
      },
    };
  }

  const response = await buildAccountAwareServerResponse({
    route: {
      kind: "helper",
      helper: verified.helper,
      input: verified.input,
    },
    accountContext: input.accountContext,
    locale: input.locale,
    threadId: input.threadId,
  });

  if (response.disposition !== "answered") return response;

  return {
    ...response,
    // The context token is only a short-lived reference hint. Every follow-up
    // still calls the exact helper again, so ownership is rechecked server-side.
    selectedOrderContext: {
      type: "selected_order",
      token: createSelectedOrderContextToken({
        reference: verified.input.reference,
        threadId: input.threadId,
        displayLabel: verified.displayLabel,
        displayDescription: verified.displayDescription,
      }),
      label: verified.displayLabel,
      description: verified.displayDescription,
    },
  };
}
