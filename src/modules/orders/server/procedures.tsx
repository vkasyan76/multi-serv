// src/modules/orders/server/procedures.ts
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import type { Order, Booking } from "@/payload-types";

type DocWithId<T> = T & { id: string }; // Payload returns docs with an id

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
});
