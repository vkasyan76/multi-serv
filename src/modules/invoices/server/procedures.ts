import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { resolvePayloadUserId } from "@/modules/orders/server/identity";
import type { Booking, Invoice, Order, Tenant, User } from "@/payload-types";
import type { Where } from "payload";
import type { Stripe } from "stripe";
import { stripe } from "@/lib/stripe";
import { resolveVatRateBps } from "./vat-rates";

type DocWithId<T> = T & { id: string };

type InvoiceDoc = {
  id: string;
  status?: string | null;
  order?: string | { id: string } | null;
  tenant?: string | { id: string } | null;
  customer?: string | { id: string } | null;
  currency?: string | null;
  amountTotalCents?: number | null;
  stripeCheckoutSessionId?: string | null;
};

type LineItem = {
  slotId: string;
  title: string;
  qty: number;
  unitAmountCents: number;
  amountCents: number;
  start: string;
  end?: string;
};

type AddressSnapshot = {
  line1: string;
  city: string;
  postal: string;
  countryISO: string;
};

async function requireSuperAdmin(
  ctx: TRPCContext,
): Promise<{ userId: string }> {
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
  return { userId: payloadUserId };
}

async function recomputeOrderInvoiceCache(ctx: TRPCContext, orderId: string) {
  const order = await ctx.db.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  });
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
  }

  const orderMatchFilters: Where[] = [
    { order: { equals: orderId } },
    { order: { equals: { id: orderId } } } as unknown as Where,
  ];

  const res = await ctx.db.find({
    collection: "invoices",
    where: {
      and: [
        { or: orderMatchFilters },
        { status: { in: ["draft", "issued", "overdue", "paid", "void"] } },
      ],
    },
    limit: 100,
    depth: 0,
    sort: "-createdAt",
    overrideAccess: true,
  });

  const docs = res.docs ?? [];
  const paid = docs.find((d) => d.status === "paid");
  const overdue = docs.find((d) => d.status === "overdue");
  const issued = docs.find((d) => d.status === "issued");

  const nextStatus = paid
    ? "paid"
    : overdue
      ? "overdue"
      : issued
        ? "issued"
        : "none";

  await ctx.db.update({
    collection: "orders",
    id: orderId,
    data: {
      invoiceStatus: nextStatus,
      invoiceIssuedAt:
        paid?.issuedAt ?? overdue?.issuedAt ?? issued?.issuedAt ?? null,
      paidAt: paid?.paidAt ?? null,
    },
    overrideAccess: true,
    depth: 0,
  });
}

function formatAddressLine1(coords?: User["coordinates"] | null): string {
  const street = (coords?.street ?? "").trim();
  const num = (coords?.streetNumber ?? "").trim();
  return [street, num].filter(Boolean).join(" ").trim();
}

function requireAddressSnapshot(
  label: string,
  coords?: User["coordinates"] | null,
): AddressSnapshot {
  const line1 = formatAddressLine1(coords);
  const city = (coords?.city ?? "").trim();
  const postal = (coords?.postalCode ?? "").trim();
  const countryISO = (coords?.countryISO ?? "").trim().toUpperCase();

  if (!line1 || !city || !postal || !countryISO) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label} address is incomplete.`,
    });
  }

  return { line1, city, postal, countryISO };
}

function displayName(user: DocWithId<User>): string {
  const first = (user.firstName ?? "").trim();
  const last = (user.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  return full || (user.username ?? "").trim() || (user.email ?? "").trim();
}

function paymentIntentIdOf(s: Stripe.Checkout.Session): string | null {
  if (typeof s.payment_intent === "string") return s.payment_intent;
  if (s.payment_intent) return (s.payment_intent as Stripe.PaymentIntent).id;
  return null;
}

function relId(input: unknown): string | undefined {
  if (!input) return undefined;
  if (typeof input === "string") return input;
  if (typeof input === "object" && input && "id" in input) {
    const raw = (input as { id?: unknown }).id;
    return typeof raw === "string" ? raw : undefined;
  }
  return undefined;
}

function toAbsolute(urlOrPath: string) {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");
  return /^https?:\/\//i.test(urlOrPath) ? urlOrPath : `${base}${urlOrPath}`;
}

function buildLineItems(params: {
  bookings: Array<DocWithId<Booking>>;
  tenantHourlyRate: number;
  targetTotalCents: number;
}): { items: LineItem[]; subtotalCents: number } {
  const { bookings, tenantHourlyRate, targetTotalCents } = params;

  const rawItems: LineItem[] = bookings.map((b) => {
    const startIso = b.start;
    const endIso = b.end ?? b.start;
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    // Fallback to 1 hour if dates are missing/invalid.
    const hours =
      Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
        ? (endMs - startMs) / (60 * 60 * 1000)
        : 1;

    const rate =
      b.serviceSnapshot?.hourlyRate != null
        ? Number(b.serviceSnapshot.hourlyRate)
        : tenantHourlyRate;

    const unitAmountCents = Number.isFinite(rate)
      ? Math.max(0, Math.round(rate * 100))
      : 0;
    const amountCents = Number.isFinite(rate)
      ? Math.max(0, Math.round(rate * hours * 100))
      : 0;

    return {
      slotId: b.id,
      title: b.serviceSnapshot?.serviceName ?? "Service",
      qty: 1,
      unitAmountCents,
      amountCents,
      start: startIso,
      end: b.end ?? undefined,
    };
  });

  const rawSum = rawItems.reduce((sum, li) => sum + li.amountCents, 0);
  const target =
    Number.isFinite(targetTotalCents) && targetTotalCents > 0
      ? targetTotalCents
      : rawSum;

  if (!rawItems.length) return { items: [], subtotalCents: 0 };

  // If we have a target total, scale or split to match it exactly.
  if (target > 0) {
    if (rawSum > 0 && rawSum !== target) {
      const factor = target / rawSum;
      let running = 0;
      const scaled = rawItems.map((li, idx) => {
        const next =
          idx === rawItems.length - 1
            ? target - running
            : Math.round(li.amountCents * factor);
        running += next;
        return { ...li, amountCents: next };
      });
      return { items: scaled, subtotalCents: target };
    }

    if (rawSum === 0) {
      // Split evenly if we couldn't derive item amounts.
      const per = Math.floor(target / rawItems.length);
      let running = 0;
      const split = rawItems.map((li, idx) => {
        const next = idx === rawItems.length - 1 ? target - running : per;
        running += next;
        return { ...li, amountCents: next, unitAmountCents: next };
      });
      return { items: split, subtotalCents: target };
    }
  }

  return { items: rawItems, subtotalCents: rawSum };
}

export const invoicesRouter = createTRPCRouter({
  /**
   * Customer fetches a payable invoice for an order.
   * Returns null when no issued/overdue invoice exists yet.
   */
  getForOrder: baseProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      const order = (await ctx.db.findByID({
        collection: "orders",
        id: input.orderId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Order> | null;

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.lifecycleMode !== "slot") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Order is not a slot-lifecycle order.",
        });
      }

      const orderUserId = relId(order.user);
      if (!orderUserId || orderUserId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const res = await ctx.db.find({
        collection: "invoices",
        where: {
          and: [
            { order: { equals: order.id } },
            { status: { in: ["issued", "overdue"] } },
          ],
        },
        sort: "-createdAt",
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      const invoice = (res.docs?.[0] as InvoiceDoc | undefined) ?? null;
      if (!invoice) return null;

      return { id: invoice.id, status: invoice.status ?? null };
    }),

  /**
   * View-only lookup: latest invoice for an order (any status).
   * Accessible to the order customer or the tenant owner.
   */
  getLatestForOrderAnyStatus: baseProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      const order = (await ctx.db.findByID({
        collection: "orders",
        id: input.orderId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Order> | null;

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.lifecycleMode !== "slot") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Order is not a slot-lifecycle order.",
        });
      }

      const orderUserId = relId(order.user);
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
      const isCustomer = orderUserId && orderUserId === payloadUserId;
      const isOwner = ownerId && ownerId === payloadUserId;

      if (!isCustomer && !isOwner) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const res = await ctx.db.find({
        collection: "invoices",
        where: {
          and: [
            { order: { equals: order.id } },
            { status: { in: ["draft", "issued", "overdue", "paid", "void"] } },
          ],
        },
        sort: "-createdAt",
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      const invoice = (res.docs?.[0] as InvoiceDoc | undefined) ?? null;
      if (!invoice) return null;

      return { id: invoice.id, status: invoice.status ?? null };
    }),

  /**
   * Full invoice read for the invoice page (any status).
   * Accessible to the order customer or the tenant owner.
   */
  getById: baseProcedure
    .input(z.object({ invoiceId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      const invoice = (await ctx.db.findByID({
        collection: "invoices",
        id: input.invoiceId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Invoice> | null;

      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      const tenantId = relId(invoice.tenant);
      const customerId = relId(invoice.customer);
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Tenant> | null;

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

      const ownerId = relId(tenant.user);
      const isCustomer = customerId && customerId === payloadUserId;
      const isOwner = ownerId && ownerId === payloadUserId;

      if (!isCustomer && !isOwner) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return invoice;
    }),
  /**
   * Dev/admin: recompute order invoice cache (fixes stale invoiceStatus).
   */
  reconcileOrderInvoiceCache: baseProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      await recomputeOrderInvoiceCache(ctx, input.orderId);
      return { ok: true };
    }),
  /**
   * Tenant issues an invoice for a slot-lifecycle order.
   * This is the only place we set orders.invoiceStatus="issued" (cache).
   */
  issueForOrder: baseProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      const order = (await ctx.db.findByID({
        collection: "orders",
        id: input.orderId,
        depth: 1,
        overrideAccess: true,
      })) as DocWithId<Order> | null;

      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.lifecycleMode !== "slot") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Order is not a slot-lifecycle order.",
        });
      }
      if (order.serviceStatus !== "accepted") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Order is not accepted yet.",
        });
      }

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

      const customerId = relId(order.user);
      if (!customerId) throw new TRPCError({ code: "BAD_REQUEST" });

      // Load seller (tenant user) + buyer (customer) for immutable invoice snapshots.
      const [tenantUser, buyerUser] = await Promise.all([
        ctx.db.findByID({
          collection: "users",
          id: ownerId,
          depth: 0,
          overrideAccess: true,
        }) as Promise<DocWithId<User> | null>,
        ctx.db.findByID({
          collection: "users",
          id: customerId,
          depth: 0,
          overrideAccess: true,
        }) as Promise<DocWithId<User> | null>,
      ]);

      if (!tenantUser || !buyerUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing seller or buyer profile.",
        });
      }

      // Idempotency: return existing issued/paid invoice if present.
      const existing = await ctx.db.find({
        collection: "invoices",
        where: {
          and: [
            { order: { equals: order.id } },
            { status: { in: ["draft", "issued", "overdue", "paid"] } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      const existingInvoice =
        (existing.docs?.[0] as InvoiceDoc | undefined) ?? null;
      if (existingInvoice) {
        await recomputeOrderInvoiceCache(ctx, order.id);
        return existingInvoice;
      }

      const slotIds = (order.slots ?? [])
        .map((s) => relId(s))
        .filter(Boolean) as string[];

      if (!slotIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order has no slots.",
        });
      }

      const bookingsRes = await ctx.db.find({
        collection: "bookings",
        where: { id: { in: slotIds } },
        limit: slotIds.length,
        depth: 0,
        overrideAccess: true,
      });

      const bookings = (bookingsRes.docs ?? []) as Array<DocWithId<Booking>>;
      if (!bookings.length) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "No bookings found for this order.",
        });
      }

      const hasDispute = bookings.some(
        (b) => (b.serviceStatus ?? "scheduled") === "disputed",
      );
      if (hasDispute) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cannot invoice disputed slots.",
        });
      }

      const orderAmountCents = Number(order.amount ?? 0);
      const tenantRate = Number(tenant.hourlyRate ?? 0);
      const { items, subtotalCents } = buildLineItems({
        bookings,
        tenantHourlyRate: tenantRate,
        targetTotalCents: orderAmountCents,
      });

      if (!items.length || subtotalCents <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid invoice totals.",
        });
      }

      const currency =
        typeof order.currency === "string" && order.currency
          ? order.currency.toLowerCase()
          : "eur";

      const nowIso = new Date().toISOString();
      const sellerCountryISO = String(tenant.country ?? "").toUpperCase();
      if (!sellerCountryISO) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Seller country is missing.",
        });
      }

      const vatRateBps = resolveVatRateBps({
        sellerCountryISO,
        sellerVatRegistered: !!tenant.vatRegistered,
      });

      // order.amount is treated as gross (VAT included); back out net + VAT.
      const grossTotalCents = orderAmountCents;
      const rate = vatRateBps / 10000;
      const vatAmountCents = Math.round((grossTotalCents * rate) / (1 + rate));
      const netSubtotalCents = grossTotalCents - vatAmountCents;

      const sellerAddress = requireAddressSnapshot(
        "Seller",
        tenantUser.coordinates,
      );
      const buyerAddress = requireAddressSnapshot(
        "Buyer",
        buyerUser.coordinates,
      );

      const buyerName = displayName(buyerUser);
      if (!buyerName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Buyer name is missing.",
        });
      }

      const created = await ctx.db.create({
        collection: "invoices",
        data: {
          order: order.id,
          tenant: tenantId,
          customer: customerId,
          status: "issued",
          currency,
          amountSubtotalCents: netSubtotalCents,
          vatAmountCents,
          amountTotalCents: grossTotalCents,
          sellerCountryISO,
          sellerVatRegistered: !!tenant.vatRegistered,
          sellerVatId: tenant.vatRegistered ? (tenant.vatId ?? null) : null,
          vatRateBps,
          sellerLegalName: tenant.name,
          sellerAddressLine1: sellerAddress.line1,
          sellerCity: sellerAddress.city,
          sellerPostal: sellerAddress.postal,
          sellerEmail: tenantUser.email ?? undefined,
          buyerName,
          buyerAddressLine1: buyerAddress.line1,
          buyerCity: buyerAddress.city,
          buyerPostal: buyerAddress.postal,
          buyerCountryISO: buyerAddress.countryISO,
          buyerEmail: buyerUser.email ?? undefined,
          vatPolicy: "TENANT_HOME_RATE_ASSUMED_HUMAN_SERVICE_MVP",
          lineItems: items,
          issuedAt: nowIso,
        },
        overrideAccess: true,
        depth: 0,
      });

      // Cache on order for list UI (source of truth stays on invoice).
      await ctx.db.update({
        collection: "orders",
        id: order.id,
        data: { invoiceStatus: "issued", invoiceIssuedAt: nowIso },
        overrideAccess: true,
        depth: 0,
      });

      return created;
    }),

  /**
   * Customer creates a Stripe Checkout Session to pay an issued invoice.
   */
  createCheckoutSession: baseProcedure
    .input(z.object({ invoiceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      const invoice = (await ctx.db.findByID({
        collection: "invoices",
        id: input.invoiceId,
        depth: 0,
        overrideAccess: true,
      })) as InvoiceDoc | null;

      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      const customerId = relId(invoice.customer);
      if (!customerId || customerId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (!["issued", "overdue"].includes(String(invoice.status ?? ""))) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Invoice is not payable.",
        });
      }

      if (invoice.stripeCheckoutSessionId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Checkout already created for this invoice.",
        });
      }

      const tenantId = relId(invoice.tenant);
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Tenant> | null;

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });
      if (!tenant.stripeAccountId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant missing Stripe account.",
        });
      }

      const totalCents = Number(invoice.amountTotalCents ?? 0);
      if (!Number.isFinite(totalCents) || totalCents <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid invoice total.",
        });
      }

      const orderId = relId(invoice.order);
      const currency = (invoice.currency ?? "eur").toLowerCase();

      // Best-effort email for Checkout (optional).
      const user = (await ctx.db.findByID({
        collection: "users",
        id: customerId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<User> | null;
      const email = user?.email ?? undefined;

      // Keep the customer on the orders page after checkout.
      const ordersPage = toAbsolute("/orders");
      const successUrl = `${ordersPage}?invoice=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${ordersPage}?invoice=cancel&session_id={CHECKOUT_SESSION_ID}`;

      const metadata = {
        invoiceId: invoice.id,
        orderId: orderId ?? "",
        userId: customerId,
        tenantId: tenantId ?? "",
      };

      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: email,
          success_url: successUrl,
          cancel_url: cancelUrl,
          line_items: [
            {
              quantity: 1,
              price_data: {
                unit_amount: totalCents,
                currency,
                product_data: {
                  name: `${tenant.name ?? "Service"} – Invoice`,
                  description: "Service invoice payment",
                },
              },
            },
          ],
          metadata,
          payment_intent_data: { metadata },
        },
        { stripeAccount: tenant.stripeAccountId as string },
      );

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe session has no url",
        });
      }

      await ctx.db.update({
        collection: "invoices",
        id: invoice.id,
        data: { stripeCheckoutSessionId: session.id },
        overrideAccess: true,
        depth: 0,
      });

      return { url: session.url };
    }),

  /**
   * Fallback finalizer used after redirect if webhook didn't update yet.
   * Verifies payment status and marks invoice/order as paid.
   */
  finalizeFromSession: baseProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      const res = await ctx.db.find({
        collection: "invoices",
        where: { stripeCheckoutSessionId: { equals: input.sessionId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      const invoice = (res.docs?.[0] as InvoiceDoc | undefined) ?? null;
      if (!invoice) {
        // Soft-fail so the UI can clear params without noisy errors.
        return { ok: false };
      }

      const customerId = relId(invoice.customer);
      if (!customerId || customerId !== payloadUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (invoice.status === "paid") return { ok: true };

      const tenantId = relId(invoice.tenant);
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as DocWithId<Tenant> | null;

      if (!tenant?.stripeAccountId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant missing Stripe account.",
        });
      }

      const session = await stripe.checkout.sessions.retrieve(
        input.sessionId,
        { expand: ["payment_intent"] },
        { stripeAccount: tenant.stripeAccountId },
      );

      // Primary success signal: payment_status must be "paid".
      if (session.payment_status !== "paid") return { ok: false };
      // Optional soft check: only enforce if Stripe provides a status.
      if (session.status && session.status !== "complete") return { ok: false };

      // Guard against cross-linked sessions (amount/currency must match).
      const expectedAmount = Number(invoice.amountTotalCents ?? 0);
      const expectedCurrency = String(invoice.currency ?? "eur").toLowerCase();
      const gotAmount = session.amount_total ?? null;
      const gotCurrency = String(session.currency ?? "").toLowerCase();

      if (gotAmount !== expectedAmount || gotCurrency !== expectedCurrency) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Checkout amount/currency mismatch.",
        });
      }

      const piId = paymentIntentIdOf(session as Stripe.Checkout.Session);

      await ctx.db.update({
        collection: "invoices",
        id: invoice.id,
        data: {
          status: "paid",
          stripePaymentIntentId: piId ?? undefined,
          paidAt: new Date().toISOString(),
        },
        overrideAccess: true,
        depth: 0,
      });

      const orderId = relId(invoice.order);
      if (orderId) {
        await ctx.db.update({
          collection: "orders",
          id: orderId,
          data: { invoiceStatus: "paid", paidAt: new Date().toISOString() },
          overrideAccess: true,
          depth: 0,
        });
      }

      return { ok: true };
    }),
});
