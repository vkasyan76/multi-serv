// src/modules/orders/server/order-rollup.ts
import { TRPCError } from "@trpc/server";
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

type SlotLifecycleSlot = Pick<Booking, "id" | "start" | "end"> & {
  serviceStatus: ServiceStatus;
  disputeReason: string | null;
  serviceSnapshot: NonNullable<Booking["serviceSnapshot"]> | null;
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

  const items = (res.docs ?? []).map((o) => {
    const slots = mapSlotsFromOrder(o);

    const userId = typeof o.user === "string" ? o.user : o.user.id;

    return {
      id: o.id,
      createdAt: o.createdAt!,
      serviceStatus: o.serviceStatus as Order["serviceStatus"],
      invoiceStatus: o.invoiceStatus as Order["invoiceStatus"],
      lifecycleMode: o.lifecycleMode as Order["lifecycleMode"],

      // simplest + already available in Order type
      userId,
      customerSnapshot: o.customerSnapshot,

      slots,
    };
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

    if (!tenant || !customerUser || !customerUser.email) continue;

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
    const dashboardUrl = toAbsolute("/dashboard");
    const disputeReason = extractDisputeReason(slots);

    if (next === "completed") {
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
