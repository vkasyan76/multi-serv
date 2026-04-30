import test from "node:test";
import assert from "node:assert/strict";

import type { Booking, Invoice, Order, Tenant } from "@/payload-types";
import {
  canCancelOrderForCurrentUser,
  getOrderStatusForCurrentUser,
  getPaymentStatusForCurrentUser,
  getRecentSupportOrderCandidatesForCurrentUser,
  getSupportOrderCandidatesForCurrentUser,
  getSupportPaymentOverviewForCurrentUser,
} from "./helpers";
import type { SupportAccountHelperInput } from "./types";

const USER_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const USER_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const USER_TENANT = "dddddddddddddddddddddddd";
const USER_OTHER_TENANT = "eeeeeeeeeeeeeeeeeeeeeeee";
const TENANT_ID = "cccccccccccccccccccccccc";
const OTHER_TENANT_ID = "ffffffffffffffffffffffff";
const ORDER_REQUESTED_A = "100000000000000000000001";
const ORDER_SCHEDULED_A = "100000000000000000000002";
const ORDER_INSIDE_CUTOFF_A = "100000000000000000000003";
const ORDER_INVOICED_A = "100000000000000000000004";
const ORDER_USER_B = "100000000000000000000005";
const ORDER_LEGACY_A = "100000000000000000000006";
const ORDER_CANCELED_A = "100000000000000000000007";
const ORDER_OTHER_TENANT = "100000000000000000000008";
const ORDER_PAID_A = "100000000000000000000009";
const ORDER_MISSING = "100000000000000000000099";
const INVOICE_A = "200000000000000000000001";
const INVOICE_B = "200000000000000000000002";
const INVOICE_MISSING = "200000000000000000000099";
const SLOT_REQUESTED = "300000000000000000000001";
const SLOT_SCHEDULED = "300000000000000000000002";
const SLOT_INSIDE_CUTOFF = "300000000000000000000003";
const SLOT_INVOICED = "300000000000000000000004";
const SLOT_CANCELED = "300000000000000000000005";

type FakeDb = {
  calls: Array<{
    method: string;
    collection?: string;
    id?: string;
    where?: unknown;
    limit?: number;
    sort?: string;
    depth?: number;
    overrideAccess?: boolean;
  }>;
  find: (args: {
    collection: string;
    where?: unknown;
    limit?: number;
    sort?: string;
    depth?: number;
    overrideAccess?: boolean;
  }) => Promise<{ docs: unknown[] }>;
  findByID: (args: {
    collection: string;
    id: string;
    depth?: number;
    overrideAccess?: boolean;
  }) => Promise<unknown>;
  create: () => never;
  update: () => never;
  delete: () => never;
};

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function baseOrder(overrides: Partial<Order> & { id: string }): Order {
  const { id, ...rest } = overrides;
  return {
    id,
    status: "pending",
    serviceStatus: "requested",
    invoiceStatus: "none",
    user: USER_A,
    tenant: TENANT_ID,
    slots: [SLOT_REQUESTED],
    amount: 12000,
    currency: "eur",
    customerSnapshot: {
      firstName: "Ada",
      lastName: "Lovelace",
      location: "Berlin",
      country: "DE",
      email: "ada@example.test",
    },
    vendorSnapshot: {
      tenantName: "Provider",
      tenantSlug: "provider",
      stripeAccountId: "acct_test",
    },
    lifecycleMode: "slot",
    updatedAt: "2026-04-27T10:00:00.000Z",
    createdAt: "2026-04-27T09:00:00.000Z",
    ...rest,
  };
}

function baseInvoice(overrides: Partial<Invoice> & { id: string }): Invoice {
  const { id, ...rest } = overrides;
  return {
    id,
    order: ORDER_INVOICED_A,
    tenant: TENANT_ID,
    customer: USER_A,
    status: "issued",
    currency: "eur",
    amountSubtotalCents: 10000,
    vatAmountCents: 1900,
    amountTotalCents: 11900,
    sellerCountryISO: "DE",
    sellerVatRegistered: true,
    vatRateBps: 1900,
    sellerLegalName: "Provider GmbH",
    sellerAddressLine1: "Street 1",
    sellerCity: "Berlin",
    sellerPostal: "10115",
    buyerName: "Ada Lovelace",
    buyerAddressLine1: "Buyer Street 1",
    buyerCity: "Berlin",
    buyerPostal: "10115",
    buyerCountryISO: "DE",
    issuedAt: "2026-04-27T11:00:00.000Z",
    paidAt: null,
    updatedAt: "2026-04-27T11:00:00.000Z",
    createdAt: "2026-04-27T11:00:00.000Z",
    ...rest,
  };
}

function baseBooking(overrides: Partial<Booking> & { id: string }): Booking {
  const { id, ...rest } = overrides;
  return {
    id,
    tenant: TENANT_ID,
    customer: USER_A,
    start: futureIso(72),
    end: futureIso(73),
    status: "confirmed",
    serviceStatus: "requested",
    paymentStatus: "unpaid",
    updatedAt: "2026-04-27T10:00:00.000Z",
    createdAt: "2026-04-27T09:00:00.000Z",
    ...rest,
  };
}

function baseTenant(overrides: Partial<Tenant> & { id: string }): Tenant {
  const { id, ...rest } = overrides;
  return {
    id,
    name: "Provider",
    slug: "provider",
    stripeAccountId: "acct_test",
    country: "DE",
    user: USER_TENANT,
    updatedAt: "2026-04-27T10:00:00.000Z",
    createdAt: "2026-04-27T09:00:00.000Z",
    ...rest,
  };
}

function makeFixtures() {
  const orders = new Map<string, Order>([
    [
      ORDER_REQUESTED_A,
      baseOrder({
        id: ORDER_REQUESTED_A,
        serviceStatus: "requested",
        invoiceStatus: "none",
        slots: [SLOT_REQUESTED],
        createdAt: "2026-04-27T09:00:00.000Z",
      }),
    ],
    [
      ORDER_SCHEDULED_A,
      baseOrder({
        id: ORDER_SCHEDULED_A,
        serviceStatus: "scheduled",
        invoiceStatus: "none",
        slots: [SLOT_SCHEDULED],
        createdAt: "2026-04-26T09:00:00.000Z",
      }),
    ],
    [
      ORDER_INSIDE_CUTOFF_A,
      baseOrder({
        id: ORDER_INSIDE_CUTOFF_A,
        serviceStatus: "scheduled",
        invoiceStatus: "none",
        slots: [SLOT_INSIDE_CUTOFF],
        createdAt: "2026-04-25T09:00:00.000Z",
      }),
    ],
    [
      ORDER_INVOICED_A,
      baseOrder({
        id: ORDER_INVOICED_A,
        serviceStatus: "scheduled",
        invoiceStatus: "issued",
        invoiceIssuedAt: "2026-04-27T11:00:00.000Z",
        paymentDueAt: "2026-05-11T11:00:00.000Z",
        slots: [SLOT_INVOICED],
        createdAt: "2026-04-24T09:00:00.000Z",
      }),
    ],
    [
      ORDER_USER_B,
      baseOrder({
        id: ORDER_USER_B,
        user: USER_B,
        serviceStatus: "requested",
        invoiceStatus: "none",
        createdAt: "2026-04-28T09:00:00.000Z",
      }),
    ],
    [
      ORDER_OTHER_TENANT,
      baseOrder({
        id: ORDER_OTHER_TENANT,
        user: USER_B,
        tenant: OTHER_TENANT_ID,
        serviceStatus: "scheduled",
        invoiceStatus: "none",
        createdAt: "2026-04-22T09:00:00.000Z",
      }),
    ],
    [
      ORDER_LEGACY_A,
      baseOrder({
        id: ORDER_LEGACY_A,
        lifecycleMode: "legacy",
        serviceStatus: "scheduled",
        invoiceStatus: "none",
        createdAt: "2026-04-29T09:00:00.000Z",
      }),
    ],
    [
      ORDER_CANCELED_A,
      baseOrder({
        id: ORDER_CANCELED_A,
        status: "canceled",
        serviceStatus: "requested",
        invoiceStatus: "none",
        canceledByRole: "tenant",
        cancelReason: "Provider cannot accommodate this request",
        slots: [
          baseBooking({
            id: SLOT_CANCELED,
            start: "2026-04-30T12:00:00.000Z",
            end: "2026-04-30T13:00:00.000Z",
            serviceSnapshot: {
              serviceName: "Deep Tissue Massage",
              serviceSlug: "deep-tissue-massage",
              tenantName: "Provider",
              tenantSlug: "provider",
              hourlyRate: 120,
            },
          }),
        ],
        createdAt: "2026-04-23T09:00:00.000Z",
      }),
    ],
    [
      ORDER_PAID_A,
      baseOrder({
        id: ORDER_PAID_A,
        status: "pending",
        serviceStatus: "accepted",
        invoiceStatus: "paid",
        paidAt: "2026-04-21T11:00:00.000Z",
        createdAt: "2026-04-21T09:00:00.000Z",
      }),
    ],
  ]);

  const invoices = new Map<string, Invoice>([
    [INVOICE_A, baseInvoice({ id: INVOICE_A })],
    [INVOICE_B, baseInvoice({ id: INVOICE_B, customer: USER_B })],
  ]);

  const bookings = new Map<string, Booking>([
    [
      SLOT_REQUESTED,
      baseBooking({
        id: SLOT_REQUESTED,
        start: futureIso(72),
        end: futureIso(73),
        serviceStatus: "requested",
      }),
    ],
    [
      SLOT_SCHEDULED,
      baseBooking({
        id: SLOT_SCHEDULED,
        start: futureIso(72),
        end: futureIso(73),
        serviceStatus: "scheduled",
      }),
    ],
    [
      SLOT_INSIDE_CUTOFF,
      baseBooking({
        id: SLOT_INSIDE_CUTOFF,
        start: futureIso(1),
        end: futureIso(2),
        serviceStatus: "scheduled",
      }),
    ],
    [
      SLOT_INVOICED,
      baseBooking({
        id: SLOT_INVOICED,
        start: futureIso(72),
        end: futureIso(73),
        serviceStatus: "accepted",
      }),
    ],
  ]);

  const tenants = new Map<string, Tenant>([
    [TENANT_ID, baseTenant({ id: TENANT_ID })],
    [
      OTHER_TENANT_ID,
      baseTenant({
        id: OTHER_TENANT_ID,
        name: "Other Provider",
        slug: "other-provider",
        user: USER_OTHER_TENANT,
      }),
    ],
  ]);

  return { orders, invoices, bookings, tenants };
}

function clauseEquals(where: unknown, field: string) {
  const value = where as Record<string, unknown> | undefined;
  const clause = value?.[field] as { equals?: unknown } | undefined;
  return clause?.equals;
}

function clauseIn(where: unknown, field: string) {
  const value = where as Record<string, unknown> | undefined;
  const clause = value?.[field] as { in?: unknown } | undefined;
  return Array.isArray(clause?.in) ? clause.in : [];
}

function makeCtx(userId: string | null = "clerk-user-a") {
  const fixtures = makeFixtures();

  // The fake DB intentionally implements only the exact reads required by the
  // helper contract. Any mutation path throws so cancellation tests prove
  // eligibility stays read-only.
  const db: FakeDb = {
    calls: [],
    async find(args) {
      this.calls.push({
        method: "find",
        collection: args.collection,
        where: args.where,
        limit: args.limit,
        sort: args.sort,
        depth: args.depth,
        overrideAccess: args.overrideAccess,
      });

      if (args.collection === "users") {
        const clerkUserId = clauseEquals(args.where, "clerkUserId");
        if (clerkUserId === "clerk-user-a") return { docs: [{ id: USER_A }] };
        if (clerkUserId === "clerk-user-b") return { docs: [{ id: USER_B }] };
        if (clerkUserId === "clerk-user-tenant") {
          return { docs: [{ id: USER_TENANT }] };
        }
        if (clerkUserId === "clerk-user-other-tenant") {
          return { docs: [{ id: USER_OTHER_TENANT }] };
        }
        return { docs: [] };
      }

      if (args.collection === "bookings") {
        const ids = clauseIn(args.where, "id");
        return {
          docs: ids
            .map((id) =>
              typeof id === "string" ? fixtures.bookings.get(id) : null,
            )
            .filter(Boolean),
        };
      }

      if (args.collection === "tenants") {
        const userId = clauseEquals(args.where, "user");
        return {
          docs: [...fixtures.tenants.values()].filter(
            (tenant) => tenant.user === userId,
          ),
        };
      }

      if (args.collection === "orders") {
        const userId = clauseEquals(args.where, "user");
        const tenantIds = clauseIn(args.where, "tenant");
        const lifecycleMode = clauseEquals(args.where, "lifecycleMode");
        return {
          docs: [...fixtures.orders.values()]
            .filter((order) =>
              userId != null
                ? order.user === userId
                : tenantIds.includes(
                    typeof order.tenant === "string"
                      ? order.tenant
                      : order.tenant.id,
                  ),
            )
            .filter((order) => order.lifecycleMode === lifecycleMode)
            .sort((left, right) =>
              String(right.createdAt).localeCompare(String(left.createdAt)),
            )
            .slice(0, args.limit ?? 10),
        };
      }

      if (args.collection === "invoices") {
        throw new Error("Unexpected invoice search; helpers must use exact ids");
      }

      return { docs: [] };
    },
    async findByID(args) {
      this.calls.push({
        method: "findByID",
        collection: args.collection,
        id: args.id,
      });

      if (args.collection === "orders") {
        return fixtures.orders.get(args.id) ?? null;
      }
      if (args.collection === "invoices") {
        return fixtures.invoices.get(args.id) ?? null;
      }
      if (args.collection === "tenants") {
        return fixtures.tenants.get(args.id) ?? null;
      }
      return null;
    },
    create() {
      throw new Error("Unexpected mutation");
    },
    update() {
      throw new Error("Unexpected mutation");
    },
    delete() {
      throw new Error("Unexpected mutation");
    },
  };

  return {
    ctx: { db, userId } as never,
    db,
    fixtures,
  };
}

function orderInput(reference: string): SupportAccountHelperInput {
  return { referenceType: "order_id", reference };
}

function invoiceInput(reference: string): SupportAccountHelperInput {
  return { referenceType: "invoice_id", reference };
}

function unsupportedInput(): SupportAccountHelperInput {
  return {
    referenceType: "payment_reference",
    reference: ORDER_REQUESTED_A,
  } as unknown as SupportAccountHelperInput;
}

function assertKeys(value: Record<string, unknown>, allowed: string[]) {
  assert.deepEqual(Object.keys(value).sort(), [...allowed].sort());
}

test("signed-out users are rejected by account-aware helpers", async () => {
  const { ctx } = makeCtx(null);

  assert.deepEqual(
    await getOrderStatusForCurrentUser(ctx, orderInput(ORDER_REQUESTED_A)),
    { ok: false, reason: "unauthenticated" },
  );
  assert.deepEqual(
    await getPaymentStatusForCurrentUser(ctx, orderInput(ORDER_REQUESTED_A)),
    { ok: false, reason: "unauthenticated" },
  );
  assert.deepEqual(
    await canCancelOrderForCurrentUser(ctx, orderInput(ORDER_REQUESTED_A)),
    { ok: false, reason: "unauthenticated" },
  );
  assert.deepEqual(await getRecentSupportOrderCandidatesForCurrentUser(ctx), {
    ok: false,
    reason: "unauthenticated",
  });
  assert.deepEqual(await getSupportPaymentOverviewForCurrentUser(ctx), {
    ok: false,
    reason: "unauthenticated",
  });
});

test("recent order candidate helper returns a constrained sanitized list", async () => {
  const { ctx, db } = makeCtx();
  const result = await getRecentSupportOrderCandidatesForCurrentUser(ctx);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.helper, "getRecentSupportOrderCandidatesForCurrentUser");
  assert.equal(result.data.resultCategory, "order_candidates");
  assert.deepEqual(
    result.data.candidates.map((candidate) => candidate.orderId),
    [ORDER_REQUESTED_A, ORDER_SCHEDULED_A, ORDER_INSIDE_CUTOFF_A],
  );
  assert.equal(result.data.candidates.length, 3);

  for (const candidate of result.data.candidates) {
    assertKeys(candidate, [
      "orderId",
      "serviceStatusCategory",
      "paymentStatusCategory",
      "invoiceStatusCategory",
      "createdAt",
      "firstSlotStart",
      "tenantDisplayName",
      "serviceNames",
      "nextStepKey",
    ]);
    assert.equal("customerSnapshot" in candidate, false);
    assert.equal("vendorSnapshot" in candidate, false);
    assert.equal("amount" in candidate, false);
    assert.equal("currency" in candidate, false);
    assert.equal("tenant" in candidate, false);
    assert.equal("user" in candidate, false);
    assert.equal("slots" in candidate, false);
    assert.equal("stripeAccountId" in candidate, false);
    assert.equal("destination" in candidate, false);
    assert.equal("checkoutSessionId" in candidate, false);
    assert.equal("paymentIntentId" in candidate, false);
  }

  const orderFind = db.calls.find(
    (call) => call.method === "find" && call.collection === "orders",
  );
  assert.ok(orderFind);
  assert.equal(orderFind.limit, 15);
  assert.equal(orderFind.sort, "-createdAt");
  assert.equal(orderFind.depth, 0);
  assert.equal(orderFind.overrideAccess, true);
  assert.equal(clauseEquals(orderFind.where, "user"), USER_A);
  assert.equal(clauseEquals(orderFind.where, "lifecycleMode"), "slot");
  assert.equal(
    db.calls.some((call) => call.collection === "invoices"),
    false,
  );
  assert.equal(
    db.calls.some((call) => call.collection === "bookings"),
    false,
  );
  assert.equal(
    db.calls.some((call) =>
      ["create", "update", "delete"].includes(call.method),
    ),
    false,
  );
});

test("status-filtered candidate helper returns bounded customer and tenant candidates", async () => {
  const customer = await getSupportOrderCandidatesForCurrentUser(makeCtx().ctx, {
    statusFilter: "canceled",
  });

  assert.equal(customer.ok, true);
  if (!customer.ok) return;

  assert.equal(customer.data.helper, "getSupportOrderCandidatesForCurrentUser");
  assert.equal(customer.data.statusFilter, "canceled");
  assert.deepEqual(
    customer.data.candidates.map((candidate) => candidate.orderId),
    [ORDER_CANCELED_A],
  );

  const tenant = await getSupportOrderCandidatesForCurrentUser(
    makeCtx("clerk-user-tenant").ctx,
    { statusFilter: "requested" },
  );

  assert.equal(tenant.ok, true);
  if (!tenant.ok) return;

  assert.deepEqual(
    tenant.data.candidates.map((candidate) => candidate.orderId),
    [ORDER_USER_B, ORDER_REQUESTED_A],
  );
  assert.equal(
    tenant.data.candidates.some(
      (candidate) => candidate.orderId === ORDER_OTHER_TENANT,
    ),
    false,
  );

  for (const candidate of tenant.data.candidates) {
    assert.equal("customerSnapshot" in candidate, false);
    assert.equal("user" in candidate, false);
    assert.equal("tenant" in candidate, false);
    assert.equal("slots" in candidate, false);
    assert.equal("stripeAccountId" in candidate, false);
  }
});

test("payment status filters map to server-owned candidate categories", async () => {
  const pending = await getSupportOrderCandidatesForCurrentUser(makeCtx().ctx, {
    statusFilter: "payment_pending",
  });
  assert.equal(pending.ok, true);
  if (pending.ok) {
    assert.deepEqual(
      pending.data.candidates.map((candidate) => candidate.orderId),
      [ORDER_INVOICED_A],
    );
  }

  const paid = await getSupportOrderCandidatesForCurrentUser(makeCtx().ctx, {
    statusFilter: "paid",
  });
  assert.equal(paid.ok, true);
  if (paid.ok) {
    assert.deepEqual(
      paid.data.candidates.map((candidate) => candidate.orderId),
      [ORDER_PAID_A],
    );
  }

  const notDue = await getSupportOrderCandidatesForCurrentUser(makeCtx().ctx, {
    statusFilter: "payment_not_due",
  });
  assert.equal(notDue.ok, true);
  if (notDue.ok) {
    assert.deepEqual(
      notDue.data.candidates.map((candidate) => candidate.orderId),
      [ORDER_REQUESTED_A, ORDER_SCHEDULED_A, ORDER_INSIDE_CUTOFF_A],
    );
  }
});

test("payment overview helper returns bounded sanitized recent-order counts", async () => {
  const { ctx, db } = makeCtx();
  const result = await getSupportPaymentOverviewForCurrentUser(ctx);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.helper, "getSupportPaymentOverviewForCurrentUser");
  assert.equal(result.data.resultCategory, "payment_overview");
  assert.equal(result.data.inspectedOrderCount, 6);
  assert.equal(result.data.limitDescription, "recent_support_orders");
  assert.deepEqual(result.data.categories, {
    paid: 1,
    paymentPending: 1,
    paymentNotDue: 3,
    paymentCanceled: 1,
    refunded: 0,
    unknown: 0,
  });
  assert.equal(result.data.recentExamples.length, 3);
  assert.deepEqual(
    result.data.recentExamples.map((candidate) => candidate.orderId),
    [ORDER_REQUESTED_A, ORDER_SCHEDULED_A, ORDER_INSIDE_CUTOFF_A],
  );
  assert.equal(result.data.nextStepKey, "pay_invoice");
  assertKeys(result.data, [
    "helper",
    "resultCategory",
    "inspectedOrderCount",
    "limitDescription",
    "categories",
    "recentExamples",
    "nextStepKey",
  ]);
  assert.equal("rawOrders" in result.data, false);
  assert.equal("rawInvoices" in result.data, false);
  assert.equal("stripeAccountId" in result.data, false);

  for (const candidate of result.data.recentExamples) {
    assert.equal("customerSnapshot" in candidate, false);
    assert.equal("vendorSnapshot" in candidate, false);
    assert.equal("amount" in candidate, false);
    assert.equal("currency" in candidate, false);
    assert.equal("tenant" in candidate, false);
    assert.equal("user" in candidate, false);
    assert.equal("slots" in candidate, false);
    assert.equal("paymentIntentId" in candidate, false);
  }

  const orderFinds = db.calls.filter(
    (call) => call.method === "find" && call.collection === "orders",
  );
  assert.equal(orderFinds.length, 1);
  assert.equal(orderFinds[0]?.limit, 10);
  assert.equal(orderFinds[0]?.sort, "-createdAt");
  assert.equal(orderFinds[0]?.depth, 0);
  assert.equal(orderFinds[0]?.overrideAccess, true);
  assert.equal(
    db.calls.some((call) => call.collection === "invoices"),
    false,
  );
  assert.equal(
    db.calls.some((call) =>
      ["create", "update", "delete"].includes(call.method),
    ),
    false,
  );
});

test("payment overview helper includes tenant-owned orders without wrong-tenant data", async () => {
  const { ctx } = makeCtx("clerk-user-tenant");
  const result = await getSupportPaymentOverviewForCurrentUser(ctx);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.inspectedOrderCount, 7);
  assert.deepEqual(result.data.categories, {
    paid: 1,
    paymentPending: 1,
    paymentNotDue: 4,
    paymentCanceled: 1,
    refunded: 0,
    unknown: 0,
  });
  assert.equal(
    result.data.recentExamples.some(
      (candidate) => candidate.orderId === ORDER_OTHER_TENANT,
    ),
    false,
  );
  assert.deepEqual(
    result.data.recentExamples.map((candidate) => candidate.orderId),
    [ORDER_USER_B, ORDER_REQUESTED_A, ORDER_SCHEDULED_A],
  );
});

test("signed-in user can access own requested order status with sanitized DTO", async () => {
  const { ctx } = makeCtx();
  const result = await getOrderStatusForCurrentUser(
    ctx,
    orderInput(ORDER_REQUESTED_A),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.serviceStatusCategory, "requested");
  assert.equal(result.data.paymentStatusCategory, "not_due");
  assert.equal(result.data.invoiceStatusCategory, "none");
  assert.equal(result.data.accessRole, "customer");
  assert.equal(result.data.nextStepKey, "await_provider_confirmation");
  assert.equal(result.data.firstSlotStart, undefined);
  assert.equal(result.data.providerDisplayName, "Provider");
  assert.equal(result.data.statusReasonKey, "awaiting_provider_confirmation");
  assert.equal(result.data.publicStatusReason, undefined);
  assertKeys(result.data, [
    "helper",
    "referenceType",
    "resultCategory",
    "serviceStatusCategory",
    "paymentStatusCategory",
    "invoiceStatusCategory",
    "accessRole",
    "nextStepKey",
    "createdAt",
    "firstSlotStart",
    "lastUpdatedAt",
    "providerDisplayName",
    "serviceNames",
    "canceledByRole",
    "statusReasonKey",
    "publicStatusReason",
  ]);
});

test("order status exposes only support-safe selected-order summary fields", async () => {
  const { ctx } = makeCtx();
  const result = await getOrderStatusForCurrentUser(
    ctx,
    orderInput(ORDER_CANCELED_A),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.serviceStatusCategory, "canceled");
  assert.equal(result.data.paymentStatusCategory, "canceled");
  assert.equal(result.data.accessRole, "customer");
  assert.equal(result.data.providerDisplayName, "Provider");
  assert.deepEqual(result.data.serviceNames, ["Deep Tissue Massage"]);
  assert.equal(result.data.firstSlotStart, "2026-04-30T12:00:00.000Z");
  assert.equal(result.data.canceledByRole, "tenant");
  assert.equal(result.data.statusReasonKey, "provider_declined");
  assert.equal(
    result.data.publicStatusReason,
    "Provider cannot accommodate this request",
  );
  assert.equal("customerSnapshot" in result.data, false);
  assert.equal("vendorSnapshot" in result.data, false);
  assert.equal("amount" in result.data, false);
  assert.equal("currency" in result.data, false);
  assert.equal("tenant" in result.data, false);
  assert.equal("user" in result.data, false);
  assert.equal("slots" in result.data, false);
  assert.equal("stripeAccountId" in result.data, false);
  assert.equal("destination" in result.data, false);
  assert.equal("checkoutSessionId" in result.data, false);
  assert.equal("paymentIntentId" in result.data, false);
});

test("tenant owner can access exact orders for their tenant with support-safe DTO", async () => {
  const { ctx } = makeCtx("clerk-user-tenant");
  const result = await getOrderStatusForCurrentUser(
    ctx,
    orderInput(ORDER_USER_B),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.accessRole, "tenant");
  assert.equal(result.data.serviceStatusCategory, "requested");
  assert.equal(result.data.providerDisplayName, "Provider");
  assert.equal("customerSnapshot" in result.data, false);
  assert.equal("user" in result.data, false);
  assert.equal("tenant" in result.data, false);
  assert.equal("slots" in result.data, false);
  assert.equal("stripeAccountId" in result.data, false);
});

test("wrong-tenant and missing exact orders collapse to the same denial", async () => {
  const { ctx } = makeCtx("clerk-user-tenant");

  assert.deepEqual(
    await getOrderStatusForCurrentUser(ctx, orderInput(ORDER_OTHER_TENANT)),
    { ok: false, reason: "not_found_or_not_owned" },
  );
  assert.deepEqual(
    await getOrderStatusForCurrentUser(ctx, orderInput(ORDER_MISSING)),
    { ok: false, reason: "not_found_or_not_owned" },
  );
});

test("order-id payment status uses only the exact owned order", async () => {
  const { ctx, db } = makeCtx();
  const result = await getPaymentStatusForCurrentUser(
    ctx,
    orderInput(ORDER_REQUESTED_A),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.paymentStatusCategory, "not_due");
  assert.equal(result.data.invoiceStatusCategory, "none");
  assert.equal(result.data.serviceStatusCategory, "requested");
  assert.equal(result.data.accessRole, "customer");
  assert.equal(result.data.nextStepKey, "view_orders");
  assert.equal(
    db.calls.some(
      (call) => call.method === "find" && call.collection === "invoices",
    ),
    false,
  );
  assertKeys(result.data, [
    "helper",
    "referenceType",
    "resultCategory",
    "paymentStatusCategory",
    "invoiceStatusCategory",
    "serviceStatusCategory",
    "accessRole",
    "nextStepKey",
    "issuedAt",
    "paidAt",
    "paymentDueAt",
  ]);
});

test("tenant owner can access exact order payment status through order ownership", async () => {
  const { ctx, db } = makeCtx("clerk-user-tenant");
  const result = await getPaymentStatusForCurrentUser(
    ctx,
    orderInput(ORDER_INVOICED_A),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.accessRole, "tenant");
  assert.equal(result.data.paymentStatusCategory, "pending");
  assert.equal(result.data.invoiceStatusCategory, "issued");
  assert.equal(result.data.serviceStatusCategory, "scheduled");
  assert.equal(
    db.calls.some((call) => call.method === "find" && call.collection === "invoices"),
    false,
  );
});

test("order-id payment status reflects pay-later invoice cache fields", async () => {
  const { ctx } = makeCtx();
  const result = await getPaymentStatusForCurrentUser(
    ctx,
    orderInput(ORDER_INVOICED_A),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.paymentStatusCategory, "pending");
  assert.equal(result.data.invoiceStatusCategory, "issued");
  assert.equal(result.data.serviceStatusCategory, "scheduled");
  assert.equal(result.data.nextStepKey, "pay_invoice");
  assert.equal(result.data.issuedAt, "2026-04-27T11:00:00.000Z");
  assert.equal(result.data.paymentDueAt, "2026-05-11T11:00:00.000Z");
});

test("order-id payment status treats paid invoice cache as paid", async () => {
  const { ctx } = makeCtx();
  const result = await getPaymentStatusForCurrentUser(
    ctx,
    orderInput(ORDER_PAID_A),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.paymentStatusCategory, "paid");
  assert.equal(result.data.invoiceStatusCategory, "paid");
  assert.equal(result.data.serviceStatusCategory, "accepted");
  assert.equal(result.data.nextStepKey, "no_action_needed");
  assert.equal(result.data.paidAt, "2026-04-21T11:00:00.000Z");
});

test("signed-in user can access own invoice payment status", async () => {
  const { ctx } = makeCtx();
  const result = await getPaymentStatusForCurrentUser(ctx, invoiceInput(INVOICE_A));

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.referenceType, "invoice_id");
  assert.equal(result.data.paymentStatusCategory, "pending");
  assert.equal(result.data.invoiceStatusCategory, "issued");
  assert.equal(result.data.nextStepKey, "pay_invoice");
  assertKeys(result.data, [
    "helper",
    "referenceType",
    "resultCategory",
    "paymentStatusCategory",
    "invoiceStatusCategory",
    "nextStepKey",
    "issuedAt",
    "paidAt",
  ]);
});

test("wrong-owner and missing order references collapse to the same denial", async () => {
  const { ctx } = makeCtx();

  assert.deepEqual(
    await getOrderStatusForCurrentUser(ctx, orderInput(ORDER_USER_B)),
    { ok: false, reason: "not_found_or_not_owned" },
  );
  assert.deepEqual(
    await getOrderStatusForCurrentUser(ctx, orderInput(ORDER_MISSING)),
    { ok: false, reason: "not_found_or_not_owned" },
  );
});

test("wrong-owner and missing invoice references collapse to the same denial", async () => {
  const { ctx } = makeCtx();

  assert.deepEqual(await getPaymentStatusForCurrentUser(ctx, invoiceInput(INVOICE_B)), {
    ok: false,
    reason: "not_found_or_not_owned",
  });
  assert.deepEqual(
    await getPaymentStatusForCurrentUser(ctx, invoiceInput(INVOICE_MISSING)),
    { ok: false, reason: "not_found_or_not_owned" },
  );
});

test("missing, invalid, and unsupported references fail safely", async () => {
  const { ctx, db } = makeCtx();

  assert.deepEqual(await getOrderStatusForCurrentUser(ctx, orderInput("   ")), {
    ok: false,
    reason: "missing_reference",
  });
  assert.deepEqual(await getOrderStatusForCurrentUser(ctx, orderInput("bad-id")), {
    ok: false,
    reason: "invalid_reference",
  });
  assert.equal(
    db.calls.some((call) => call.method === "findByID"),
    false,
    "invalid references must not reach exact object lookup",
  );

  assert.deepEqual(await getOrderStatusForCurrentUser(ctx, unsupportedInput()), {
    ok: false,
    reason: "unsupported_reference_type",
  });
  assert.deepEqual(await canCancelOrderForCurrentUser(ctx, invoiceInput(INVOICE_A)), {
    ok: false,
    reason: "unsupported_reference_type",
  });
});

test("cancellation helper reports requested eligibility and does not mutate data", async () => {
  const { ctx, fixtures } = makeCtx();
  const before = JSON.stringify({
    orders: [...fixtures.orders.entries()],
    bookings: [...fixtures.bookings.entries()],
  });

  const result = await canCancelOrderForCurrentUser(
    ctx,
    orderInput(ORDER_REQUESTED_A),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.canCancel, true);
  assert.equal(result.data.accessRole, "customer");
  assert.equal(result.data.blockReason, undefined);
  assert.equal(result.data.nextStepKey, "cancel_in_app");
  assert.equal(
    JSON.stringify({
      orders: [...fixtures.orders.entries()],
      bookings: [...fixtures.bookings.entries()],
    }),
    before,
  );
  assertKeys(result.data, [
    "helper",
    "referenceType",
    "resultCategory",
    "accessRole",
    "canCancel",
    "blockReason",
    "nextStepKey",
    "firstSlotStart",
    "cutoffAt",
  ]);
});

test("tenant order cancellation eligibility remains read-only", async () => {
  const { ctx, fixtures } = makeCtx("clerk-user-tenant");
  const before = JSON.stringify({
    orders: [...fixtures.orders.entries()],
    bookings: [...fixtures.bookings.entries()],
  });

  const result = await canCancelOrderForCurrentUser(
    ctx,
    orderInput(ORDER_SCHEDULED_A),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.accessRole, "tenant");
  assert.equal(
    JSON.stringify({
      orders: [...fixtures.orders.entries()],
      bookings: [...fixtures.bookings.entries()],
    }),
    before,
  );
});

test("cancellation helper matches slot-lifecycle/pay-later guard outcomes", async () => {
  const { ctx } = makeCtx();

  const scheduled = await canCancelOrderForCurrentUser(
    ctx,
    orderInput(ORDER_SCHEDULED_A),
  );
  assert.equal(scheduled.ok, true);
  if (scheduled.ok) {
    assert.equal(scheduled.data.canCancel, true);
    assert.equal(scheduled.data.nextStepKey, "cancel_in_app");
  }

  const insideCutoff = await canCancelOrderForCurrentUser(
    ctx,
    orderInput(ORDER_INSIDE_CUTOFF_A),
  );
  assert.equal(insideCutoff.ok, true);
  if (insideCutoff.ok) {
    assert.equal(insideCutoff.data.canCancel, false);
    assert.equal(insideCutoff.data.blockReason, "cutoff_passed");
  }

  const invoiced = await canCancelOrderForCurrentUser(
    ctx,
    orderInput(ORDER_INVOICED_A),
  );
  assert.equal(invoiced.ok, true);
  if (invoiced.ok) {
    assert.equal(invoiced.data.canCancel, false);
    assert.equal(invoiced.data.blockReason, "invoice_exists");
  }
});
