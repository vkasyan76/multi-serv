import test from "node:test";
import assert from "node:assert/strict";

import type { Booking, Invoice, Order, Tenant } from "@/payload-types";
import {
  buildAccountAwareActionResponse,
  buildAccountAwareServerResponse,
} from "./server-responses";
import { routeSupportAccountAwareRequest } from "./routing";
import { createAccountCandidateActionToken } from "./action-tokens";

process.env.PAYLOAD_SECRET ??= "support-chat-action-test-secret";

const USER_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const USER_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const USER_TENANT = "dddddddddddddddddddddddd";
const USER_OTHER_TENANT = "eeeeeeeeeeeeeeeeeeeeeeee";
const TENANT_ID = "cccccccccccccccccccccccc";
const OTHER_TENANT_ID = "ffffffffffffffffffffffff";
const ORDER_REQUESTED_A = "100000000000000000000001";
const ORDER_SCHEDULED_A = "100000000000000000000002";
const ORDER_USER_B = "100000000000000000000005";
const ORDER_CANCELED_A = "100000000000000000000007";
const ORDER_OTHER_TENANT = "100000000000000000000008";
const ORDER_PAID_A = "100000000000000000000009";
const INVOICE_A = "200000000000000000000001";
const SLOT_REQUESTED = "300000000000000000000001";
const SLOT_CANCELED = "300000000000000000000005";
const THREAD_ID = "11111111-1111-4111-8111-111111111111";

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

function tenant(overrides: Partial<Tenant> & { id: string }): Tenant {
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
    [
      ORDER_SCHEDULED_A,
      order({
        id: ORDER_SCHEDULED_A,
        serviceStatus: "scheduled",
        invoiceStatus: "issued",
        createdAt: "2026-04-26T09:00:00.000Z",
      }),
    ],
    [ORDER_USER_B, order({ id: ORDER_USER_B, user: USER_B })],
    [
      ORDER_OTHER_TENANT,
      order({
        id: ORDER_OTHER_TENANT,
        user: USER_B,
        tenant: OTHER_TENANT_ID,
        serviceStatus: "scheduled",
        createdAt: "2026-04-24T09:00:00.000Z",
      }),
    ],
    [
      ORDER_CANCELED_A,
      order({
        id: ORDER_CANCELED_A,
        status: "canceled",
        serviceStatus: "requested",
        canceledByRole: "tenant",
        cancelReason: "Provider cannot accommodate this request",
        slots: [
          booking({
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
        createdAt: "2026-04-25T09:00:00.000Z",
      }),
    ],
    [
      ORDER_PAID_A,
      order({
        id: ORDER_PAID_A,
        status: "paid",
        serviceStatus: "accepted",
        invoiceStatus: "paid",
        paidAt: "2026-04-21T11:00:00.000Z",
        createdAt: "2026-04-21T09:00:00.000Z",
      }),
    ],
  ]);
  const invoices = new Map<string, Invoice>([
    [INVOICE_A, invoice({ id: INVOICE_A })],
  ]);
  const bookings = new Map<string, Booking>([
    [SLOT_REQUESTED, booking({ id: SLOT_REQUESTED })],
  ]);
  const tenants = new Map<string, Tenant>([
    [TENANT_ID, tenant({ id: TENANT_ID })],
    [
      OTHER_TENANT_ID,
      tenant({
        id: OTHER_TENANT_ID,
        name: "Other Provider",
        slug: "other-provider",
        user: USER_OTHER_TENANT,
      }),
    ],
  ]);

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
      }

      if (args.collection === "bookings") {
        const ids = clauseIn(args.where, "id");
        return {
          docs: ids
            .map((id) => (typeof id === "string" ? bookings.get(id) : null))
            .filter(Boolean),
        };
      }

      if (args.collection === "tenants") {
        const userId = clauseEquals(args.where, "user");
        return {
          docs: [...tenants.values()].filter((item) => item.user === userId),
        };
      }

      if (args.collection === "orders") {
        const userId = clauseEquals(args.where, "user");
        const tenantIds = clauseIn(args.where, "tenant");
        const lifecycleMode = clauseEquals(args.where, "lifecycleMode");
        assert.ok(args.limit === 10 || args.limit === 15);
        assert.equal(args.sort, "-createdAt");
        assert.equal(args.depth, 0);
        assert.equal(args.overrideAccess, true);
        assert.equal(lifecycleMode, "slot");
        return {
          docs: [...orders.values()]
            .filter((item) =>
              userId != null
                ? item.user === userId
                : tenantIds.includes(
                    typeof item.tenant === "string"
                      ? item.tenant
                      : item.tenant.id,
                  ),
            )
            .filter((item) => item.lifecycleMode === lifecycleMode)
            .sort((left, right) =>
              String(right.createdAt).localeCompare(String(left.createdAt)),
            )
            .slice(0, args.limit),
        };
      }

      if (args.collection === "invoices") {
        throw new Error("Unexpected broad account lookup");
      }

      return { docs: [] };
    },
    async findByID(args) {
      this.calls.push({ method: "findByID", collection: args.collection, id: args.id });
      if (args.collection === "orders") return orders.get(args.id) ?? null;
      if (args.collection === "invoices") return invoices.get(args.id) ?? null;
      if (args.collection === "tenants") return tenants.get(args.id) ?? null;
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
    threadId: THREAD_ID,
  });
  return { route, response, db, accountContext };
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

  const exactWithCandidateContext = routeSupportAccountAwareRequest(
    `What is the status of my order with this provider ${ORDER_REQUESTED_A}?`,
  );
  assert.equal(exactWithCandidateContext.kind, "helper");
  if (exactWithCandidateContext.kind === "helper") {
    assert.equal(exactWithCandidateContext.helper, "getOrderStatusForCurrentUser");
  }
});

test("selected order status response includes support-safe order context", async () => {
  const { response } = await respond(
    `What is my order status ${ORDER_CANCELED_A}?`,
  );

  assert.equal(response.disposition, "answered");
  assert.equal(response.accountHelperMetadata.helper, "getOrderStatusForCurrentUser");
  assert.match(response.assistantMessage, /This order is canceled/i);
  assert.match(response.assistantMessage, /Provider: Provider/i);
  assert.match(response.assistantMessage, /Service: Deep Tissue Massage/i);
  assert.match(response.assistantMessage, /Date: 30 Apr 2026/i);
  assert.match(response.assistantMessage, /Reason: The provider declined/i);
  assert.match(
    response.assistantMessage,
    /Provider\/customer note: Provider cannot accommodate this request/i,
  );
  assert.doesNotMatch(response.assistantMessage, /stripe|paymentIntent|checkoutSession/i);
});

test("tenant exact order status uses tenant wording and safe authorization", async () => {
  const { response } = await respond(
    `What is my order status ${ORDER_USER_B}?`,
    "clerk-user-tenant",
  );

  assert.equal(response.disposition, "answered");
  assert.equal(response.accountHelperMetadata.helper, "getOrderStatusForCurrentUser");
  assert.match(response.assistantMessage, /customer booking request/i);
  assert.match(response.assistantMessage, /awaiting your confirmation/i);
  assert.match(response.assistantMessage, /Provider: Provider/i);
  assert.doesNotMatch(response.assistantMessage, /Ada|Lovelace|email|stripe/i);

  const wrongTenant = await respond(
    `What is my order status ${ORDER_OTHER_TENANT}?`,
    "clerk-user-tenant",
  );
  assert.equal(wrongTenant.response.disposition, "unsupported_account_question");
  assert.equal(
    wrongTenant.response.accountHelperMetadata.deniedReason,
    "not_found_or_not_owned",
  );
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

  const explicitPaymentStatus = routeSupportAccountAwareRequest(
    `Payment status for order ${ORDER_REQUESTED_A}`,
  );
  assert.equal(explicitPaymentStatus.kind, "helper");
  if (explicitPaymentStatus.kind === "helper") {
    assert.equal(explicitPaymentStatus.helper, "getPaymentStatusForCurrentUser");
  }

  const overviewWithExactOrder = routeSupportAccountAwareRequest(
    `Did I pay already for order ${ORDER_REQUESTED_A}?`,
  );
  assert.equal(overviewWithExactOrder.kind, "helper");
  if (overviewWithExactOrder.kind === "helper") {
    assert.equal(overviewWithExactOrder.helper, "getPaymentStatusForCurrentUser");
  }
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

test("signed-out candidate-selection account request returns safe handoff", async () => {
  const route = routeSupportAccountAwareRequest("What is my order status?");
  assert.equal(route.kind, "candidate_selection");

  const { accountContext, db } = makeCtx(null);
  const response = await buildAccountAwareServerResponse({
    route: route as Exclude<typeof route, { kind: "none" }>,
    accountContext,
    locale: "en",
    threadId: THREAD_ID,
  });

  assert.equal(response.disposition, "unsupported_account_question");
  assert.equal(response.needsHumanSupport, true);
  assert.equal(response.accountHelperMetadata.deniedReason, "unauthenticated");
  assert.equal(response.accountHelperMetadata.authenticated, false);
  assert.equal(response.accountHelperMetadata.requiredInputPresent, false);
  assert.match(response.assistantMessage, /cannot check live order/i);
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("missing, invalid, and wrong-owner references are deterministic and safe", async () => {
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
    "Show all my orders",
    "Show all my payments",
    "Check my account",
    "Show my order history",
    "Export my orders",
    "Show all my invoices",
  ]) {
    const route = routeSupportAccountAwareRequest(prompt);
    assert.equal(route.kind, "broad_or_deferred", prompt);
  }
});

test("status-filtered prompts route to bounded candidate selection", async () => {
  const cases = [
    ["Show my canceled orders", "canceled"],
    ["Which orders are scheduled?", "scheduled"],
    ["Show unpaid bookings", "payment_pending"],
    ["Which bookings are awaiting confirmation?", "requested"],
    ["Show my completed bookings", "completed_or_accepted"],
    ["Show my paid orders", "paid"],
  ] as const;

  for (const [prompt, filter] of cases) {
    const route = routeSupportAccountAwareRequest(prompt);
    assert.equal(route.kind, "candidate_selection", prompt);
    if (route.kind === "candidate_selection") {
      assert.equal(route.statusFilter, filter, prompt);
    }
  }
});

test("payment overview prompts route to bounded overview helper", async () => {
  for (const prompt of [
    "Did I pay already for any order?",
    "Have I paid for anything?",
    "Do I have unpaid orders?",
    "Do I have unpaid bookings?",
    "Any paid orders?",
    "What payments are still pending?",
  ]) {
    assert.deepEqual(
      routeSupportAccountAwareRequest(prompt),
      { kind: "payment_overview" },
      prompt,
    );
  }
});

test("vague account prompts route to candidate selection", () => {
  for (const prompt of [
    "What is my order status?",
    "Did my payment go through?",
    "What was my last payment?",
    "Why has my order not been paid yet?",
    "Can I cancel my latest booking?",
    "Find my latest order",
    "What was my last order?",
    "What is my most recent booking?",
    "Was war meine letzte Buchung?",
    "Quelle est ma dernière réservation ?",
    "Quelle est ma derniere reservation ?",
    "What happened with my booking from last week?",
    "What is the status of my order with this provider?",
  ]) {
    assert.equal(
      routeSupportAccountAwareRequest(prompt).kind,
      "candidate_selection",
      prompt,
    );
  }
});

test("candidate selection returns clickable actions without exact helper calls", async () => {
  const { route, response, db } = await respond("What was my last order?");

  assert.equal(route.kind, "candidate_selection");
  if (route.kind === "candidate_selection") {
    assert.equal(route.selectionHelper, "getOrderStatusForCurrentUser");
  }
  assert.equal(response.disposition, "uncertain");
  assert.equal(response.needsHumanSupport, false);
  assert.equal(
    response.accountHelperMetadata.helper,
    "getSupportOrderCandidatesForCurrentUser",
  );
  assert.equal(response.accountHelperMetadata.resultCategory, "order_candidates");
  assert.match(response.assistantMessage, /Which order do you mean/i);
  assert.equal(response.actions?.length, 3);
  assert.equal(response.actions?.[0]?.type, "account_candidate_select");
  assert.match(response.actions?.[0]?.label ?? "", /Provider/i);
  assert.match(response.actions?.[0]?.label ?? "", /27 Apr 2026/i);
  assert.match(response.actions?.[0]?.description ?? "", /requested/i);
  assert.match(response.actions?.[0]?.description ?? "", /payment not due/i);
  assert.ok(response.actions?.[0]?.token);
  assert.doesNotMatch(response.actions?.[0]?.token ?? "", new RegExp(ORDER_REQUESTED_A));
  assert.doesNotMatch(response.assistantMessage, /your last order is/i);
  assert.doesNotMatch(response.assistantMessage, /reply\s+(1|one)/i);
  assert.equal(
    db.calls.some((call) => call.method === "findByID"),
    false,
  );
});

test("filtered candidate selection returns bounded customer candidates", async () => {
  const { route, response, db } = await respond("Show my canceled orders");

  assert.equal(route.kind, "candidate_selection");
  if (route.kind === "candidate_selection") {
    assert.equal(route.statusFilter, "canceled");
  }
  assert.equal(response.disposition, "uncertain");
  assert.equal(
    response.accountHelperMetadata.helper,
    "getSupportOrderCandidatesForCurrentUser",
  );
  assert.match(response.assistantMessage, /recent canceled booking candidate/i);
  assert.equal(response.actions?.length, 1);
  assert.match(response.actions?.[0]?.description ?? "", /canceled/i);
  assert.equal(
    db.calls.some((call) => call.method === "findByID" && call.collection === "orders"),
    false,
  );
});

test("filtered candidate selection returns tenant-owned candidates", async () => {
  const { route, response } = await respond(
    "Which bookings are awaiting confirmation?",
    "clerk-user-tenant",
  );

  assert.equal(route.kind, "candidate_selection");
  if (route.kind === "candidate_selection") {
    assert.equal(route.statusFilter, "requested");
  }
  assert.equal(response.disposition, "uncertain");
  assert.match(response.assistantMessage, /recent requested booking candidates/i);
  assert.equal(response.actions?.length, 2);
  assert.doesNotMatch(
    JSON.stringify(response.actions),
    new RegExp(ORDER_OTHER_TENANT),
  );
});

test("empty filtered candidate selection stays bounded and deterministic", async () => {
  const { response } = await respond(
    "Show my paid orders",
    "clerk-user-other-tenant",
  );

  assert.equal(response.disposition, "uncertain");
  assert.match(response.assistantMessage, /could not find recent paid booking candidates/i);
  assert.match(response.assistantMessage, /not a full history check/i);
  assert.equal(response.actions?.length, 0);
});

test("payment overview returns bounded deterministic summary", async () => {
  const { route, response, db } = await respond("Did I pay already for any order?");

  assert.equal(route.kind, "payment_overview");
  assert.equal(response.disposition, "answered");
  assert.equal(response.needsHumanSupport, false);
  assert.equal(
    response.accountHelperMetadata.helper,
    "getSupportPaymentOverviewForCurrentUser",
  );
  assert.equal(response.accountHelperMetadata.resultCategory, "payment_overview");
  assert.match(response.assistantMessage, /From the recent orders I can safely check/i);
  assert.match(response.assistantMessage, /1 paid order/i);
  assert.match(response.assistantMessage, /1 with payment pending/i);
  assert.match(response.assistantMessage, /1 where payment is not due yet/i);
  assert.match(response.assistantMessage, /1 with payment canceled/i);
  assert.match(response.assistantMessage, /not a full payment history/i);
  assert.equal(response.actions, undefined);
  assert.equal(
    db.calls.some((call) => call.collection === "invoices"),
    false,
  );
  assert.equal(
    db.calls.some((call) => call.method === "findByID"),
    false,
  );
});

test("signed-out payment overview returns safe handoff without account reads", async () => {
  const route = routeSupportAccountAwareRequest("Did I pay already for any order?");
  assert.equal(route.kind, "payment_overview");

  const { accountContext, db } = makeCtx(null);
  const response = await buildAccountAwareServerResponse({
    route,
    accountContext,
    locale: "en",
    threadId: THREAD_ID,
  });

  assert.equal(response.disposition, "unsupported_account_question");
  assert.equal(response.accountHelperMetadata.deniedReason, "unauthenticated");
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("candidate action click validates token and calls exact helper", async () => {
  const { response, db, accountContext } = await respond("What was my last order?");
  const action = response.actions?.[0];
  assert.ok(action);

  const clickResponse = await buildAccountAwareActionResponse({
    token: action.token,
    threadId: THREAD_ID,
    accountContext,
    locale: "en",
  });

  assert.equal(clickResponse.disposition, "answered");
  assert.equal(
    clickResponse.accountHelperMetadata.helper,
    "getOrderStatusForCurrentUser",
  );
  assert.match(clickResponse.assistantMessage, /awaiting provider confirmation/i);
  assert.match(clickResponse.assistantMessage, /Provider: Provider/i);
  assert.match(clickResponse.assistantMessage, /Status: requested/i);
  assert.match(clickResponse.assistantMessage, /Payment: payment not due/i);
  assert.match(clickResponse.assistantMessage, /Reason: The provider has not confirmed/i);
  assert.equal(
    db.calls.some(
      (call) => call.method === "findByID" && call.collection === "orders",
    ),
    true,
  );
});

test("candidate action token is re-authorized for tenant order access", async () => {
  const token = createAccountCandidateActionToken({
    helper: "getOrderStatusForCurrentUser",
    reference: ORDER_USER_B,
    threadId: THREAD_ID,
  });

  const allowed = await buildAccountAwareActionResponse({
    token,
    threadId: THREAD_ID,
    accountContext: makeCtx("clerk-user-tenant").accountContext,
    locale: "en",
  });
  assert.equal(allowed.disposition, "answered");
  assert.match(allowed.assistantMessage, /customer booking request/i);

  const denied = await buildAccountAwareActionResponse({
    token,
    threadId: THREAD_ID,
    accountContext: makeCtx("clerk-user-a").accountContext,
    locale: "en",
  });
  assert.equal(denied.disposition, "unsupported_account_question");
  assert.equal(denied.accountHelperMetadata.deniedReason, "not_found_or_not_owned");
});

test("candidate actions preserve payment and cancellation intent", async () => {
  const payment = await respond("Did my payment go through?");
  assert.equal(payment.route.kind, "candidate_selection");
  if (payment.route.kind === "candidate_selection") {
    assert.equal(payment.route.selectionHelper, "getPaymentStatusForCurrentUser");
  }
  const paymentAction = payment.response.actions?.[0];
  assert.ok(paymentAction);
  const paymentClick = await buildAccountAwareActionResponse({
    token: paymentAction.token,
    threadId: THREAD_ID,
    accountContext: payment.accountContext,
    locale: "en",
  });
  assert.equal(
    paymentClick.accountHelperMetadata.helper,
    "getPaymentStatusForCurrentUser",
  );
  assert.match(paymentClick.assistantMessage, /not due/i);

  const lastPayment = await respond("What was my last payment?");
  assert.equal(lastPayment.route.kind, "candidate_selection");
  if (lastPayment.route.kind === "candidate_selection") {
    assert.equal(
      lastPayment.route.selectionHelper,
      "getPaymentStatusForCurrentUser",
    );
  }
  assert.equal(
    lastPayment.response.accountHelperMetadata.helper,
    "getSupportOrderCandidatesForCurrentUser",
  );
  assert.match(lastPayment.response.assistantMessage, /Which order do you mean/i);
  assert.equal(lastPayment.response.actions?.[0]?.type, "account_candidate_select");

  const cancel = await respond("Can I cancel my latest booking?");
  assert.equal(cancel.route.kind, "candidate_selection");
  if (cancel.route.kind === "candidate_selection") {
    assert.equal(cancel.route.selectionHelper, "canCancelOrderForCurrentUser");
  }
  const cancelAction = cancel.response.actions?.[0];
  assert.ok(cancelAction);
  const cancelClick = await buildAccountAwareActionResponse({
    token: cancelAction.token,
    threadId: THREAD_ID,
    accountContext: cancel.accountContext,
    locale: "en",
  });
  assert.equal(
    cancelClick.accountHelperMetadata.helper,
    "canCancelOrderForCurrentUser",
  );
  assert.match(cancelClick.assistantMessage, /eligible for in-app cancellation/i);
  assert.doesNotMatch(cancelClick.assistantMessage, /has been canceled/i);
});

test("tampered and wrong-thread action tokens fail safely", async () => {
  const { response, accountContext } = await respond("What was my last order?");
  const action = response.actions?.[0];
  assert.ok(action);

  const tampered = await buildAccountAwareActionResponse({
    token: `${action.token.slice(0, -2)}xx`,
    threadId: THREAD_ID,
    accountContext,
    locale: "en",
  });
  assert.equal(tampered.disposition, "unsupported_account_question");
  assert.match(tampered.assistantMessage, /cannot check live order/i);

  const wrongThread = await buildAccountAwareActionResponse({
    token: action.token,
    threadId: "22222222-2222-4222-8222-222222222222",
    accountContext,
    locale: "en",
  });
  assert.equal(wrongThread.disposition, "unsupported_account_question");
});

test("expired and signed-out candidate action clicks fail safely", async () => {
  const expiredToken = createAccountCandidateActionToken({
    helper: "getOrderStatusForCurrentUser",
    reference: ORDER_REQUESTED_A,
    threadId: THREAD_ID,
    now: new Date(Date.now() - 20 * 60 * 1000),
  });
  const { accountContext } = makeCtx();

  const expired = await buildAccountAwareActionResponse({
    token: expiredToken,
    threadId: THREAD_ID,
    accountContext,
    locale: "en",
  });
  assert.equal(expired.disposition, "unsupported_account_question");

  const { response } = await respond("What was my last order?");
  const action = response.actions?.[0];
  assert.ok(action);
  const signedOut = await buildAccountAwareActionResponse({
    token: action.token,
    threadId: THREAD_ID,
    accountContext: makeCtx(null).accountContext,
    locale: "en",
  });
  assert.equal(signedOut.disposition, "unsupported_account_question");
  assert.equal(signedOut.accountHelperMetadata.deniedReason, "unauthenticated");
});

test("one candidate still asks for the exact order ID", async () => {
  const { db, accountContext } = makeCtx();
  const originalFind = db.find.bind(db);
  db.find = async (args) => {
    const result = await originalFind(args);
    if (args.collection === "orders") {
      return { docs: result.docs.slice(0, 1) };
    }
    return result;
  };

  const route = routeSupportAccountAwareRequest("Can I cancel my latest booking?");
  assert.equal(route.kind, "candidate_selection");
  const response = await buildAccountAwareServerResponse({
    route,
    accountContext,
    locale: "en",
    threadId: THREAD_ID,
  });

  assert.match(response.assistantMessage, /one recent order candidate/i);
  assert.equal(response.actions?.length, 1);
  assert.doesNotMatch(response.assistantMessage, /eligible for in-app cancellation/i);
  assert.doesNotMatch(response.assistantMessage, /reply\s+(1|one)/i);
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
  assert.deepEqual(routeSupportAccountAwareRequest("When do I pay?"), {
    kind: "none",
  });
});
