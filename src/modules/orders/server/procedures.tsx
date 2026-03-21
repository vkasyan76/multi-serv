import "server-only";
// src/modules/orders/server/procedures.ts
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import type { Order, Booking, Tenant } from "@/payload-types";
import type { Where } from "payload";
import { z } from "zod";
import { resolvePayloadUserId } from "./identity";
import {
  getSlotOrderCancelability,
  type SlotOrderCancellationBlockReason,
} from "./order-cancelability";
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

function relId(
  value: string | { id?: string | null } | null | undefined,
): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

function buildCancelableSlotReleaseWhere(
  slotIds: string[],
  orderUserId: string,
): Where {
  return {
    and: [
      { id: { in: slotIds } },
      { customer: { equals: orderUserId } },
      {
        or: [
          { status: { equals: "booked" } },
          { status: { equals: "confirmed" } },
        ],
      },
    ],
  };
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

async function loadReleasableOrderSlots(
  ctx: TRPCContext,
  slotIds: string[],
  orderUserId: string,
) {
  if (!slotIds.length) return [];

  const res = await ctx.db.find({
    collection: "bookings",
    where: buildCancelableSlotReleaseWhere(slotIds, orderUserId),
    limit: slotIds.length,
    depth: 0,
    overrideAccess: true,
  });

  return (res.docs ?? []) as Array<
    DocWithId<Pick<Booking, "id" | "status" | "customer">>
  >;
}

async function releaseCanceledOrderSlots(
  ctx: TRPCContext,
  slotIds: string[],
  orderUserId: string,
): Promise<void> {
  if (!slotIds.length) return;

  // Mirrors existing release paths:
  // - legacy checkout rollback releases "booked" slots
  // - slot checkout promotes slots to "confirmed"
  const updateRes = await ctx.db.update({
    collection: "bookings",
    where: buildCancelableSlotReleaseWhere(slotIds, orderUserId),
    data: {
      status: "available",
      customer: null,
    },
    overrideAccess: true,
  });

  let releasedCount = Array.isArray(updateRes?.docs)
    ? updateRes.docs.length
    : null;

  if (releasedCount === null) {
    const verify = await ctx.db.find({
      collection: "bookings",
      where: {
        and: [
          { id: { in: slotIds } },
          { status: { equals: "available" } },
        ],
      },
      limit: slotIds.length,
      depth: 0,
      overrideAccess: true,
    });

    releasedCount = (verify.docs ?? []).filter(
      // Cleared booking ownership is stored as null in the existing release paths.
      (booking) => relId((booking as Pick<Booking, "customer">).customer) == null,
    ).length;
  }

  if (releasedCount !== slotIds.length) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "orders.errors.cancel_release_failed",
    });
  }
}

async function rollbackCanceledOrderState(
  ctx: TRPCContext,
  order: CancelableSlotOrder,
  releaseSnapshot: Array<DocWithId<Pick<Booking, "id" | "status" | "customer">>>,
) {
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

  await Promise.all(
    releaseSnapshot.map((booking) =>
      ctx.db.update({
        collection: "bookings",
        id: booking.id,
        data: {
          status: booking.status,
          customer: relId(booking.customer),
        },
        overrideAccess: true,
        depth: 0,
      }),
    ),
  );
}

async function cancelSlotOrder(
  ctx: TRPCContext,
  order: CancelableSlotOrder,
  canceledByRole: "customer" | "tenant",
  reason?: string,
) {
  const cancelability = await getSlotOrderCancelability(ctx.db, order);
  if (!cancelability.cancelable) {
    throw new TRPCError({
      code: "CONFLICT",
      message: cancelConflictMessage(cancelability.reason),
    });
  }

  const orderUserId = relId(order.user);
  if (!orderUserId) throw new TRPCError({ code: "BAD_REQUEST" });

  const releaseSnapshot = await loadReleasableOrderSlots(
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

  await ctx.db.update({
    collection: "orders",
    id: order.id,
    data: {
      status: "canceled",
      canceledAt,
      canceledByRole,
      cancelReason,
    },
    overrideAccess: true,
    depth: 0,
  });

  try {
    await releaseCanceledOrderSlots(ctx, cancelability.slotIds, orderUserId);
  } catch (error) {
    // Best-effort compensation keeps retries possible when slot release fails.
    try {
      await rollbackCanceledOrderState(ctx, order, releaseSnapshot);
    } catch {}
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

      return cancelSlotOrder(ctx, order, "customer", input.reason);
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

      return cancelSlotOrder(ctx, order, "tenant", input.reason);
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
