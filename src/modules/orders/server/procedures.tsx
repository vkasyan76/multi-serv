import "server-only";
// src/modules/orders/server/procedures.ts
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import type { Order, Booking, Tenant } from "@/payload-types";
import { z } from "zod";
import { resolvePayloadUserId } from "./identity";
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
