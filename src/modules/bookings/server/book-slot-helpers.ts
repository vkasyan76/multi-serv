// src/modules/bookings/server/book-slot-helpers.ts
import type { TRPCContext } from "@/trpc/init";
import type { Booking } from "@/payload-types";

type DocWithId<T> = T & { id: string };

export type CartItem = { bookingId: string; serviceId: string }; // cart item type

// Accept both shapes: { items:[{bookingId, serviceId?}]} | { bookingIds:string[] }

// de-dupe but preserve order
export function uniqueIds(items: Array<{ bookingId: string }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (!seen.has(it.bookingId)) {
      seen.add(it.bookingId);
      out.push(it.bookingId);
    }
  }
  return out;
}

// Fetch only bookable (available & in the future) by IDs
export async function fetchBookable(
  ctx: TRPCContext,
  ids: string[],
  nowIso: string
): Promise<Array<DocWithId<Booking>>> {
  if (ids.length === 0) return [];
  const res = await ctx.db.find({
    collection: "bookings",
    where: {
      and: [
        { id: { in: ids } },
        { status: { equals: "available" } },
        { start: { greater_than: nowIso } },
      ],
    },
    depth: 0,
    limit: ids.length,
  });
  return (res.docs ?? []) as Array<DocWithId<Booking>>;
}

// group bookingIds by serviceId
export function groupByService(items: CartItem[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const { bookingId, serviceId } of items) {
    if (!serviceId) continue; // just in case
    const arr = m.get(serviceId) ?? [];
    arr.push(bookingId);
    m.set(serviceId, arr);
  }
  return m;
}

// run one update per service group, so each doc gets its service
export async function bulkBookGroups(
  ctx: TRPCContext,
  groups: Map<string, string[]>,
  nowIso: string,
  payloadUserId: string
): Promise<string[]> {
  let booked: string[] = [];
  for (const [serviceId, ids] of groups) {
    if (!ids.length) continue;
    const res = await ctx.db.update({
      collection: "bookings",
      where: {
        and: [
          { id: { in: ids } },
          { status: { equals: "available" } },
          { start: { greater_than: nowIso } },
        ],
      },
      data: { status: "booked", customer: payloadUserId, service: serviceId },
      overrideAccess: true,
      depth: 0,
    });
    if (Array.isArray(res?.docs)) {
      booked = booked.concat(
        (res.docs as Array<DocWithId<Booking>>).map((d) => d.id)
      );
    }
  }
  return booked;
}
