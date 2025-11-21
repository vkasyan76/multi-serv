// src/modules/orders/server/procedures.ts
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import type { Order, Booking, Tenant } from "@/payload-types";
import { z } from "zod";

type DocWithId<T> = T & { id: string }; // Payload returns docs with an id

// orders where tenant is either an ID string or a populated Tenant
type OrderWithTenantRef = Order & {
  tenant?: string | Tenant | null;
};

export const ordersRouter = createTRPCRouter({
  // Boolean for the navbar “My Orders”
  hasAnyPaidMine: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return { hasAny: false };

    const me = await ctx.db.find({
      collection: "users",
      where: { clerkUserId: { equals: ctx.userId } },
      limit: 1,
      depth: 0,
    });
    const payloadUserId = (me.docs?.[0] as { id?: string } | undefined)?.id;
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

  // Optional list for an Orders page
  listMine: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const me = await ctx.db.find({
      collection: "users",
      where: { clerkUserId: { equals: ctx.userId } },
      limit: 1,
      depth: 0,
    });
    const payloadUserId = (me.docs?.[0] as { id?: string } | undefined)?.id;
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
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const res = await db.find({
        collection: "orders",
        where: {
          and: [
            { tenant: { in: input.tenantIds } },
            // Count fulfilled orders – adjust statuses if you want only "paid"
            { status: { in: ["paid", "refunded"] } },
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
});
