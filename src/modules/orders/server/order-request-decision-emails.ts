import "server-only";

import type { Payload } from "payload";
import type { Booking, Order, Tenant, User } from "@/payload-types";
import type { TRPCContext } from "@/trpc/init";
import { withLocalePrefix } from "@/i18n/routing";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { sendDomainEmail } from "@/modules/email/events";
import type { EmailDeliverability, EmailEventType } from "@/modules/email/types";
import { resolveOrderServiceLabels } from "./order-service-labels";

type DocWithId<T> = T & { id: string };
type DbOnlyCtx = Pick<TRPCContext, "db">;
type RequestDecisionEventType = Extract<
  EmailEventType,
  "order.confirmed.customer" | "order.declined.customer"
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

function toEmailDeliverability(user: DocWithId<User>): EmailDeliverability {
  return {
    status: user.emailDeliverabilityStatus ?? undefined,
    reason: user.emailDeliverabilityReason ?? undefined,
    retryAfter: user.emailDeliverabilityRetryAfter ?? undefined,
  };
}

function toAbsolute(path: string) {
  const base =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return new URL(path, base).toString();
}

function toLocalizedAbsolute(path: string, locale: string) {
  return toAbsolute(withLocalePrefix(path, normalizeToSupported(locale)));
}

function displayNameFromUser(
  user: User | string | null | undefined,
): string | null {
  if (!user || typeof user === "string") return null;
  const first = (user.firstName ?? "").trim();
  const last = (user.lastName ?? "").trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  return user.username ?? user.email ?? null;
}

function displayNameFromSnapshot(
  snapshot: Order["customerSnapshot"] | undefined,
) {
  if (!snapshot) return "";
  return `${snapshot.firstName ?? ""} ${snapshot.lastName ?? ""}`.trim();
}

async function extractLocalizedServiceNames(params: {
  payload: Payload;
  slots: Array<DocWithId<Booking>>;
  locale?: string | null;
}) {
  const { payload, slots, locale } = params;
  const labelBySlotId = await resolveOrderServiceLabels({
    payload,
    slots: slots.map((slot) => ({
      id: slot.id,
      serviceSnapshot: slot.serviceSnapshot ?? null,
    })),
    appLang: normalizeToSupported(locale ?? undefined),
  });

  const names = slots
    .map(
      (slot) =>
        labelBySlotId.get(slot.id)?.trim() ||
        slot.serviceSnapshot?.serviceName?.trim() ||
        null,
    )
    .filter((name): name is string => !!name);

  return Array.from(new Set(names));
}

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

function getOrderSlotIds(order: DocWithId<Order>) {
  return (order.slots ?? [])
    .map((slot) => relId(slot as string | { id?: string | null } | null))
    .filter((value): value is string => !!value);
}

async function sendOrderRequestDecisionCustomerEmailBestEffort(params: {
  ctx: DbOnlyCtx;
  orderId: string;
  eventType: RequestDecisionEventType;
}) {
  const { ctx, orderId, eventType } = params;

  try {
    const order = (await ctx.db.findByID({
      collection: "orders",
      id: orderId,
      depth: 0,
      overrideAccess: true,
    })) as DocWithId<Order> | null;

    if (!order) return;

    const tenantId = relId(order.tenant);
    const customerId = relId(order.user);
    if (!tenantId || !customerId) return;

    const slotIds = getOrderSlotIds(order);
    const [tenant, customerUser, slotRes] = await Promise.all([
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
      slotIds.length
        ? (ctx.db.find({
            collection: "bookings",
            where: { id: { in: slotIds } },
            limit: slotIds.length,
            depth: 0,
            overrideAccess: true,
          }) as Promise<{ docs: Array<DocWithId<Booking>> }>)
        : Promise.resolve({ docs: [] as Array<DocWithId<Booking>> }),
    ]);

    if (!tenant || !customerUser?.email) return;

    const slots = slotRes.docs ?? [];
    const customerLocale = normalizeToSupported(
      customerUser.language ?? undefined,
    );
    const dateRange = extractDateRange(slots);
    const tenantSlug =
      typeof tenant.slug === "string"
        ? tenant.slug
        : order.vendorSnapshot?.tenantSlug ?? "";
    const tenantNameRaw =
      typeof tenant.name === "string"
        ? tenant.name
        : order.vendorSnapshot?.tenantName ?? "";
    const customerName =
      displayNameFromUser(customerUser) ??
      displayNameFromSnapshot(order.customerSnapshot);
    const ordersUrl = toLocalizedAbsolute("/orders", customerLocale);
    const services = await extractLocalizedServiceNames({
      payload: ctx.db,
      slots,
      locale: customerLocale,
    });

    await sendDomainEmail({
      db: ctx.db,
      eventType,
      entityType: "order",
      entityId: order.id,
      recipientUserId: customerId,
      toEmail: customerUser.email,
      deliverability: toEmailDeliverability(customerUser),
      data: {
        tenantName: tenantNameRaw,
        tenantSlug,
        customerName,
        orderId: order.id,
        ordersUrl,
        services,
        dateRangeStart: dateRange?.start,
        dateRangeEnd: dateRange?.end ?? undefined,
        declineReason: order.cancelReason ?? undefined,
        locale: customerLocale,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[email] ${eventType} dispatch failed`, err);
    }
  }
}

export async function sendOrderRequestConfirmedEmailBestEffort(params: {
  ctx: DbOnlyCtx;
  orderId: string;
}) {
  await sendOrderRequestDecisionCustomerEmailBestEffort({
    ...params,
    eventType: "order.confirmed.customer",
  });
}

export async function sendOrderRequestDeclinedEmailBestEffort(params: {
  ctx: DbOnlyCtx;
  orderId: string;
}) {
  await sendOrderRequestDecisionCustomerEmailBestEffort({
    ...params,
    eventType: "order.declined.customer",
  });
}
