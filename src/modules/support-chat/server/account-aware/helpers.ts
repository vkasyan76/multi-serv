import "server-only";

import { TRPCError } from "@trpc/server";

import type { Booking, Invoice, Order } from "@/payload-types";
import { resolvePayloadUserId } from "@/modules/orders/server/identity";
import {
  getSlotOrderCancelability,
  type SlotOrderCancellationBlockReason,
} from "@/modules/orders/server/order-cancelability";
import type { TRPCContext } from "@/trpc/init";
import type {
  SupportAccountCancellationBlockReason,
  SupportAccountHelperDeniedReason,
  SupportAccountHelperInput,
  SupportAccountHelperResult,
  SupportAccountInvoiceStatusCategory,
  SupportAccountNextStepKey,
  SupportAccountOrderServiceStatusCategory,
  SupportAccountPaymentStatusCategory,
  SupportCancellationEligibilityDTO,
  SupportOrderStatusDTO,
  SupportOrderCandidateDTO,
  SupportOrderCandidateListDTO,
  SupportPaymentStatusDTO,
} from "./types";

type RelValue = string | { id?: string } | null | undefined;
type DocWithId<T> = T & { id: string };
type HelperCtx = Pick<TRPCContext, "db" | "userId">;

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function isPayloadObjectId(value: string) {
  return OBJECT_ID_RE.test(value);
}

function relId(value: RelValue) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.id === "string") return value.id;
  return null;
}

function normalizeReference(reference: string) {
  return reference.trim();
}

function denied(reason: SupportAccountHelperDeniedReason) {
  return { ok: false as const, reason };
}

function validateExactReference(input: SupportAccountHelperInput) {
  const reference = normalizeReference(input.reference);
  if (!reference) return denied("missing_reference");
  if (!isPayloadObjectId(reference)) {
    return denied("invalid_reference");
  }
  return { ok: true as const, reference };
}

async function resolveCurrentPayloadUserId(ctx: HelperCtx) {
  if (!ctx.userId) {
    return denied("unauthenticated");
  }

  try {
    return {
      ok: true as const,
      payloadUserId: await resolvePayloadUserId(ctx, ctx.userId),
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      if (error.code === "UNAUTHORIZED") {
        return denied("unauthenticated");
      }
      if (error.code === "FORBIDDEN") {
        return denied("not_found_or_not_owned");
      }
    }
    throw error;
  }
}

async function loadOwnedOrderById(
  ctx: HelperCtx,
  payloadUserId: string,
  orderId: string,
) {
  const order = (await ctx.db.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  })) as DocWithId<Order> | null;

  if (!order || relId(order.user) !== payloadUserId) {
    return denied("not_found_or_not_owned");
  }

  return { ok: true as const, order };
}

async function loadOwnedInvoiceById(
  ctx: HelperCtx,
  payloadUserId: string,
  invoiceId: string,
) {
  const invoice = (await ctx.db.findByID({
    collection: "invoices",
    id: invoiceId,
    depth: 0,
    overrideAccess: true,
  })) as DocWithId<Invoice> | null;

  if (!invoice || relId(invoice.customer) !== payloadUserId) {
    return denied("not_found_or_not_owned");
  }

  return { ok: true as const, invoice };
}

function serviceStatusCategory(
  order: Pick<Order, "status" | "serviceStatus">,
): SupportAccountOrderServiceStatusCategory {
  if (order.status === "canceled") return "canceled";
  switch (order.serviceStatus) {
    case "requested":
    case "scheduled":
    case "completed":
    case "accepted":
    case "disputed":
      return order.serviceStatus;
    default:
      return "unknown";
  }
}

function invoiceStatusCategory(
  status: Order["invoiceStatus"] | Invoice["status"] | null | undefined,
): SupportAccountInvoiceStatusCategory {
  switch (status) {
    case "none":
    case "draft":
    case "issued":
    case "overdue":
    case "paid":
    case "void":
      return status;
    default:
      return "unknown";
  }
}

function orderPaymentStatusCategory(
  order: Pick<Order, "status" | "invoiceStatus">,
): SupportAccountPaymentStatusCategory {
  switch (order.status) {
    case "paid":
      return "paid";
    case "canceled":
      return "canceled";
    case "refunded":
      return "refunded";
    case "pending":
      return order.invoiceStatus === "issued" ||
        order.invoiceStatus === "overdue" ||
        order.invoiceStatus === "draft"
        ? "pending"
        : "not_due";
    default:
      return "unknown";
  }
}

function invoicePaymentStatusCategory(
  invoice: Pick<Invoice, "status">,
): SupportAccountPaymentStatusCategory {
  switch (invoice.status) {
    case "paid":
      return "paid";
    case "draft":
    case "issued":
    case "overdue":
      return "pending";
    case "void":
      return "canceled";
    default:
      return "unknown";
  }
}

function orderNextStepKey(order: Pick<Order, "serviceStatus" | "invoiceStatus">) {
  if (order.serviceStatus === "requested") return "await_provider_confirmation";
  if (order.invoiceStatus === "issued" || order.invoiceStatus === "overdue") {
    return "pay_invoice";
  }
  if (order.invoiceStatus === "paid") return "no_action_needed";
  return "view_orders";
}

function paymentNextStepKey(
  paymentStatus: SupportAccountPaymentStatusCategory,
  invoiceStatus: SupportAccountInvoiceStatusCategory,
): SupportAccountNextStepKey {
  if (paymentStatus === "paid") return "no_action_needed";
  if (invoiceStatus === "issued" || invoiceStatus === "overdue") {
    return "pay_invoice";
  }
  if (invoiceStatus === "draft" || invoiceStatus === "void") {
    return "view_invoice";
  }
  return "view_orders";
}

function cancellationBlockReason(
  reason: SlotOrderCancellationBlockReason | undefined,
): SupportAccountCancellationBlockReason | undefined {
  switch (reason) {
    case "already_canceled":
    case "order_paid":
    case "not_slot_order":
    case "wrong_service_status":
    case "invoice_exists":
    case "missing_slots":
    case "invalid_slot_dates":
    case "cutoff_passed":
    case "slot_paid":
      return reason;
    case undefined:
      return undefined;
    default:
      return "unknown";
  }
}

function firstPopulatedSlotStart(order: Pick<Order, "slots">) {
  const starts = (order.slots ?? [])
    .map((slot) => (typeof slot === "string" ? null : slot?.start))
    .filter((value): value is string => typeof value === "string");

  if (!starts.length) return undefined;

  const times = starts
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  if (!times.length) return undefined;

  return new Date(Math.min(...times)).toISOString();
}

function orderCandidate(order: DocWithId<Order>): SupportOrderCandidateDTO {
  const paymentStatus = orderPaymentStatusCategory(order);
  const invoiceStatus = invoiceStatusCategory(order.invoiceStatus);
  const tenantDisplayName = order.vendorSnapshot?.tenantName?.trim();

  return {
    orderId: order.id,
    serviceStatusCategory: serviceStatusCategory(order),
    paymentStatusCategory: paymentStatus,
    invoiceStatusCategory: invoiceStatus,
    createdAt: order.createdAt,
    firstSlotStart: firstPopulatedSlotStart(order),
    tenantDisplayName: tenantDisplayName || undefined,
    nextStepKey: orderNextStepKey(order),
  };
}

export async function getOrderStatusForCurrentUser(
  ctx: HelperCtx,
  input: SupportAccountHelperInput,
): Promise<SupportAccountHelperResult<SupportOrderStatusDTO>> {
  if (input.referenceType !== "order_id") {
    return { ok: false, reason: "unsupported_reference_type" };
  }

  const reference = validateExactReference(input);
  if (!reference.ok) return reference;

  const identity = await resolveCurrentPayloadUserId(ctx);
  if (!identity.ok) return identity;

  const ownedOrder = await loadOwnedOrderById(
    ctx,
    identity.payloadUserId,
    reference.reference,
  );
  if (!ownedOrder.ok) return ownedOrder;

  const { order } = ownedOrder;
  const paymentStatus = orderPaymentStatusCategory(order);
  const invoiceStatus = invoiceStatusCategory(order.invoiceStatus);

  return {
    ok: true,
    data: {
      helper: "getOrderStatusForCurrentUser",
      referenceType: "order_id",
      resultCategory: "order_status",
      serviceStatusCategory: serviceStatusCategory(order),
      paymentStatusCategory: paymentStatus,
      invoiceStatusCategory: invoiceStatus,
      nextStepKey: orderNextStepKey(order),
      createdAt: order.createdAt,
      firstSlotStart: firstPopulatedSlotStart(order),
      lastUpdatedAt: order.updatedAt,
    },
  };
}

export async function getPaymentStatusForCurrentUser(
  ctx: HelperCtx,
  input: SupportAccountHelperInput,
): Promise<SupportAccountHelperResult<SupportPaymentStatusDTO>> {
  if (input.referenceType !== "order_id" && input.referenceType !== "invoice_id") {
    return { ok: false, reason: "unsupported_reference_type" };
  }

  const reference = validateExactReference(input);
  if (!reference.ok) return reference;

  const identity = await resolveCurrentPayloadUserId(ctx);
  if (!identity.ok) return identity;

  if (input.referenceType === "invoice_id") {
    const ownedInvoice = await loadOwnedInvoiceById(
      ctx,
      identity.payloadUserId,
      reference.reference,
    );
    if (!ownedInvoice.ok) return ownedInvoice;

    const { invoice } = ownedInvoice;
    const paymentStatus = invoicePaymentStatusCategory(invoice);
    const invoiceStatus = invoiceStatusCategory(invoice.status);

    return {
      ok: true,
      data: {
        helper: "getPaymentStatusForCurrentUser",
        referenceType: "invoice_id",
        resultCategory: "payment_status",
        paymentStatusCategory: paymentStatus,
        invoiceStatusCategory: invoiceStatus,
        nextStepKey: paymentNextStepKey(paymentStatus, invoiceStatus),
        issuedAt: invoice.issuedAt ?? undefined,
        paidAt: invoice.paidAt ?? undefined,
      },
    };
  }

  const ownedOrder = await loadOwnedOrderById(
    ctx,
    identity.payloadUserId,
    reference.reference,
  );
  if (!ownedOrder.ok) return ownedOrder;

  const { order } = ownedOrder;
  const paymentStatus = orderPaymentStatusCategory(order);
  const invoiceStatus = invoiceStatusCategory(order.invoiceStatus);

  return {
    ok: true,
    data: {
      helper: "getPaymentStatusForCurrentUser",
      referenceType: "order_id",
      resultCategory: "payment_status",
      paymentStatusCategory: paymentStatus,
      invoiceStatusCategory: invoiceStatus,
      nextStepKey: paymentNextStepKey(paymentStatus, invoiceStatus),
      issuedAt: order.invoiceIssuedAt ?? undefined,
      paidAt: order.paidAt ?? undefined,
      paymentDueAt: order.paymentDueAt ?? undefined,
    },
  };
}

export async function canCancelOrderForCurrentUser(
  ctx: HelperCtx,
  input: SupportAccountHelperInput,
): Promise<SupportAccountHelperResult<SupportCancellationEligibilityDTO>> {
  if (input.referenceType !== "order_id") {
    return { ok: false, reason: "unsupported_reference_type" };
  }

  const reference = validateExactReference(input);
  if (!reference.ok) return reference;

  const identity = await resolveCurrentPayloadUserId(ctx);
  if (!identity.ok) return identity;

  const ownedOrder = await loadOwnedOrderById(
    ctx,
    identity.payloadUserId,
    reference.reference,
  );
  if (!ownedOrder.ok) return ownedOrder;

  const cancelability = await getSlotOrderCancelability(
    ctx.db,
    ownedOrder.order,
    new Date(),
    { allowRequested: true },
  );

  return {
    ok: true,
    data: {
      helper: "canCancelOrderForCurrentUser",
      referenceType: "order_id",
      resultCategory: "cancellation_eligibility",
      canCancel: cancelability.cancelable,
      blockReason: cancellationBlockReason(cancelability.reason),
      nextStepKey: cancelability.cancelable ? "cancel_in_app" : "view_orders",
      firstSlotStart: cancelability.firstSlotStart,
      cutoffAt: cancelability.cutoffAt,
    },
  };
}

export async function getRecentSupportOrderCandidatesForCurrentUser(
  ctx: HelperCtx,
): Promise<SupportAccountHelperResult<SupportOrderCandidateListDTO>> {
  const identity = await resolveCurrentPayloadUserId(ctx);
  if (!identity.ok) return identity;

  // Candidate resolution is intentionally narrow: a fixed recent owned slot-order
  // list, not a text-derived account search or relationship enrichment path.
  const result = (await ctx.db.find({
    collection: "orders",
    where: {
      user: { equals: identity.payloadUserId },
      lifecycleMode: { equals: "slot" },
    },
    limit: 3,
    sort: "-createdAt",
    depth: 0,
    overrideAccess: true,
  })) as { docs: Array<DocWithId<Order>> };

  return {
    ok: true,
    data: {
      helper: "getRecentSupportOrderCandidatesForCurrentUser",
      resultCategory: "order_candidates",
      candidates: result.docs.map(orderCandidate),
    },
  };
}
