import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import { getSupportChatCopy } from "@/modules/support-chat/server/support-chat-copy";
import type { TRPCContext } from "@/trpc/init";
import {
  canCancelOrderForCurrentUser,
  getOrderStatusForCurrentUser,
  getPaymentStatusForCurrentUser,
} from "./helpers";
import type { SupportAccountRoute } from "./routing";
import type {
  SupportAccountHelperDeniedReason,
  SupportAccountHelperDTO,
  SupportAccountHelperName,
} from "./types";
import { SUPPORT_ACCOUNT_HELPER_VERSION } from "./versioning";

type AccountCtx = Pick<TRPCContext, "db" | "userId">;

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
};

function fallback(locale: AppLang) {
  return getSupportChatCopy(locale).serverMessages.unsupportedAccount;
}

function missingReferenceMessage(route: Extract<SupportAccountRoute, { kind: "missing_reference" }>) {
  if (route.referenceType === "invoice_id") {
    return "Please provide the exact invoice ID so I can check that safely.";
  }
  return "Please provide the exact order ID so I can check that safely.";
}

function orderStatusMessage(data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>) {
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

function paymentStatusMessage(data: Extract<SupportAccountHelperDTO, { resultCategory: "payment_status" }>) {
  if (data.paymentStatusCategory === "paid") {
    return "This payment is marked paid.";
  }
  if (data.invoiceStatusCategory === "issued" || data.invoiceStatusCategory === "overdue") {
    return "A payment is pending for this order or invoice. You can open the invoice from your Orders page.";
  }
  if (data.invoiceStatusCategory === "none" || data.paymentStatusCategory === "not_due") {
    return "Payment is not due for this order yet.";
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

function successMessage(data: SupportAccountHelperDTO) {
  switch (data.resultCategory) {
    case "order_status":
      return orderStatusMessage(data);
    case "payment_status":
      return paymentStatusMessage(data);
    case "cancellation_eligibility":
      return cancellationMessage(data);
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
}): Promise<AccountAwareServerResponse> {
  const authenticated = Boolean(input.accountContext?.userId);

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

  if (!input.accountContext) {
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

  const result = await callHelper(input.accountContext, input.route);

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
    assistantMessage: successMessage(result.data),
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
