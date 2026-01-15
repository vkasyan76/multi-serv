// src/modules/orders/server/order-rollup.ts
import type { Booking, Order } from "@/payload-types";
import type { TRPCContext } from "@/trpc/init";

type DocWithId<T> = T & { id: string };
type CtxLike = Pick<TRPCContext, "db">;

function normalizeServiceStatus(
  ss: unknown
): "scheduled" | "completed" | "accepted" | "disputed" {
  if (ss === "completed" || ss === "accepted" || ss === "disputed") return ss;
  return "scheduled";
}

export async function recomputeOrdersForBookingId(
  ctx: CtxLike,
  bookingId: string
) {
  const found = await ctx.db.find({
    collection: "orders",
    where: { slots: { equals: bookingId } },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  });

  const orders = (found.docs ?? []) as Array<DocWithId<Order>>;
  if (!orders.length) return;

  for (const o of orders) {
    const slotIds = (o.slots ?? [])
      .map((s) => (typeof s === "string" ? s : s?.id))
      .filter(Boolean) as string[];

    if (!slotIds.length) continue;

    const slotsRes = await ctx.db.find({
      collection: "bookings",
      where: { id: { in: slotIds } },
      limit: slotIds.length,
      depth: 0,
      overrideAccess: true,
    });

    const slots = (slotsRes.docs ?? []) as Array<DocWithId<Booking>>;
    if (!slots.length) continue;

    const statuses = slots.map((b) => normalizeServiceStatus(b.serviceStatus));

    const anyDisputed = statuses.includes("disputed");
    const allAccepted = statuses.every((s) => s === "accepted");
    const allCompleted = statuses.every(
      (s) => s === "completed" || s === "accepted"
    );

    const next = anyDisputed
      ? "disputed"
      : allAccepted
        ? "accepted"
        : allCompleted
          ? "completed"
          : "scheduled";

    const nowIso = new Date().toISOString();

    const patch: Partial<
      Pick<
        Order,
        "serviceStatus" | "disputedAt" | "acceptedAt" | "serviceCompletedAt"
      >
    > = {};

    if (o.serviceStatus !== next) patch.serviceStatus = next;

    if (next === "disputed" && !o.disputedAt) patch.disputedAt = nowIso;
    if (next === "accepted" && !o.acceptedAt) patch.acceptedAt = nowIso;
    if (next === "completed" && !o.serviceCompletedAt)
      patch.serviceCompletedAt = nowIso;

    if (Object.keys(patch).length === 0) continue;

    await ctx.db.update({
      collection: "orders",
      id: o.id,
      data: patch,
      overrideAccess: true,
      depth: 0,
    });
  }
}
