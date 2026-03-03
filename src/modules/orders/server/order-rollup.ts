// src/modules/orders/server/order-rollup.ts
import { TRPCError } from "@trpc/server";
import type { Where } from "payload";
import { resolvePayloadUserId } from "./identity";
import type { Booking, Order, Tenant, User } from "@/payload-types";
import type { TRPCContext } from "@/trpc/init";
import { DEFAULT_LIMIT } from "@/constants";
import { sendDomainEmail } from "@/modules/email/events";
import type { EmailDeliverability } from "@/modules/email/types";

type DocWithId<T> = T & { id: string };
type CtxLike = Pick<TRPCContext, "db" | "userId">; // for Stage 1C queries we also need ctx.userId
type DbOnlyCtx = Pick<TRPCContext, "db">;
type ServiceStatus = Order["serviceStatus"];
const ADMIN_ORDERS_EXPORT_PAGE_SIZE = 200;
const MAX_ADMIN_ORDERS_EXPORT_SLOT_ROWS = 50_000;

type SlotLifecycleSlot = Pick<Booking, "id" | "start" | "end"> & {
  serviceStatus: ServiceStatus;
  disputeReason: string | null;
  serviceSnapshot: NonNullable<Booking["serviceSnapshot"]> | null;
};

type TenantLifecycleListItem = {
  id: string;
  createdAt: string;
  serviceStatus: Order["serviceStatus"];
  invoiceStatus: Order["invoiceStatus"];
  lifecycleMode: Order["lifecycleMode"];
  userId: string;
  customerSnapshot: Order["customerSnapshot"];
  slots: SlotLifecycleSlot[];
};

type AdminTenantMeta = {
  tenantId?: string;
  tenantName: string;
  tenantSlug?: string;
};

export type AdminOrdersSlotExportRow = {
  orderId: string;
  orderCreatedAt: string;
  lifecycleMode: string;
  orderServiceStatus: string;
  invoiceStatus: string | null;
  tenantId?: string;
  tenantName?: string | null;
  tenantSlug?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  userId?: string | null;
  slotId: string;
  slotIndex: number;
  slotCount: number;
  slotStart: string;
  slotEnd?: string | null;
  slotStatus: string;
  serviceName?: string | null;
  disputeReason?: string | null;
};

export type AdminOrderCustomerOption = {
  key: string;
  label: string;
  email?: string | null;
  queryValue: string;
};

function normalizeServiceStatus(ss: unknown): ServiceStatus {
  if (ss === "completed" || ss === "accepted" || ss === "disputed") return ss;
  return "scheduled";
}

// Normalize user deliverability fields for email sending.
function toEmailDeliverability(user: DocWithId<User>): EmailDeliverability {
  return {
    status: user.emailDeliverabilityStatus ?? undefined,
    reason: user.emailDeliverabilityReason ?? undefined,
    retryAfter: user.emailDeliverabilityRetryAfter ?? undefined,
  };
}

// Absolute URL helper (prefers server APP_URL when available).
function toAbsolute(path: string) {
  const base =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return new URL(path, base).toString();
}

// User display name used in email copy (best-effort).
function displayNameFromUser(
  u: User | string | null | undefined,
): string | null {
  if (!u || typeof u === "string") return null;
  const first = (u.firstName ?? "").trim();
  const last = (u.lastName ?? "").trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  return u.username ?? u.email ?? null;
}

// Customer snapshot fallback when user doc isn't available.
function displayNameFromSnapshot(
  snapshot: Order["customerSnapshot"] | undefined,
) {
  if (!snapshot) return "";
  return `${snapshot.firstName ?? ""} ${snapshot.lastName ?? ""}`.trim();
}

// Deduped service list for email bullet points.
function extractServiceNames(slots: Array<DocWithId<Booking>>): string[] {
  const names = slots
    .map((slot) => slot.serviceSnapshot?.serviceName ?? null)
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.trim())
    .filter(Boolean);
  return Array.from(new Set(names));
}

// Collapses slot starts/ends into a single date range (UTC).
function extractDateRange(slots: Array<DocWithId<Booking>>) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let minStart: string | undefined;
  let maxEnd: string | undefined;

  for (const slot of slots) {
    const startMs = Date.parse(slot.start ?? "");
    const endMsRaw = Date.parse(slot.end ?? slot.start ?? "");
    if (!Number.isFinite(startMs)) continue;

    if (startMs < min) {
      min = startMs;
      minStart = slot.start;
    }

    const endMs = Number.isFinite(endMsRaw) ? endMsRaw : startMs;
    if (endMs > max) {
      max = endMs;
      maxEnd = slot.end ?? slot.start;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { start: minStart, end: maxEnd ?? minStart };
}

// First non-empty dispute reason across slots (if any).
function extractDisputeReason(slots: Array<DocWithId<Booking>>) {
  const reason = slots
    .map((slot) => slot.disputeReason ?? null)
    .find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof reason === "string" ? reason.trim() : undefined;
}

/**
 * NEW: tenant resolution for "my tenant" (same strategy as tenants.getMine)
 * Payload user id -> tenant where tenant.user == payloadUserId.
 */
async function resolveMyTenantId(
  ctx: Pick<TRPCContext, "db">,
  clerkUserId: string,
): Promise<string> {
  const payloadUserId = await resolvePayloadUserId(ctx, clerkUserId);

  const t = await ctx.db.find({
    collection: "tenants",
    where: { user: { equals: payloadUserId } },
    sort: "-createdAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const tenantId = (t.docs?.[0] as { id?: string } | undefined)?.id;
  if (!tenantId) throw new TRPCError({ code: "FORBIDDEN" });
  return tenantId;
}

/**
 * NEW: Shape trimmed to what Stage 1C UI needs (customer).
 * Note: slots are mapped down to minimum fields to keep payload size small.
 */
// typed slot-mapper helper:
function mapSlotsFromOrder(o: DocWithId<Order>): SlotLifecycleSlot[] {
  const slotsRaw = (o.slots ?? []) as Array<string | DocWithId<Booking>>;

  return (
    slotsRaw
      // key fix: type guard => no "b possibly null"
      .filter((s): s is DocWithId<Booking> => typeof s !== "string")
      .map((b) => ({
        id: b.id,
        start: b.start,
        end: b.end,
        serviceStatus: normalizeServiceStatus(b.serviceStatus),
        disputeReason: b.disputeReason ?? null,
        serviceSnapshot: b.serviceSnapshot ?? null,
      }))
  );
}

function mapTenantLifecycleItem(o: DocWithId<Order>): TenantLifecycleListItem {
  const slots = mapSlotsFromOrder(o);
  // Defensive fallback for rare orphaned relation records in cross-tenant admin reads.
  const userId = typeof o.user === "string" ? o.user : (o.user?.id ?? "");

  return {
    id: o.id,
    createdAt: o.createdAt!,
    serviceStatus: o.serviceStatus as Order["serviceStatus"],
    invoiceStatus: o.invoiceStatus as Order["invoiceStatus"],
    lifecycleMode: o.lifecycleMode as Order["lifecycleMode"],
    userId,
    customerSnapshot: o.customerSnapshot,
    slots,
  };
}

function tenantMetaFromOrder(
  o: DocWithId<Order>,
  slots: SlotLifecycleSlot[],
): AdminTenantMeta {
  const tenantId = typeof o.tenant === "string" ? o.tenant : o.tenant?.id;

  const slotSnapshot = slots.find(
    (s) => s.serviceSnapshot?.tenantName || s.serviceSnapshot?.tenantSlug,
  )?.serviceSnapshot;

  const tenantName =
    (o.vendorSnapshot?.tenantName ?? "").trim() ||
    (slotSnapshot?.tenantName ?? "").trim() ||
    "Unknown tenant";

  const tenantSlugRaw =
    (o.vendorSnapshot?.tenantSlug ?? "").trim() ||
    (slotSnapshot?.tenantSlug ?? "").trim();

  return {
    tenantId: tenantId ?? undefined,
    tenantName,
    tenantSlug: tenantSlugRaw || undefined,
  };
}

function buildAdminSlotLifecycleWhere(input?: {
  tenantId?: string;
  customerQuery?: string;
}) {
  const whereAnd: Where[] = [{ lifecycleMode: { equals: "slot" } }];

  if (input?.tenantId) {
    // Canonical tenant scope key for orders is the relation field `tenant`.
    whereAnd.push({ tenant: { equals: input.tenantId } });
  }

  const q = input?.customerQuery?.trim();
  if (q) {
    // Keep `like` to match existing repo text-search semantics.
    whereAnd.push({
      or: [
        { "customerSnapshot.firstName": { like: q } },
        { "customerSnapshot.lastName": { like: q } },
        { "customerSnapshot.email": { like: q } },
      ],
    });
  }

  return { and: whereAnd } as Where;
}

async function findAdminSlotLifecycleOrders(
  ctx: CtxLike,
  input: {
    tenantId?: string;
    customerQuery?: string;
    page: number;
    limit: number;
  },
) {
  return (await ctx.db.find({
    collection: "orders",
    where: buildAdminSlotLifecycleWhere(input),
    sort: "-createdAt",
    page: input.page,
    limit: input.limit,
    depth: 1, // Keep the same relation shape as tenant lifecycle query.
    overrideAccess: true,
  })) as {
    docs?: Array<DocWithId<Order>>;
    page?: number;
    totalPages?: number;
    totalDocs?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
}

function toCustomerExportMeta(
  snapshot: Order["customerSnapshot"],
  userId: string,
) {
  const customerName =
    `${snapshot.firstName ?? ""} ${snapshot.lastName ?? ""}`.trim() || null;
  const customerEmail = (snapshot.email ?? "").trim() || null;

  return {
    customerName,
    customerEmail,
    userId: userId.trim() || null,
  };
}

export async function listMineSlotLifecycle(ctx: CtxLike) {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

  const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

  const res = (await ctx.db.find({
    collection: "orders",
    where: {
      and: [
        { user: { equals: payloadUserId } },
        { lifecycleMode: { equals: "slot" } },
      ],
    },
    sort: "-createdAt",
    limit: 25,
    depth: 1, // populate slots (bookings)
    overrideAccess: true,
  })) as { docs?: Array<DocWithId<Order>> };

  return (res.docs ?? []).map((o) => {
    const slots = mapSlotsFromOrder(o);
    return {
      id: o.id,
      createdAt: o.createdAt!,
      serviceStatus: o.serviceStatus as Order["serviceStatus"],
      invoiceStatus: o.invoiceStatus as Order["invoiceStatus"],
      lifecycleMode: o.lifecycleMode as Order["lifecycleMode"],
      slots,
    };
  });
}

/**
 * NEW: Tenant list query for Stage 1C.
 * Returns paginated order.user summary so tenant can see who the customer is.
 * Pagination is done at the DB level (Payload find supports page/limit + metadata).
 * We sort by -createdAt for stable paging; UI can re-sort within the page if needed.
 */
export async function listForMyTenantSlotLifecycle(
  ctx: CtxLike,
  input?: { page?: number; limit?: number },
) {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

  const tenantId = await resolveMyTenantId(ctx, ctx.userId);

  const page = Math.max(input?.page ?? 1, 1);
  const limit = Math.min(Math.max(input?.limit ?? DEFAULT_LIMIT, 1), 100);

  const res = (await ctx.db.find({
    collection: "orders",
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { lifecycleMode: { equals: "slot" } },
      ],
    },
    sort: "-createdAt",
    page,
    limit,
    depth: 1, // populate slots + user (best-effort)
    overrideAccess: true,
  })) as {
    docs?: Array<DocWithId<Order>>;
    page?: number;
    totalPages?: number;
    totalDocs?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };

  const items = (res.docs ?? []).map((o) => mapTenantLifecycleItem(o));

  return {
    items,
    page: res.page ?? page,
    totalPages: res.totalPages ?? 1,
    totalDocs: res.totalDocs ?? items.length,
    hasNextPage: res.hasNextPage ?? false,
    hasPrevPage: res.hasPrevPage ?? false,
  };
}

export async function listForAdminSlotLifecycle(
  ctx: CtxLike,
  input?: {
    tenantId?: string;
    customerQuery?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = Math.max(input?.page ?? 1, 1);
  const limit = Math.min(Math.max(input?.limit ?? DEFAULT_LIMIT, 1), 100);
  const res = await findAdminSlotLifecycleOrders(ctx, {
    tenantId: input?.tenantId,
    customerQuery: input?.customerQuery,
    page,
    limit,
  });

  const items = (res.docs ?? []).map((o) => {
    const base = mapTenantLifecycleItem(o);
    const tenantMeta = tenantMetaFromOrder(o, base.slots);
    return { ...base, ...tenantMeta };
  });

  return {
    items,
    page: res.page ?? page,
    totalPages: res.totalPages ?? 1,
    totalDocs: res.totalDocs ?? items.length,
    hasNextPage: res.hasNextPage ?? false,
    hasPrevPage: res.hasPrevPage ?? false,
  };
}

export async function exportAdminSlotLifecycleRows(
  ctx: CtxLike,
  input?: {
    tenantId?: string;
    customerQuery?: string;
  },
) {
  const rows: AdminOrdersSlotExportRow[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await findAdminSlotLifecycleOrders(ctx, {
      tenantId: input?.tenantId,
      customerQuery: input?.customerQuery,
      page,
      limit: ADMIN_ORDERS_EXPORT_PAGE_SIZE,
    });

    for (const order of res.docs ?? []) {
      const base = mapTenantLifecycleItem(order);
      const tenantMeta = tenantMetaFromOrder(order, base.slots);
      const customerMeta = toCustomerExportMeta(
        base.customerSnapshot,
        base.userId,
      );
      const orderedSlots = [...base.slots].sort((a, b) => {
        const aStart = Date.parse(a.start ?? "");
        const bStart = Date.parse(b.start ?? "");

        if (Number.isFinite(aStart) && Number.isFinite(bStart) && aStart !== bStart) {
          return aStart - bStart;
        }

        if (Number.isFinite(aStart) !== Number.isFinite(bStart)) {
          return Number.isFinite(aStart) ? -1 : 1;
        }

        return a.id.localeCompare(b.id);
      });

      if (rows.length + orderedSlots.length > MAX_ADMIN_ORDERS_EXPORT_SLOT_ROWS) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Too many rows. Narrow filters.",
        });
      }

      const slotCount = orderedSlots.length;

      orderedSlots.forEach((slot, index) => {
        rows.push({
          orderId: base.id,
          orderCreatedAt: base.createdAt,
          lifecycleMode: base.lifecycleMode ?? "",
          orderServiceStatus: base.serviceStatus ?? "",
          invoiceStatus: base.invoiceStatus ?? null,
          tenantId: tenantMeta.tenantId ?? undefined,
          tenantName: tenantMeta.tenantName ?? null,
          tenantSlug: tenantMeta.tenantSlug ?? null,
          customerName: customerMeta.customerName,
          customerEmail: customerMeta.customerEmail,
          userId: customerMeta.userId,
          slotId: slot.id,
          slotIndex: index + 1,
          slotCount,
          slotStart: slot.start,
          slotEnd: slot.end ?? null,
          slotStatus: slot.serviceStatus ?? "",
          serviceName: (slot.serviceSnapshot?.serviceName ?? "").trim() || null,
          disputeReason: (slot.disputeReason ?? "").trim() || null,
        });
      });
    }

    totalPages = res.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return rows;
}

export async function listAdminOrderCustomerOptions(
  ctx: CtxLike,
  input: {
    tenantId?: string;
    query: string;
  },
) {
  const q = input.query.trim();
  if (!q) return [];

  const res = await findAdminSlotLifecycleOrders(ctx, {
    tenantId: input.tenantId,
    customerQuery: q,
    page: 1,
    limit: 50,
  });

  const options: AdminOrderCustomerOption[] = [];
  const seen = new Set<string>();

  for (const order of res.docs ?? []) {
    const snapshot = order.customerSnapshot;
    if (!snapshot) continue;

    const name = `${snapshot.firstName ?? ""} ${snapshot.lastName ?? ""}`.trim();
    const email = (snapshot.email ?? "").trim() || null;
    const userId =
      typeof order.user === "string" ? order.user.trim() : (order.user?.id ?? "").trim();
    const queryValue = email || name;

    if (!queryValue) continue;

    const label = name || email || userId || "Unknown customer";
    const key = email || name || userId;
    if (!key || seen.has(key)) continue;
    seen.add(key);

    options.push({
      key,
      label,
      email,
      queryValue,
    });

    if (options.length >= 15) break;
  }

  return options;
}

/**
 * EXISTING: roll-up stays unchanged.
 */

export async function recomputeOrdersForBookingId(
  ctx: DbOnlyCtx,
  bookingId: string,
) {
  const found = await ctx.db.find({
    collection: "orders",
    where: {
      and: [
        { slots: { contains: bookingId } },
        { lifecycleMode: { equals: "slot" } }, // NEW: only recompute new-mode orders
      ],
    },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  });

  const orders = (found.docs ?? []) as Array<DocWithId<Order>>;
  if (!orders.length) return;

  for (const o of orders) {
    // Resolve slot ids for this order.
    const slotIds = (o.slots ?? [])
      .map((s) => (typeof s === "string" ? s : s?.id))
      .filter(Boolean) as string[];

    if (!slotIds.length) continue;

    // Fetch slot docs to compute order-level service status.
    const slotsRes = await ctx.db.find({
      collection: "bookings",
      where: { id: { in: slotIds } },
      limit: slotIds.length,
      depth: 0,
      overrideAccess: true,
    });

    const slots = (slotsRes.docs ?? []) as Array<DocWithId<Booking>>;
    if (!slots.length) continue;

    // Compute next order status from slot statuses.
    const prev = o.serviceStatus;
    const statuses = slots.map((b) => normalizeServiceStatus(b.serviceStatus));

    const anyDisputed = statuses.includes("disputed");
    const allAccepted = statuses.every((s) => s === "accepted");
    const allCompleted = statuses.every(
      (s) => s === "completed" || s === "accepted",
    );

    const next = anyDisputed
      ? "disputed"
      : allAccepted
        ? "accepted"
        : allCompleted
          ? "completed"
          : "scheduled";

    const nowIso = new Date().toISOString();

    // Patch only when status/timestamps actually change.
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

    // Persist order rollup state.
    await ctx.db.update({
      collection: "orders",
      id: o.id,
      data: patch,
      overrideAccess: true,
      depth: 0,
    });

    // Only notify on real transitions.
    if (prev === next) continue;

    // Load required docs for notification payloads.
    const tenantId = typeof o.tenant === "string" ? o.tenant : o.tenant?.id;
    const customerId = typeof o.user === "string" ? o.user : o.user?.id;
    if (!tenantId || !customerId) continue;

    const [tenant, customerUser] = await Promise.all([
      ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      }) as Promise<Tenant | null>,
      ctx.db.findByID({
        collection: "users",
        id: customerId,
        depth: 0,
        overrideAccess: true,
      }) as Promise<DocWithId<User> | null>,
    ]);

    if (!tenant) continue;

    // Shared email payload pieces.
    const tenantSlug =
      typeof tenant.slug === "string"
        ? tenant.slug
        : o.vendorSnapshot?.tenantSlug ?? "";
    const tenantNameRaw =
      typeof tenant.name === "string"
        ? tenant.name
        : o.vendorSnapshot?.tenantName ?? "";
    const customerName =
      displayNameFromUser(customerUser) ??
      displayNameFromSnapshot(o.customerSnapshot);
    const services = extractServiceNames(slots);
    const dateRange = extractDateRange(slots);
    const ordersUrl = toAbsolute("/orders");
    // Include tenant context so email CTAs don't land in the wrong dashboard.
    const dashboardUrl = toAbsolute(
      tenantSlug
        ? `/dashboard?tenant=${encodeURIComponent(tenantSlug)}`
        : "/dashboard",
    );
    const disputeReason = extractDisputeReason(slots);

    if (next === "completed") {
      if (!customerUser?.email) continue;
      // Customer notification: service completed (confirm/dispute).
      try {
        await sendDomainEmail({
          db: ctx.db,
          eventType: "order.completed.customer",
          entityType: "order",
          entityId: o.id,
          recipientUserId: customerId,
          toEmail: customerUser.email,
          deliverability: toEmailDeliverability(customerUser),
          data: {
            tenantName: tenantNameRaw,
            tenantSlug,
            customerName,
            orderId: o.id,
            ordersUrl,
            services,
            dateRangeStart: dateRange?.start,
            dateRangeEnd: dateRange?.end ?? undefined,
            locale: customerUser.language ?? "en",
          },
        });
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[email] order.completed.customer failed", err);
        }
      }
    } else if (next === "accepted") {
      // Tenant notification: customer accepted completion.
      const ownerId =
        typeof tenant.user === "string" ? tenant.user : tenant.user?.id;
      if (!ownerId) continue;

      const tenantUser = (await ctx.db.findByID({
        collection: "users",
        id: ownerId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<User> | null;

      if (!tenantUser || !tenantUser.email) continue;

      const tenantName = displayNameFromUser(tenantUser) ?? tenantNameRaw;

      try {
        await sendDomainEmail({
          db: ctx.db,
          eventType: "order.accepted.tenant",
          entityType: "order",
          entityId: o.id,
          recipientUserId: ownerId,
          toEmail: tenantUser.email,
          deliverability: toEmailDeliverability(tenantUser),
          data: {
            tenantName,
            customerName,
            orderId: o.id,
            dashboardUrl,
            services,
            dateRangeStart: dateRange?.start,
            dateRangeEnd: dateRange?.end ?? undefined,
            locale: tenantUser.language ?? "en",
          },
        });
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[email] order.accepted.tenant failed", err);
        }
      }
    } else if (next === "disputed") {
      // Tenant notification: customer disputed completion.
      const ownerId =
        typeof tenant.user === "string" ? tenant.user : tenant.user?.id;
      if (!ownerId) continue;

      const tenantUser = (await ctx.db.findByID({
        collection: "users",
        id: ownerId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<User> | null;

      if (!tenantUser || !tenantUser.email) continue;

      const tenantName = displayNameFromUser(tenantUser) ?? tenantNameRaw;

      try {
        await sendDomainEmail({
          db: ctx.db,
          eventType: "order.disputed.tenant",
          entityType: "order",
          entityId: o.id,
          recipientUserId: ownerId,
          toEmail: tenantUser.email,
          deliverability: toEmailDeliverability(tenantUser),
          data: {
            tenantName,
            customerName,
            orderId: o.id,
            dashboardUrl,
            services,
            dateRangeStart: dateRange?.start,
            dateRangeEnd: dateRange?.end ?? undefined,
            disputeReason,
            locale: tenantUser.language ?? "en",
          },
        });
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[email] order.disputed.tenant failed", err);
        }
      }
    }
  }
}
