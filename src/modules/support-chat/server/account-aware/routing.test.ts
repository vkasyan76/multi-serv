import test from "node:test";
import assert from "node:assert/strict";

import type { Booking, Invoice, Order } from "@/payload-types";
import { buildAccountAwareServerResponse } from "./server-responses";
import { routeSupportAccountAwareRequest } from "./routing";

const USER_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const USER_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const TENANT_ID = "cccccccccccccccccccccccc";
const ORDER_REQUESTED_A = "100000000000000000000001";
const ORDER_USER_B = "100000000000000000000005";
const INVOICE_A = "200000000000000000000001";
const SLOT_REQUESTED = "300000000000000000000001";

type FakeDb = {
  calls: Array<{ method: string; collection?: string; id?: string }>;
  find: (args: { collection: string; where?: unknown }) => Promise<{ docs: unknown[] }>;
  findByID: (args: { collection: string; id: string }) => Promise<unknown>;
  create: () => never;
  update: () => never;
  delete: () => never;
};

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function order(overrides: Partial<Order> & { id: string }): Order {
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
    },
    vendorSnapshot: {
      tenantName: "Provider",
      tenantSlug: "provider",
    },
    lifecycleMode: "slot",
    updatedAt: "2026-04-27T10:00:00.000Z",
    createdAt: "2026-04-27T09:00:00.000Z",
    ...rest,
  };
}

function invoice(overrides: Partial<Invoice> & { id: string }): Invoice {
  const { id, ...rest } = overrides;
  return {
    id,
    order: ORDER_REQUESTED_A,
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
    updatedAt: "2026-04-27T11:00:00.000Z",
    createdAt: "2026-04-27T11:00:00.000Z",
    ...rest,
  };
}

function booking(overrides: Partial<Booking> & { id: string }): Booking {
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
  const orders = new Map<string, Order>([
    [ORDER_REQUESTED_A, order({ id: ORDER_REQUESTED_A })],
    [ORDER_USER_B, order({ id: ORDER_USER_B, user: USER_B })],
  ]);
  const invoices = new Map<string, Invoice>([
    [INVOICE_A, invoice({ id: INVOICE_A })],
  ]);
  const bookings = new Map<string, Booking>([
    [SLOT_REQUESTED, booking({ id: SLOT_REQUESTED })],
  ]);

  const db: FakeDb = {
    calls: [],
    async find(args) {
      this.calls.push({ method: "find", collection: args.collection });

      if (args.collection === "users") {
        const clerkUserId = clauseEquals(args.where, "clerkUserId");
        if (clerkUserId === "clerk-user-a") return { docs: [{ id: USER_A }] };
        if (clerkUserId === "clerk-user-b") return { docs: [{ id: USER_B }] };
      }

      if (args.collection === "bookings") {
        const ids = clauseIn(args.where, "id");
        return {
          docs: ids
            .map((id) => (typeof id === "string" ? bookings.get(id) : null))
            .filter(Boolean),
        };
      }

      if (args.collection === "invoices" || args.collection === "orders") {
        throw new Error("Unexpected broad account lookup");
      }

      return { docs: [] };
    },
    async findByID(args) {
      this.calls.push({ method: "findByID", collection: args.collection, id: args.id });
      if (args.collection === "orders") return orders.get(args.id) ?? null;
      if (args.collection === "invoices") return invoices.get(args.id) ?? null;
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

  return { db, accountContext: { db, userId } as never };
}

async function respond(message: string, userId: string | null = "clerk-user-a") {
  const route = routeSupportAccountAwareRequest(message);
  assert.notEqual(route.kind, "none");
  const { db, accountContext } = makeCtx(userId);
  const response = await buildAccountAwareServerResponse({
    route: route as Exclude<typeof route, { kind: "none" }>,
    accountContext,
    locale: "en",
  });
  return { route, response, db };
}

test("routes exact order status requests to deterministic helper responses", async () => {
  const { route, response } = await respond(
    `What is my order status ${ORDER_REQUESTED_A}?`,
  );

  assert.equal(route.kind, "helper");
  if (route.kind === "helper") {
    assert.equal(route.helper, "getOrderStatusForCurrentUser");
  }
  assert.equal(response.disposition, "answered");
  assert.equal(response.needsHumanSupport, false);
  assert.equal(response.accountHelperMetadata.helper, "getOrderStatusForCurrentUser");
  assert.match(response.assistantMessage, /awaiting provider confirmation/i);
});

test("routes exact payment requests by order and invoice reference", async () => {
  const byOrder = await respond(`Did my payment go through for order ${ORDER_REQUESTED_A}?`);
  assert.equal(byOrder.route.kind, "helper");
  if (byOrder.route.kind === "helper") {
    assert.equal(byOrder.route.input.referenceType, "order_id");
  }
  assert.equal(byOrder.response.disposition, "answered");
  assert.match(byOrder.response.assistantMessage, /not due/i);

  const byInvoice = await respond(`What is invoice ${INVOICE_A} status?`);
  assert.equal(byInvoice.route.kind, "helper");
  if (byInvoice.route.kind === "helper") {
    assert.equal(byInvoice.route.input.referenceType, "invoice_id");
  }
  assert.equal(byInvoice.response.disposition, "answered");
  assert.match(byInvoice.response.assistantMessage, /payment is pending/i);
});

test("routes exact cancellation eligibility without mutating", async () => {
  const { route, response, db } = await respond(`Can I cancel order ${ORDER_REQUESTED_A}?`);

  assert.equal(route.kind, "helper");
  if (route.kind === "helper") {
    assert.equal(route.helper, "canCancelOrderForCurrentUser");
  }
  assert.equal(response.disposition, "answered");
  assert.match(response.assistantMessage, /eligible for in-app cancellation/i);
  assert.equal(db.calls.some((call) => call.method === "update"), false);
});

test("signed-out exact account request returns safe handoff", async () => {
  const { response } = await respond(`Check my order ${ORDER_REQUESTED_A}`, null);

  assert.equal(response.disposition, "unsupported_account_question");
  assert.equal(response.needsHumanSupport, true);
  assert.equal(response.accountHelperMetadata.deniedReason, "unauthenticated");
  assert.match(response.assistantMessage, /cannot check live order/i);
});

test("signed-out missing-reference account request returns safe handoff", async () => {
  const route = routeSupportAccountAwareRequest("What is my order status?");
  assert.equal(route.kind, "missing_reference");

  const { accountContext } = makeCtx(null);
  const response = await buildAccountAwareServerResponse({
    route: route as Exclude<typeof route, { kind: "none" }>,
    accountContext,
    locale: "en",
  });

  assert.equal(response.disposition, "unsupported_account_question");
  assert.equal(response.needsHumanSupport, true);
  assert.equal(response.accountHelperMetadata.deniedReason, "unauthenticated");
  assert.equal(response.accountHelperMetadata.authenticated, false);
  assert.equal(response.accountHelperMetadata.requiredInputPresent, false);
  assert.match(response.assistantMessage, /cannot check live order/i);
});

test("missing, invalid, and wrong-owner references are deterministic and safe", async () => {
  const missingRoute = routeSupportAccountAwareRequest("What is my order status?");
  assert.equal(missingRoute.kind, "missing_reference");
  if (missingRoute.kind === "missing_reference") {
    const { accountContext } = makeCtx();
    const missingResponse = await buildAccountAwareServerResponse({
      route: missingRoute,
      accountContext,
      locale: "en",
    });
    assert.equal(missingResponse.disposition, "uncertain");
    assert.match(missingResponse.assistantMessage, /exact order ID/i);
  }

  const invalid = await respond("What is my order status order id abc123?");
  assert.equal(invalid.response.disposition, "unsupported_account_question");
  assert.equal(invalid.response.accountHelperMetadata.deniedReason, "invalid_reference");

  const wrongOwner = await respond(`What is my order status ${ORDER_USER_B}?`);
  assert.equal(wrongOwner.response.disposition, "unsupported_account_question");
  assert.equal(
    wrongOwner.response.accountHelperMetadata.deniedReason,
    "not_found_or_not_owned",
  );
  assert.doesNotMatch(wrongOwner.response.assistantMessage, /belongs to another/i);
});

test("broad or deferred account prompts do not helper-route", async () => {
  for (const prompt of [
    "Find my latest order",
    "Show all my payments",
    "Check my account",
    "Find my booking from last week",
    "Check the order with this provider",
  ]) {
    const route = routeSupportAccountAwareRequest(prompt);
    assert.equal(route.kind, "broad_or_deferred", prompt);
  }
});

test("multiple references ask for clarification instead of guessing", () => {
  const route = routeSupportAccountAwareRequest(
    `Check order ${ORDER_REQUESTED_A} and order ${ORDER_USER_B}`,
  );

  assert.equal(route.kind, "missing_reference");
});

test("policy-only status language does not route to account helpers", () => {
  assert.deepEqual(routeSupportAccountAwareRequest("What do booking statuses mean?"), {
    kind: "none",
  });
  assert.deepEqual(routeSupportAccountAwareRequest("What does requested mean for a booking?"), {
    kind: "none",
  });
});
