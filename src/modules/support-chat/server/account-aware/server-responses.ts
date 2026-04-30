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
  SupportAccountAnswerMode,
  SupportAccountHelperDeniedReason,
  SupportAccountHelperDTO,
  SupportAccountHelperName,
  SupportAccountRewriteRejectedReason,
  SupportOrderCandidateDTO,
  SupportOrderCandidateStatusFilter,
} from "./types";
import { getAccountAwareCopy, type AccountAwareLocalizedCopy } from "./localized-copy";
import { SUPPORT_ACCOUNT_HELPER_VERSION } from "./versioning";
import { rewriteAccountAwareServerResponse } from "./account-rewrite";

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
  actionTokenReason?: "invalid_token" | "expired_token";
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
  accountAnswerMode?: SupportAccountAnswerMode;
  accountRewriteModel?: string;
  accountRewriteModelVersion?: string;
  accountRewriteRejectedReason?: SupportAccountRewriteRejectedReason;
  accountRewriteFallbackUsed?: boolean;
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

function deterministicResponse(
  response: AccountAwareServerResponse,
): AccountAwareServerResponse {
  return {
    accountAnswerMode: "server_deterministic",
    ...response,
  };
}

function categoryLabel(value: string, copy: AccountAwareLocalizedCopy) {
  return copy.statusLabels[value] ?? value.replaceAll("_", " ");
}

function formatCandidateDate(value: string | undefined, locale: AppLang) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function paymentSummary(input: {
  paymentStatusCategory: string;
  invoiceStatusCategory: string;
}, copy: AccountAwareLocalizedCopy) {
  if (
    input.invoiceStatusCategory === "issued" ||
    input.invoiceStatusCategory === "overdue"
  ) {
    return copy.paymentSummary.payment(
      categoryLabel(input.paymentStatusCategory, copy),
    );
  }
  if (
    input.invoiceStatusCategory !== "none" &&
    input.invoiceStatusCategory !== "unknown"
  ) {
    return copy.paymentSummary.invoice(
      categoryLabel(input.invoiceStatusCategory, copy),
    );
  }
  return copy.paymentSummary.payment(
    categoryLabel(input.paymentStatusCategory, copy),
  );
}

function candidateActionLabel(
  candidate: SupportOrderCandidateDTO,
  locale: AppLang,
) {
  return [
    candidate.tenantDisplayName,
    ...(candidate.serviceNames ?? []),
    formatCandidateDate(candidate.firstSlotStart ?? candidate.createdAt, locale),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" - ");
}

function candidateActionDescription(
  candidate: SupportOrderCandidateDTO,
  copy: AccountAwareLocalizedCopy,
) {
  return [
    categoryLabel(candidate.serviceStatusCategory, copy),
    paymentSummary(candidate, copy),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" - ");
}

function candidateActions(input: {
  candidates: SupportOrderCandidateDTO[];
  helper: AccountCandidateSelectionHelper;
  threadId: string;
  locale: AppLang;
}): SupportChatAction[] {
  const copy = getAccountAwareCopy(input.locale);
  return input.candidates.map((candidate, index) => {
    const label =
      candidateActionLabel(candidate, input.locale) || copy.candidate.fallbackLabel;
    const description = candidateActionDescription(candidate, copy);
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

function candidateSelectionMessage(
  candidates: SupportOrderCandidateDTO[],
  copy: AccountAwareLocalizedCopy,
) {
  if (!candidates.length) {
    return copy.candidate.none;
  }

  return candidates.length === 1 ? copy.candidate.one : copy.candidate.many;
}

function statusFilterLabel(
  filter: SupportOrderCandidateStatusFilter,
  copy: AccountAwareLocalizedCopy,
) {
  return copy.statusFilterLabels[filter] ?? filter.replaceAll("_", " ");
}

function filteredCandidateSelectionMessage(
  candidates: SupportOrderCandidateDTO[],
  statusFilter: SupportOrderCandidateStatusFilter | undefined,
  copy: AccountAwareLocalizedCopy,
) {
  if (!statusFilter) return candidateSelectionMessage(candidates, copy);

  const label = statusFilterLabel(statusFilter, copy);
  if (!candidates.length) {
    return copy.candidate.filteredNone(label);
  }

  return candidates.length === 1
    ? copy.candidate.filteredOne(label)
    : copy.candidate.filteredMany(label);
}

function missingReferenceMessage(
  route: Extract<SupportAccountRoute, { kind: "missing_reference" }>,
  copy: AccountAwareLocalizedCopy,
) {
  if (route.referenceType === "invoice_id") {
    return copy.missingReference.invoice;
  }
  return copy.missingReference.order;
}

function orderStatusHeadline(
  data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>,
  copy: AccountAwareLocalizedCopy,
) {
  const role = data.accessRole === "tenant" ? "tenant" : "customer";
  return (
    copy.orderHeadline[role][
      data.serviceStatusCategory as keyof typeof copy.orderHeadline.customer
    ] ?? copy.orderHeadline[role].unknown
  );
}

function statusReasonLabel(
  data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>,
  copy: AccountAwareLocalizedCopy,
) {
  const role = data.accessRole === "tenant" ? "tenant" : "customer";
  return copy.statusReason[role][data.statusReasonKey];
}

function nextStepLabel(
  data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>,
  copy: AccountAwareLocalizedCopy,
) {
  const role = data.accessRole === "tenant" ? "tenant" : "customer";
  return copy.nextStep[role][data.nextStepKey];
}

function orderStatusMessage(
  data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>,
  locale: AppLang,
  copy: AccountAwareLocalizedCopy,
) {
  const lines = [orderStatusHeadline(data, copy)];

  // Account-aware responses are server-authored but still locale-specific.
  // Keep DTO categories stable; localize only rendered user-facing copy.
  // Keep the summary deterministic and bounded to fields the helper already
  // sanitized; do not expose raw order records, Stripe data, or internal notes.
  const context = [
    data.providerDisplayName
      ? `${copy.fieldLabels.provider}: ${data.providerDisplayName}`
      : undefined,
    data.serviceNames?.length
      ? `${copy.fieldLabels.service}: ${data.serviceNames.join(", ")}`
      : undefined,
    formatCandidateDate(data.firstSlotStart ?? data.createdAt, locale)
      ? `${copy.fieldLabels.date}: ${formatCandidateDate(data.firstSlotStart ?? data.createdAt, locale)}`
      : undefined,
    `${copy.fieldLabels.status}: ${categoryLabel(data.serviceStatusCategory, copy)}`,
    `${copy.fieldLabels.payment}: ${paymentSummary(data, copy)}`,
  ].filter((value): value is string => Boolean(value));

  if (context.length) {
    lines.push(context.join("\n"));
  }

  const reason = statusReasonLabel(data, copy);
  if (reason) lines.push(`${copy.fieldLabels.reason}: ${reason}`);
  if (data.publicStatusReason) {
    lines.push(`${copy.fieldLabels.note}: ${data.publicStatusReason}`);
  }

  const nextStep = nextStepLabel(data, copy);
  if (nextStep) lines.push(`${copy.fieldLabels.nextStep}: ${nextStep}`);

  return lines.join("\n\n");
}

function invoiceLifecycleExplanationMessage(
  data: Extract<SupportAccountHelperDTO, { resultCategory: "order_status" }>,
  copy: AccountAwareLocalizedCopy,
) {
  const role = data.accessRole === "tenant" ? "tenant" : "customer";
  const roleCopy = copy.invoiceLifecycle[role];

  if (data.invoiceStatusCategory === "issued" || data.invoiceStatusCategory === "overdue") {
    return roleCopy.issued;
  }

  if (data.invoiceStatusCategory === "paid") {
    return roleCopy.paid;
  }

  if (data.invoiceStatusCategory === "void") {
    return roleCopy.void;
  }

  switch (data.serviceStatusCategory) {
    case "requested":
      return roleCopy.requested;
    case "scheduled":
      return roleCopy.scheduled;
    case "completed":
    case "accepted":
      return roleCopy.completed;
    case "canceled":
      return roleCopy.canceled;
    default:
      return roleCopy.unknown;
  }
}

function paymentStatusMessage(
  data: Extract<SupportAccountHelperDTO, { resultCategory: "payment_status" }>,
  copy: AccountAwareLocalizedCopy,
) {
  if (data.paymentStatusCategory === "paid") {
    return copy.paymentStatus.paid;
  }
  if (data.invoiceStatusCategory === "issued" || data.invoiceStatusCategory === "overdue") {
    return copy.paymentStatus.pending;
  }
  if (data.invoiceStatusCategory === "none" || data.paymentStatusCategory === "not_due") {
    switch (data.serviceStatusCategory) {
      case "requested":
        return copy.paymentStatus.notDueRequested;
      case "scheduled":
        return copy.paymentStatus.notDueScheduled;
      case "completed":
      case "accepted":
        return copy.paymentStatus.notDueCompleted;
      case "canceled":
        return copy.paymentStatus.notDueCanceled;
      default:
        return copy.paymentStatus.notDue;
    }
  }
  if (data.invoiceStatusCategory === "void" || data.paymentStatusCategory === "canceled") {
    return copy.paymentStatus.void;
  }
  return copy.paymentStatus.unknown;
}

function cancellationMessage(
  data: Extract<SupportAccountHelperDTO, { resultCategory: "cancellation_eligibility" }>,
  copy: AccountAwareLocalizedCopy,
) {
  if (data.canCancel) {
    return copy.cancellation.eligible;
  }
  return copy.cancellation.notEligible;
}

function paymentOverviewMessage(
  data: Extract<SupportAccountHelperDTO, { resultCategory: "payment_overview" }>,
  copy: AccountAwareLocalizedCopy,
) {
  if (data.inspectedOrderCount === 0) {
    return copy.overview.none;
  }

  const parts = [
    copy.overview.counts.paidOrders(data.categories.paid),
    copy.overview.counts.paymentPending(data.categories.paymentPending),
    copy.overview.counts.paymentNotDue(data.categories.paymentNotDue),
    copy.overview.counts.paymentCanceled(data.categories.paymentCanceled),
    copy.overview.counts.refunded(data.categories.refunded),
  ];

  if (data.categories.unknown > 0) {
    parts.push(copy.overview.counts.unknown(data.categories.unknown));
  }

  // This wording is intentionally deterministic: the helper returns a bounded
  // recent-order summary, not a complete payment ledger or Stripe timeline.
  return [
    copy.overview.summary(parts.join(", ")),
    copy.overview.inspected(
      copy.overview.counts.inspectedOrders(data.inspectedOrderCount),
    ),
  ].join("\n\n");
}

function successMessage(
  data: SupportAccountHelperDTO,
  locale: AppLang,
  responseIntent?: AccountResponseIntent,
) {
  const copy = getAccountAwareCopy(locale);
  switch (data.resultCategory) {
    case "order_status":
      if (responseIntent === "invoice_lifecycle_explanation") {
        return invoiceLifecycleExplanationMessage(data, copy);
      }
      return orderStatusMessage(data, locale, copy);
    case "payment_status":
      return paymentStatusMessage(data, copy);
    case "cancellation_eligibility":
      return cancellationMessage(data, copy);
    case "payment_overview":
      return paymentOverviewMessage(data, copy);
    default:
      return copy.genericAccountItem;
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
  const accountCopy = getAccountAwareCopy(input.locale);

  if (!authenticated) {
    return deterministicResponse({
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
    });
  }

  if (input.route.kind === "missing_reference") {
    return deterministicResponse({
      assistantMessage: missingReferenceMessage(input.route, accountCopy),
      disposition: "uncertain",
      needsHumanSupport: false,
      accountHelperMetadata: {
        helper: input.route.helper,
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        authenticated,
        requiredInputPresent: false,
        serverAuthored: true,
      },
    });
  }

  if (input.route.kind === "payment_overview") {
    const accountContext = input.accountContext;
    if (!accountContext) {
      return deterministicResponse({
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
      });
    }

    const result = await getSupportPaymentOverviewForCurrentUser(accountContext);

    if (!result.ok) {
      return deterministicResponse({
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
      });
    }

    return rewriteAccountAwareServerResponse({
      response: deterministicResponse({
        assistantMessage: successMessage(result.data, input.locale),
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
      }),
      helperResult: result.data,
      locale: input.locale,
      threadId: input.threadId,
    });
  }

  if (input.route.kind === "candidate_selection") {
    const accountContext = input.accountContext;
    if (!accountContext) {
      return deterministicResponse({
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
      });
    }

    const result = await getSupportOrderCandidatesForCurrentUser(accountContext, {
      statusFilter: input.route.statusFilter,
    });

    if (!result.ok) {
      return deterministicResponse({
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
      });
    }

    return deterministicResponse({
      assistantMessage: filteredCandidateSelectionMessage(
        result.data.candidates,
        input.route.statusFilter,
        accountCopy,
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
        locale: input.locale,
      }),
    });
  }

  if (input.route.kind === "broad_or_deferred" || input.route.kind === "unsupported_reference") {
    return deterministicResponse({
      assistantMessage: fallback(input.locale),
      disposition: "unsupported_account_question",
      needsHumanSupport: true,
      accountHelperMetadata: {
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        authenticated,
        requiredInputPresent: false,
        serverAuthored: true,
      },
    });
  }

  const accountContext = input.accountContext;
  if (!accountContext) {
    return deterministicResponse({
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
    });
  }

  const result = await callHelper(accountContext, input.route);

  if (!result.ok) {
    return deterministicResponse({
      assistantMessage:
        result.reason === "missing_reference"
          ? missingReferenceMessage(
              {
                kind: "missing_reference",
                helper: input.route.helper,
                referenceType: input.route.input.referenceType,
              },
              accountCopy,
            )
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
    });
  }

  return rewriteAccountAwareServerResponse({
    response: deterministicResponse({
      assistantMessage: successMessage(
        result.data,
        input.locale,
        input.route.responseIntent,
      ),
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
    }),
    helperResult: result.data,
    locale: input.locale,
    threadId: input.threadId,
  });
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
    if (verified.reason === "expired_token") {
      return deterministicResponse({
        assistantMessage: getAccountAwareCopy(input.locale).actionTokenExpired,
        disposition: "uncertain",
        needsHumanSupport: false,
        accountHelperMetadata: {
          helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
          authenticated,
          requiredInputPresent: true,
          actionTokenReason: verified.reason,
          serverAuthored: true,
        },
      });
    }

    return deterministicResponse({
      assistantMessage: fallback(input.locale),
      disposition: "unsupported_account_question",
      needsHumanSupport: true,
      accountHelperMetadata: {
        helperVersion: SUPPORT_ACCOUNT_HELPER_VERSION,
        authenticated,
        requiredInputPresent: true,
        actionTokenReason: verified.reason,
        serverAuthored: true,
      },
    });
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
