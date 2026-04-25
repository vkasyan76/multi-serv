import "server-only";
// src/modules/orders/server/procedures.ts
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import type { Order, Booking, Tenant } from "@/payload-types";
import { z } from "zod";
import { resolvePayloadUserId } from "./identity";
import {
  getSlotOrderCancelability,
  type SlotOrderCancellationBlockReason,
} from "./order-cancelability";
import {
  loadOrderSlotsForRelease,
  releaseOrderSlotsToAvailable,
  isReleasedOrderSlot,
  type OrderSlotReleaseMode,
  type OrderSlotReleaseSnapshot,
} from "./order-slot-release";
import {
  listMineSlotLifecycle as listMineSlotLifecycleImpl,
  listForMyTenantSlotLifecycle as listForMyTenantSlotLifecycleImpl,
  listForAdminSlotLifecycle as listForAdminSlotLifecycleImpl,
  exportAdminSlotLifecycleRows as exportAdminSlotLifecycleRowsImpl,
  listAdminOrderCustomerOptions as listAdminOrderCustomerOptionsImpl,
} from "./order-rollup";

type DocWithId<T> = T & { id: string }; // Payload returns docs with an id

// orders where tenant is either an ID string or a populated Tenant
type OrderWithTenantRef = Order & {
  tenant?: string | Tenant | null;
};

type CancelableSlotOrder = DocWithId<
  Pick<
    Order,
    | "id"
    | "canceledAt"
    | "canceledByRole"
    | "cancelReason"
    | "user"
    | "tenant"
    | "slots"
    | "status"
    | "serviceStatus"
    | "invoiceStatus"
    | "lifecycleMode"
  >
>;

type CancelAttemptSnapshot = {
  canceledAt: string;
  canceledByRole: "customer" | "tenant";
  cancelReason: string | null;
};

type OrderModelLike = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
};

function relId(
  value: string | { id?: string | null } | null | undefined,
): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

function cancelConflictMessage(
  reason: SlotOrderCancellationBlockReason | undefined,
): string {
  switch (reason) {
    case "already_canceled":
      return "orders.errors.cancel_already_canceled";
    case "order_paid":
    case "invoice_exists":
    case "slot_paid":
      return "orders.errors.cancel_payment_locked";
    case "cutoff_passed":
      return "orders.errors.cancel_cutoff_passed";
    case "missing_slots":
    case "invalid_slot_dates":
      return "orders.errors.cancel_invalid_slots";
    case "not_slot_order":
    case "wrong_service_status":
    default:
      return "orders.errors.cancel_not_allowed";
  }
}

function getOrdersModel(ctx: TRPCContext): OrderModelLike | null {
  const dbRoot = ctx.db as unknown as {
    db?: { collections?: Record<string, unknown> };
    collections?: Record<string, unknown>;
  };
  const collections = dbRoot.db?.collections ?? dbRoot.collections ?? null;
  if (!collections) return null;

  const model = collections["orders"];
  if (!model) return null;

  if (
    typeof (model as { findOneAndUpdate?: unknown }).findOneAndUpdate !==
    "function"
  ) {
    return null;
  }

  return model as OrderModelLike;
}

function logCancelDebug(meta: Record<string, unknown>) {
  if (process.env.DEBUG_ORDER_CANCEL !== "1") return;
  if (process.env.NODE_ENV === "production") return;
  console.log("[orders:cancel]", meta);
}

async function loadOrderForCancellation(
  ctx: TRPCContext,
  orderId: string,
): Promise<CancelableSlotOrder> {
  const order = (await ctx.db.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  })) as CancelableSlotOrder | null;

  if (!order) throw new TRPCError({ code: "NOT_FOUND" });
  return order;
}

async function assertTenantOwnsOrder(
  ctx: TRPCContext,
  payloadUserId: string,
  order: CancelableSlotOrder,
): Promise<void> {
  const tenantId = relId(order.tenant);
  if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

  const tenant = (await ctx.db.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as DocWithId<Tenant> | null;

  if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

  const ownerId = relId(tenant.user);
  if (!ownerId || ownerId !== payloadUserId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

function toOrderSlotIds(order: Pick<Order, "slots">): string[] {
  return [
    ...new Set(
      (order.slots ?? [])
        .map((slot) => (typeof slot === "string" ? slot : slot?.id))
        .filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
    ),
  ];
}

function requestedTenantDecisionConflictMessage(order: CancelableSlotOrder) {
  if (order.lifecycleMode !== "slot") {
    return "orders.errors.not_slot_lifecycle_order";
  }

  if (order.status === "canceled") {
    return "orders.errors.already_canceled";
  }

  return "orders.errors.not_awaiting_tenant_confirmation";
}

function assertRequestedTenantDecisionAllowed(order: CancelableSlotOrder) {
  if (
    order.lifecycleMode !== "slot" ||
    order.status === "canceled" ||
    order.serviceStatus !== "requested"
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: requestedTenantDecisionConflictMessage(order),
    });
  }
}

function assertRequestedDecisionSlots(
  slots: OrderSlotReleaseSnapshot[],
  expectedCount: number,
) {
  if (slots.length !== expectedCount) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "orders.errors.slots_not_awaiting_confirmation",
    });
  }

  const allRequested = slots.every(
    (slot) => slot.status === "confirmed" && slot.serviceStatus === "requested",
  );

  if (!allRequested) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "orders.errors.slots_not_awaiting_confirmation",
    });
  }
}

async function claimRequestedOrderServiceStatus(
  ctx: TRPCContext,
  order: CancelableSlotOrder,
  nextServiceStatus: "scheduled",
): Promise<boolean> {
  const ordersModel = getOrdersModel(ctx);
  if (!ordersModel) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "orders.errors.cancel_not_allowed",
    });
  }

  const updated = await ordersModel.findOneAndUpdate(
    {
      _id: order.id,
      lifecycleMode: "slot",
      status: order.status,
      serviceStatus: "requested",
      canceledAt: order.canceledAt ?? null,
      canceledByRole: order.canceledByRole ?? null,
      cancelReason: order.cancelReason ?? null,
    },
    {
      $set: {
        serviceStatus: nextServiceStatus,
      },
    },
    { new: true },
  );

  return !!updated;
}

async function claimSlotOrderCancellation(
  ctx: TRPCContext,
  order: CancelableSlotOrder,
  canceledAt: string,
  canceledByRole: "customer" | "tenant",
  cancelReason: string | undefined,
): Promise<boolean> {
  const ordersModel = getOrdersModel(ctx);
  if (!ordersModel) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "orders.errors.cancel_not_allowed",
    });
  }

  const updated = await ordersModel.findOneAndUpdate(
    {
      _id: order.id,
      status: order.status,
      canceledAt: order.canceledAt ?? null,
      canceledByRole: order.canceledByRole ?? null,
      cancelReason: order.cancelReason ?? null,
    },
    {
      $set: {
        status: "canceled",
        canceledAt,
        canceledByRole,
        cancelReason: cancelReason ?? null,
      },
    },
    { new: true },
  );

  return !!updated;
}

async function releaseCanceledOrderSlots(
  ctx: TRPCContext,
  slotIds: string[],
  orderUserId: string,
  mode: OrderSlotReleaseMode = "preserve_lifecycle",
): Promise<void> {
  await releaseOrderSlotsToAvailable(ctx, {
    slotIds,
    orderUserId,
    mode,
  });
}

async function rollbackCanceledOrderState(
  ctx: TRPCContext,
  order: CancelableSlotOrder,
  releaseSnapshot: OrderSlotReleaseSnapshot[],
  attempt: CancelAttemptSnapshot,
  releaseMode: OrderSlotReleaseMode,
) {
  // Backup compensation for the winning cancel attempt only.
  const currentOrder = (await ctx.db.findByID({
    collection: "orders",
    id: order.id,
    depth: 0,
    overrideAccess: true,
  })) as CancelableSlotOrder | null;

  const orderStillOwnedByAttempt =
    !!currentOrder &&
    currentOrder.status === "canceled" &&
    currentOrder.canceledAt === attempt.canceledAt &&
    currentOrder.canceledByRole === attempt.canceledByRole &&
    (currentOrder.cancelReason ?? null) === attempt.cancelReason;

  if (!orderStillOwnedByAttempt) {
    logCancelDebug({
      orderId: order.id,
      step: "rollback-skip-order-not-owned",
      canceledAt: attempt.canceledAt,
      canceledByRole: attempt.canceledByRole,
    });
    return;
  }

  const currentBookings = await Promise.all(
    releaseSnapshot.map(async (booking) => {
      const current = (await ctx.db.findByID({
        collection: "bookings",
        id: booking.id,
        depth: 0,
        overrideAccess: true,
      })) as OrderSlotReleaseSnapshot | null;

      return { snapshot: booking, current };
    }),
  );

  // Abort rollback if any slot no longer matches the released shape. This keeps
  // compensation all-or-nothing at the app level and avoids mixed state.
  const allBookingsStillReleased = currentBookings.every(({ current }) =>
    isReleasedOrderSlot(current, releaseMode),
  );

  if (!allBookingsStillReleased) {
    logCancelDebug({
      orderId: order.id,
      step: "rollback-skip-bookings-not-released",
      bookingIds: currentBookings.map(({ snapshot }) => snapshot.id),
    });
    return;
  }

  await Promise.all(
    currentBookings.map(({ snapshot }) =>
      ctx.db.update({
        collection: "bookings",
        id: snapshot.id,
        data: {
          status: snapshot.status,
          customer: relId(snapshot.customer),
          service: relId(snapshot.service),
          serviceStatus: snapshot.serviceStatus ?? null,
          paymentStatus: snapshot.paymentStatus ?? null,
          serviceSnapshot: snapshot.serviceSnapshot ?? undefined,
          serviceCompletedAt: snapshot.serviceCompletedAt ?? null,
          acceptedAt: snapshot.acceptedAt ?? null,
          disputedAt: snapshot.disputedAt ?? null,
          disputeReason: snapshot.disputeReason ?? null,
        },
        overrideAccess: true,
        depth: 0,
      }),
    ),
  );

  logCancelDebug({
    orderId: order.id,
    step: "rollback-restored-bookings",
    bookingIds: currentBookings.map(({ snapshot }) => snapshot.id),
  });

  await ctx.db.update({
    collection: "orders",
    id: order.id,
    data: {
      status: order.status,
      canceledAt: order.canceledAt ?? null,
      canceledByRole: order.canceledByRole ?? null,
      cancelReason: order.cancelReason ?? null,
    },
    overrideAccess: true,
    depth: 0,
  });

  logCancelDebug({
    orderId: order.id,
    step: "rollback-restored-order",
  });
}

async function cancelSlotOrder(
  ctx: TRPCContext,
  order: CancelableSlotOrder,
  canceledByRole: "customer" | "tenant",
  reason?: string,
  options: { allowRequested?: boolean } = {},
) {
  const cancelability = await getSlotOrderCancelability(
    ctx.db,
    order,
    new Date(),
    {
      allowRequested: options.allowRequested === true,
    },
  );
  if (!cancelability.cancelable) {
    throw new TRPCError({
      code: "CONFLICT",
      message: cancelConflictMessage(cancelability.reason),
    });
  }

  const orderUserId = relId(order.user);
  if (!orderUserId) throw new TRPCError({ code: "BAD_REQUEST" });

  const releaseSnapshot = await loadOrderSlotsForRelease(
    ctx,
    cancelability.slotIds,
    orderUserId,
  );

  if (releaseSnapshot.length !== cancelability.slotIds.length) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "orders.errors.cancel_release_failed",
    });
  }

  const canceledAt = new Date().toISOString();
  const cancelReason = reason?.trim() ? reason.trim() : undefined;
  const attempt: CancelAttemptSnapshot = {
    canceledAt,
    canceledByRole,
    cancelReason: cancelReason ?? null,
  };
  const attemptId = `${canceledByRole}:${canceledAt}`;
  const releaseMode: OrderSlotReleaseMode =
    order.serviceStatus === "requested"
      ? "clear_request_state"
      : "preserve_lifecycle";

  logCancelDebug({
    attemptId,
    orderId: order.id,
    step: "before-claim",
    canceledByRole,
  });

  const claimed = await claimSlotOrderCancellation(
    ctx,
    order,
    canceledAt,
    canceledByRole,
    cancelReason,
  );

  logCancelDebug({
    attemptId,
    orderId: order.id,
    step: "after-claim",
    claimed,
  });

  if (!claimed) {
    const latestOrder = await loadOrderForCancellation(ctx, order.id);
    const latestCancelability = await getSlotOrderCancelability(
      ctx.db,
      latestOrder,
      new Date(),
      { allowRequested: options.allowRequested === true },
    );

    logCancelDebug({
      attemptId,
      orderId: order.id,
      step: "throw-conflict",
      latestStatus: latestOrder.status,
      latestCanceledByRole: latestOrder.canceledByRole ?? null,
      latestReason: latestCancelability.reason ?? null,
    });

    throw new TRPCError({
      code: "CONFLICT",
      message: cancelConflictMessage(latestCancelability.reason),
    });
  }

  try {
    logCancelDebug({
      attemptId,
      orderId: order.id,
      step: "before-release",
      slotIds: cancelability.slotIds,
    });
    await releaseCanceledOrderSlots(
      ctx,
      cancelability.slotIds,
      orderUserId,
      releaseMode,
    );
    logCancelDebug({
      attemptId,
      orderId: order.id,
      step: "after-release",
    });
  } catch (error) {
    logCancelDebug({
      attemptId,
      orderId: order.id,
      step: "release-failed",
      error: error instanceof Error ? error.message : "unknown_release_error",
    });
    // Best-effort compensation keeps retries possible when slot release fails.
    try {
      await rollbackCanceledOrderState(
        ctx,
        order,
        releaseSnapshot,
        attempt,
        releaseMode,
      );
    } catch (rollbackErr) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "[orders] rollback after slot release failed",
          {
            orderId: order.id,
            releaseSnapshotIds: releaseSnapshot.map((booking) => booking.id),
            canceledAt,
          },
          rollbackErr,
        );
      }
    }
    throw error;
  }

  return {
    ok: true,
    orderId: order.id,
    status: "canceled" as const,
    canceledAt,
    slotIds: cancelability.slotIds,
  };
}

async function updateRequestedOrderSlotsToScheduled(
  ctx: TRPCContext,
  slotIds: string[],
  orderUserId: string,
) {
  const updateRes = await ctx.db.update({
    collection: "bookings",
    where: {
      and: [
        { id: { in: slotIds } },
        { customer: { equals: orderUserId } },
        { status: { equals: "confirmed" } },
        { serviceStatus: { equals: "requested" } },
      ],
    },
    data: {
      serviceStatus: "scheduled",
    },
    overrideAccess: true,
  });

  let updatedCount = Array.isArray(updateRes?.docs)
    ? updateRes.docs.length
    : null;

  if (updatedCount === null) {
    const verify = await ctx.db.find({
      collection: "bookings",
      where: {
        and: [
          { id: { in: slotIds } },
          { customer: { equals: orderUserId } },
          { status: { equals: "confirmed" } },
          { serviceStatus: { equals: "scheduled" } },
        ],
      },
      limit: slotIds.length,
      depth: 0,
      overrideAccess: true,
    });

    updatedCount = verify.docs?.length ?? 0;
  }

  if (updatedCount !== slotIds.length) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "orders.errors.confirm_all_requested_failed",
    });
  }
}

async function rollbackRequestedOrderConfirmation(
  ctx: TRPCContext,
  order: CancelableSlotOrder,
  slotSnapshots: OrderSlotReleaseSnapshot[],
) {
  const currentOrder = (await ctx.db.findByID({
    collection: "orders",
    id: order.id,
    depth: 0,
    overrideAccess: true,
  })) as CancelableSlotOrder | null;

  if (
    !currentOrder ||
    currentOrder.status !== order.status ||
    currentOrder.serviceStatus !== "scheduled"
  ) {
    return;
  }

  const currentBookings = await Promise.all(
    slotSnapshots.map(async (slot) => {
      const current = (await ctx.db.findByID({
        collection: "bookings",
        id: slot.id,
        depth: 0,
        overrideAccess: true,
      })) as OrderSlotReleaseSnapshot | null;

      return { snapshot: slot, current };
    }),
  );

  const toRestore = currentBookings.filter(
    ({ snapshot, current }) =>
      !!current &&
      current.status === "confirmed" &&
      relId(current.customer) === relId(order.user) &&
      current.serviceStatus === "scheduled" &&
      snapshot.serviceStatus === "requested",
  );

  await Promise.all(
    toRestore.map(({ snapshot }) =>
      ctx.db.update({
        collection: "bookings",
        id: snapshot.id,
        data: {
          serviceStatus: snapshot.serviceStatus ?? null,
        },
        overrideAccess: true,
        depth: 0,
      }),
    ),
  );

  await ctx.db.update({
    collection: "orders",
    id: order.id,
    data: {
      serviceStatus: order.serviceStatus,
    },
    overrideAccess: true,
    depth: 0,
  });
}

async function declineRequestedSlotOrder(
  ctx: TRPCContext,
  order: CancelableSlotOrder,
  reason?: string,
) {
  assertRequestedTenantDecisionAllowed(order);

  const slotIds = toOrderSlotIds(order);
  const orderUserId = relId(order.user);
  if (!slotIds.length || !orderUserId) {
    throw new TRPCError({ code: "BAD_REQUEST" });
  }

  const releaseSnapshot = await loadOrderSlotsForRelease(
    ctx,
    slotIds,
    orderUserId,
  );
  assertRequestedDecisionSlots(releaseSnapshot, slotIds.length);

  const canceledAt = new Date().toISOString();
  const cancelReason = reason?.trim() ? reason.trim() : undefined;
  const attempt: CancelAttemptSnapshot = {
    canceledAt,
    canceledByRole: "tenant",
    cancelReason: cancelReason ?? null,
  };

  const claimed = await claimSlotOrderCancellation(
    ctx,
    order,
    canceledAt,
    "tenant",
    cancelReason,
  );

  if (!claimed) {
    const latestOrder = await loadOrderForCancellation(ctx, order.id);
    throw new TRPCError({
      code: "CONFLICT",
      message: requestedTenantDecisionConflictMessage(latestOrder),
    });
  }

  try {
    await releaseOrderSlotsToAvailable(ctx, {
      slotIds,
      orderUserId,
      mode: "clear_request_state",
    });
  } catch (error) {
    try {
      await rollbackCanceledOrderState(
        ctx,
        order,
        releaseSnapshot,
        attempt,
        "clear_request_state",
      );
    } catch (rollbackErr) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "[orders] rollback after requested decline release failed",
          {
            orderId: order.id,
            releaseSnapshotIds: releaseSnapshot.map((booking) => booking.id),
            canceledAt,
          },
          rollbackErr,
        );
      }
    }
    throw error;
  }

  return {
    ok: true,
    orderId: order.id,
    status: "canceled" as const,
    canceledAt,
    slotIds,
  };
}

async function requireSuperAdmin(ctx: TRPCContext): Promise<void> {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

  const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
  const user = await ctx.db.findByID({
    collection: "users",
    id: payloadUserId,
    depth: 0,
    overrideAccess: true,
  });

  if (!user?.roles?.includes("super-admin")) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

async function sendCanceledOrderEmails(params: {
  ctx: TRPCContext;
  orderId: string;
  canceledByRole: "customer" | "tenant";
}) {
  if (process.env.SKIP_ORDER_EMAILS === "1") return;
  const { sendCanceledOrderEmailsBestEffort } = await import(
    "./order-cancellation-emails"
  );
  await sendCanceledOrderEmailsBestEffort(params);
}

export const ordersRouter = createTRPCRouter({
  customerCancelSlotOrder: baseProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        reason: z.string().trim().min(3).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
      const order = await loadOrderForCancellation(ctx, input.orderId);

      const orderUserId = relId(order.user);
      if (!orderUserId || orderUserId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await cancelSlotOrder(
        ctx,
        order,
        "customer",
        input.reason,
        {
          allowRequested: true,
        },
      );
      await sendCanceledOrderEmails({
        ctx,
        orderId: result.orderId,
        canceledByRole: "customer",
      });
      return result;
    }),

  tenantCancelSlotOrder: baseProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        reason: z.string().trim().min(3).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
      const order = await loadOrderForCancellation(ctx, input.orderId);

      await assertTenantOwnsOrder(ctx, payloadUserId, order);

      const result = await cancelSlotOrder(ctx, order, "tenant", input.reason);
      await sendCanceledOrderEmails({
        ctx,
        orderId: result.orderId,
        canceledByRole: "tenant",
      });
      return result;
    }),

  tenantConfirmSlotOrder: baseProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
      const order = await loadOrderForCancellation(ctx, input.orderId);

      await assertTenantOwnsOrder(ctx, payloadUserId, order);
      assertRequestedTenantDecisionAllowed(order);

      const slotIds = toOrderSlotIds(order);
      const orderUserId = relId(order.user);
      if (!slotIds.length || !orderUserId) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const slotSnapshots = await loadOrderSlotsForRelease(
        ctx,
        slotIds,
        orderUserId,
      );
      assertRequestedDecisionSlots(slotSnapshots, slotIds.length);

      const claimed = await claimRequestedOrderServiceStatus(
        ctx,
        order,
        "scheduled",
      );

      if (!claimed) {
        const latestOrder = await loadOrderForCancellation(ctx, order.id);
        throw new TRPCError({
          code: "CONFLICT",
          message: requestedTenantDecisionConflictMessage(latestOrder),
        });
      }

      try {
        await updateRequestedOrderSlotsToScheduled(ctx, slotIds, orderUserId);
      } catch (error) {
        try {
          await rollbackRequestedOrderConfirmation(ctx, order, slotSnapshots);
        } catch (rollbackErr) {
          if (process.env.NODE_ENV !== "production") {
            console.error(
              "[orders] rollback after requested confirmation failed",
              {
                orderId: order.id,
                slotIds,
              },
              rollbackErr,
            );
          }
        }
        throw error;
      }

      return {
        ok: true,
        orderId: order.id,
        serviceStatus: "scheduled" as const,
        slotIds,
      };
    }),

  tenantDeclineSlotOrder: baseProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        reason: z.string().trim().min(3).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
      const order = await loadOrderForCancellation(ctx, input.orderId);

      await assertTenantOwnsOrder(ctx, payloadUserId, order);

      const result = await declineRequestedSlotOrder(ctx, order, input.reason);
      await sendCanceledOrderEmails({
        ctx,
        orderId: result.orderId,
        canceledByRole: "tenant",
      });
      return result;
    }),

  // Optional list for an Orders page
  listMine: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

    if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });

    // Tell TS what comes back from Payload
    const res = (await ctx.db.find({
      collection: "orders",
      where: {
        and: [
          { user: { equals: payloadUserId } },
          { status: { in: ["paid", "refunded"] } },
        ],
      },
      sort: "-createdAt",
      limit: 25,
      depth: 1, // to populate relations like "slots"
      overrideAccess: true,
    })) as { docs: Array<DocWithId<Order>> };

    return res.docs.map((o) => {
      // keep slots typed as (string | Booking)[] when depth:1
      const slots = (o.slots ?? []) as Array<string | DocWithId<Booking>>;
      return {
        id: o.id,
        status: o.status as Order["status"],
        amount: o.amount ?? 0,
        currency: o.currency ?? "eur",
        createdAt: o.createdAt!, // timestamps: true -> always present
        slots,
        receiptUrl: o.receiptUrl ?? null,
      };
    });
  }),

  // Aggregated number of orders per tenant (for TenantCard badges)
  statsForTenants: baseProcedure
    .input(
      z.object({
        tenantIds: z.array(z.string()).min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const res = await db.find({
        collection: "orders",
        where: {
          and: [
            { tenant: { in: input.tenantIds } },
            // Count fulfilled orders – adjust statuses if you want only "paid"
            // { status: { in: ["paid", "refunded"] } },  // show all orders regardless of status
          ],
        },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      });

      const docs = res.docs as OrderWithTenantRef[];

      const map: Record<string, { ordersCount: number }> = {};

      for (const o of docs) {
        const rawTenant = o.tenant;
        let tenantId: string | undefined;

        if (typeof rawTenant === "string") {
          tenantId = rawTenant;
        } else if (rawTenant && typeof rawTenant === "object") {
          tenantId = rawTenant.id as string;
        }

        if (!tenantId) continue;

        map[tenantId] = {
          ordersCount: (map[tenantId]?.ordersCount ?? 0) + 1,
        };
      }

      return map;
    }),

  /**
   * Vendor marks an order as "service completed".
   * - Authorization: only the tenant owner
   * - Mutates: orders.serviceStatus  serviceCompletedAt
   * - Also rolls the per-slot booking.serviceStatus to "completed" (best-effort)
   */
  vendorMarkCompleted: baseProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Clerk -> Payload user id
      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      // Load order (strictly)
      const order = (await ctx.db.findByID({
        collection: "orders",
        id: input.orderId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Order> | null;

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      // NEW: legacy endpoints only for legacy orders
      if (order.lifecycleMode === "slot") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This order uses slot lifecycle. Use booking-level actions.",
        });
      }

      const tenantId =
        typeof order.tenant === "string" ? order.tenant : order.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      // Verify tenant ownership
      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Tenant> | null;

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

      const ownerId =
        typeof tenant.user === "string" ? tenant.user : tenant.user?.id;
      if (!ownerId || ownerId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // State guard
      if (order.serviceStatus !== "scheduled") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Order is not in scheduled state",
        });
      }

      const nowIso = new Date().toISOString();

      // Update order
      await ctx.db.update({
        collection: "orders",
        id: order.id,
        data: {
          serviceStatus: "completed",
          serviceCompletedAt: nowIso,
        },
        overrideAccess: true,
        depth: 0,
      });

      // Best-effort: roll bookings.serviceStatus
      const slotIds = Array.isArray(order.slots)
        ? order.slots.filter((s): s is string => typeof s === "string")
        : [];

      if (slotIds.length > 0) {
        await ctx.db.update({
          collection: "bookings",
          where: {
            and: [
              { id: { in: slotIds } },
              {
                or: [
                  { status: { equals: "booked" } },
                  { status: { equals: "confirmed" } },
                ],
              },
            ],
          },
          data: { serviceStatus: "completed" },
          overrideAccess: true,
        });
      }

      return { ok: true };
    }),

  /**
   * Customer accepts service delivery.
   * - Authorization: only the order.user
   * - Preconditions: order.serviceStatus === "completed"
   * - Mutates: orders.serviceStatus  acceptedAt
   */
  customerAccept: baseProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      const order = (await ctx.db.findByID({
        collection: "orders",
        id: input.orderId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Order> | null;

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      // NEW: legacy endpoints only for legacy orders
      if (order.lifecycleMode === "slot") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This order uses slot lifecycle. Use booking-level actions.",
        });
      }

      const orderUserId =
        typeof order.user === "string" ? order.user : order.user?.id;

      if (!orderUserId || orderUserId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (order.serviceStatus !== "completed") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Order is not completed yet",
        });
      }

      await ctx.db.update({
        collection: "orders",
        id: order.id,
        data: {
          serviceStatus: "accepted",
          acceptedAt: new Date().toISOString(),
        },
        overrideAccess: true,
        depth: 0,
      });

      return { ok: true };
    }),

  /**
   * Customer disputes service delivery.
   * - Authorization: only the order.user
   * - Mutates: orders.serviceStatus  disputedAt
   * - NOTE: until you add a Disputes collection, we accept a reason but don't persist it cleanly.
   *   Your Action Plan expects a Dispute record later. :contentReference[oaicite:2]{index=2}
   */
  customerDispute: baseProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        reason: z.string().min(3).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      const order = (await ctx.db.findByID({
        collection: "orders",
        id: input.orderId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Order> | null;

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      // NEW: legacy endpoints only for legacy orders
      if (order.lifecycleMode === "slot") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This order uses slot lifecycle. Use booking-level actions.",
        });
      }

      //completion guard:
      const orderUserId =
        typeof order.user === "string" ? order.user : order.user?.id;

      if (!orderUserId || orderUserId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (order.serviceStatus !== "completed") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Order is not completed yet",
        });
      }

      await ctx.db.update({
        collection: "orders",
        id: order.id,
        data: {
          serviceStatus: "disputed",
          disputedAt: new Date().toISOString(),
        },
        overrideAccess: true,
        depth: 0,
      });

      return { ok: true };
    }),
  // Stage 1C: Customer slot-lifecycle view
  listMineSlotLifecycle: baseProcedure.query(({ ctx }) =>
    listMineSlotLifecycleImpl(ctx),
  ),

  // Stage 1C: Tenant slot-lifecycle view imported from the order-rollup.Tenant orders lifecycle with pagination.
  listForMyTenantSlotLifecycle: baseProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => listForMyTenantSlotLifecycleImpl(ctx, input)),

  // Admin list for cross-tenant lifecycle overview (read-only UI in Phase 2).
  adminListSlotLifecycle: baseProcedure
    .input(
      z
        .object({
          tenantId: z.string().min(1).optional(),
          customerQuery: z.string().trim().min(1).max(120).optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      return listForAdminSlotLifecycleImpl(ctx, input);
    }),

  adminSlotLifecycleExport: baseProcedure
    .input(
      z
        .object({
          tenantId: z.string().min(1).optional(),
          customerQuery: z.string().trim().min(1).max(120).optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      return {
        rows: await exportAdminSlotLifecycleRowsImpl(ctx, input),
        timezone: "UTC" as const,
      };
    }),

  adminCustomerOptions: baseProcedure
    .input(
      z.object({
        tenantId: z.string().min(1).optional(),
        query: z.string().trim().min(1).max(120),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      return listAdminOrderCustomerOptionsImpl(ctx, input);
    }),

  // check if customer has any orders:
  // NEW: show Orders button for slot-lifecycle orders (any status) - above we have hasAnyPaidMine
  hasAnyMineSlotLifecycle: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return { hasAny: false };

    const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
    if (!payloadUserId) return { hasAny: false };

    const found = await ctx.db.find({
      collection: "orders",
      where: {
        and: [
          { user: { equals: payloadUserId } },
          { lifecycleMode: { equals: "slot" } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    return { hasAny: (found.docs?.length ?? 0) > 0 };
  }),

  // Boolean for paid orders (legacy booking-lifecycle) & will be used for reviews:
  hasAnyPaidMine: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return { hasAny: false };

    const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

    if (!payloadUserId) return { hasAny: false };

    const found = await ctx.db.find({
      collection: "orders",
      where: {
        and: [
          { user: { equals: payloadUserId } },
          { status: { in: ["paid", "refunded"] } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    return { hasAny: (found.docs?.length ?? 0) > 0 };
  }),
});
