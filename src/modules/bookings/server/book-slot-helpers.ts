// src/modules/bookings/server/book-slot-helpers.ts
import type { TRPCContext } from "@/trpc/init";
import type { Booking, Tenant, Category } from "@/payload-types";

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

// --- snapshots (tiny caches) ---
type ServiceSnap = { name: string | null; slug: string | null };
type TenantSnap = {
  name: string | null;
  slug: string | null;
  hourlyRate: number | null;
};
type SnapCaches = {
  service: Map<string, ServiceSnap>;
  tenant: Map<string, TenantSnap>;
};

function makeSnapCaches(): SnapCaches {
  return { service: new Map(), tenant: new Map() };
}

async function getServiceSnap(
  ctx: TRPCContext,
  serviceId: string,
  caches: SnapCaches
): Promise<ServiceSnap> {
  const hit = caches.service.get(serviceId);
  if (hit) return hit;
  const doc = (await ctx.db.findByID({
    collection: "categories",
    id: serviceId,
    depth: 0,
  })) as Category | null;

  const snap: ServiceSnap = {
    name: doc?.name ?? null,
    slug: doc?.slug ?? null,
  };

  caches.service.set(serviceId, snap);
  return snap;
}

async function getTenantSnap(
  ctx: TRPCContext,
  tenantId: string,
  caches: SnapCaches
): Promise<TenantSnap> {
  const hit = caches.tenant.get(tenantId);
  if (hit) return hit;
  const doc = (await ctx.db.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
  })) as Tenant | null;

  const snap: TenantSnap = {
    name: doc?.name ?? null,
    slug: doc?.slug ?? null,
    hourlyRate: doc?.hourlyRate ?? null, // price lives on tenant
  };

  caches.tenant.set(tenantId, snap);
  return snap;
}

async function buildServiceSnapshot(
  ctx: TRPCContext,
  tenantId: string,
  serviceId: string,
  caches: SnapCaches
) {
  const [ten, svc] = await Promise.all([
    getTenantSnap(ctx, tenantId, caches),
    getServiceSnap(ctx, serviceId, caches),
  ]);
  return {
    serviceName: svc.name,
    serviceSlug: svc.slug,
    tenantName: ten.name,
    tenantSlug: ten.slug,
    hourlyRate: ten.hourlyRate,
  };
}

// --- one-by-one atomic updates, writing the snapshot ---
export async function bulkBookIndividually(opts: {
  ctx: TRPCContext;
  items: CartItem[];
  bookableById: Map<string, DocWithId<Booking>>;
  payloadUserId: string;
  nowIso: string;
}): Promise<string[]> {
  const { ctx, items, bookableById, payloadUserId, nowIso } = opts;
  const caches = makeSnapCaches();
  const booked: string[] = [];

  for (const it of items) {
    const b = bookableById.get(it.bookingId);
    if (!b) continue;

    const tenantId = typeof b.tenant === "string" ? b.tenant : b.tenant?.id;
    if (!tenantId) continue;

    const serviceSnapshot = await buildServiceSnapshot(
      ctx,
      tenantId,
      it.serviceId,
      caches
    );

    const res = await ctx.db.update({
      collection: "bookings",
      where: {
        and: [
          { id: { equals: it.bookingId } },
          { status: { equals: "available" } },
          { start: { greater_than: nowIso } },
        ],
      },
      data: {
        status: "booked",
        customer: payloadUserId,
        service: it.serviceId,
        serviceSnapshot,
      },
      overrideAccess: true,
      depth: 0,
    });

    const updatedId = Array.isArray(res?.docs)
      ? (res.docs[0] as { id?: string })?.id
      : undefined;
    if (updatedId) booked.push(updatedId);
  }

  return booked;
}
