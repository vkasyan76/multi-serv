import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import type { Booking, Invoice, Order, Tenant } from "@/payload-types";
import {
  buildAccountAwareActionResponse,
  buildAccountAwareServerResponse,
} from "./server-responses";
import { rewriteAccountAwareServerResponse } from "./account-rewrite";
import {
  isSelectedOrderFollowUpMessage,
  routeSupportAccountAwareRequest,
} from "./routing";
import {
  createAccountCandidateActionToken,
  createSelectedOrderContextToken,
  verifySelectedOrderContextToken,
} from "./action-tokens";
import { createSupportTopicContext } from "../topics";
import { getSupportChatCopy } from "../support-chat-copy";

process.env.PAYLOAD_SECRET ??= "support-chat-action-test-secret";
const ORIGINAL_SUPPORT_MODEL = process.env.OPENAI_SUPPORT_CHAT_MODEL;
const ORIGINAL_SUPPORT_MODEL_VERSION =
  process.env.OPENAI_SUPPORT_CHAT_MODEL_VERSION;
const ORIGINAL_OPENAI_API_KEY = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (ORIGINAL_SUPPORT_MODEL === undefined) {
    delete process.env.OPENAI_SUPPORT_CHAT_MODEL;
  } else {
    process.env.OPENAI_SUPPORT_CHAT_MODEL = ORIGINAL_SUPPORT_MODEL;
  }

  if (ORIGINAL_SUPPORT_MODEL_VERSION === undefined) {
    delete process.env.OPENAI_SUPPORT_CHAT_MODEL_VERSION;
  } else {
    process.env.OPENAI_SUPPORT_CHAT_MODEL_VERSION =
      ORIGINAL_SUPPORT_MODEL_VERSION;
  }

  if (ORIGINAL_OPENAI_API_KEY === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_API_KEY;
  }
});

function useSupportModelEnv() {
  process.env.OPENAI_SUPPORT_CHAT_MODEL =
    process.env.OPENAI_SUPPORT_CHAT_MODEL ?? "test-model";
  process.env.OPENAI_SUPPORT_CHAT_MODEL_VERSION =
    process.env.OPENAI_SUPPORT_CHAT_MODEL_VERSION ?? "test-model-version";
}

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
const ORDER_SCHEDULED_NOT_DUE_A = "100000000000000000000010";
const ORDER_DETAIL_A = "100000000000000000000011";
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

function makeCtx(
  userId: string | null = "clerk-user-a",
  options: { extraOrders?: Order[] } = {},
) {
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
        status: "pending",
        serviceStatus: "accepted",
        invoiceStatus: "paid",
        paidAt: "2026-04-21T11:00:00.000Z",
        createdAt: "2026-04-21T09:00:00.000Z",
      }),
    ],
    [
      ORDER_SCHEDULED_NOT_DUE_A,
      order({
        id: ORDER_SCHEDULED_NOT_DUE_A,
        serviceStatus: "scheduled",
        invoiceStatus: "none",
        createdAt: "2026-04-20T09:00:00.000Z",
      }),
    ],
    [
      ORDER_DETAIL_A,
      order({
        id: ORDER_DETAIL_A,
        serviceStatus: "scheduled",
        invoiceStatus: "none",
        vendorSnapshot: {
          tenantName: "react_jedi",
          tenantSlug: "react-jedi",
        },
        lifecycleMode: "detail-test" as never,
        createdAt: "2026-01-10T09:00:00.000Z",
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

  for (const extraOrder of options.extraOrders ?? []) {
    orders.set(extraOrder.id, extraOrder);
  }

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
        assert.ok(args.limit === 10 || args.limit === 15 || args.limit === 50);
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

function assertSupportSafeSnapshots(value: unknown) {
  const forbidden = new Set([
    "amount",
    "currency",
    "customerSnapshot",
    "vendorSnapshot",
    "stripeAccountId",
    "checkoutSessionId",
    "paymentIntentId",
    "destination",
    "slots",
    "user",
    "tenant",
  ]);

  function visit(current: unknown) {
    if (!current || typeof current !== "object") return;
    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }

    for (const [key, nested] of Object.entries(current)) {
      assert.equal(forbidden.has(key), false, key);
      visit(nested);
    }
  }

  visit(value);
}

async function respond(
  message: string,
  userId: string | null = "clerk-user-a",
  locale: "en" | "de" | "fr" | "it" | "es" | "pt" | "pl" | "ro" | "uk" = "en",
  options: { extraOrders?: Order[] } = {},
) {
  const route = routeSupportAccountAwareRequest(message);
  assert.notEqual(route.kind, "none");
  const { db, accountContext } = makeCtx(userId, options);
  const response = await buildAccountAwareServerResponse({
    route: route as Exclude<typeof route, { kind: "none" }>,
    accountContext,
    locale,
    threadId: THREAD_ID,
  });
  return { route, response, db, accountContext };
}

async function respondWithRoute(
  route: Exclude<ReturnType<typeof routeSupportAccountAwareRequest>, { kind: "none" }>,
  userId: string | null = "clerk-user-a",
  locale: "en" | "de" | "fr" | "it" | "es" | "pt" | "pl" | "ro" | "uk" = "en",
  options: { extraOrders?: Order[] } = {},
) {
  const { db, accountContext } = makeCtx(userId, options);
  const response = await buildAccountAwareServerResponse({
    route,
    accountContext,
    locale,
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
  assertSupportSafeSnapshots(response.accountContextSnapshots);
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
  assert.match(byOrder.response.assistantMessage, /booking request/i);
  assert.match(byOrder.response.assistantMessage, /awaiting provider confirmation/i);

  const scheduledNotDue = await respond(
    `Did my payment go through for order ${ORDER_SCHEDULED_NOT_DUE_A}?`,
  );
  assert.equal(scheduledNotDue.response.disposition, "answered");
  assert.match(scheduledNotDue.response.assistantMessage, /no invoice has been issued/i);
  assert.match(scheduledNotDue.response.assistantMessage, /scheduled booking/i);
  assert.match(scheduledNotDue.response.assistantMessage, /invoice\/payment step/i);

  const byInvoice = await respond(`What is invoice ${INVOICE_A} status?`);
  assert.equal(byInvoice.route.kind, "helper");
  if (byInvoice.route.kind === "helper") {
    assert.equal(byInvoice.route.input.referenceType, "invoice_id");
  }
  assert.equal(byInvoice.response.disposition, "answered");
  assert.match(byInvoice.response.assistantMessage, /payment is pending/i);

  const paidByOrder = await respond(
    `Did my payment go through for order ${ORDER_PAID_A}?`,
  );
  assert.equal(paidByOrder.response.disposition, "answered");
  assert.match(paidByOrder.response.assistantMessage, /payment is marked paid/i);
  assert.doesNotMatch(paidByOrder.response.assistantMessage, /not due/i);

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
  assert.match(response.assistantMessage, /limited support-safe/i);
});

test("signed-out candidate-selection account request returns safe handoff", async () => {
  const { accountContext, db } = makeCtx(null);
  const response = await buildAccountAwareServerResponse({
    route: {
      kind: "candidate_selection",
      selectionHelper: "getOrderStatusForCurrentUser",
    },
    accountContext,
    locale: "en",
    threadId: THREAD_ID,
  });

  assert.equal(response.disposition, "unsupported_account_question");
  assert.equal(response.needsHumanSupport, true);
  assert.equal(response.accountHelperMetadata.deniedReason, "unauthenticated");
  assert.equal(response.accountHelperMetadata.authenticated, false);
  assert.equal(response.accountHelperMetadata.requiredInputPresent, false);
  assert.match(response.assistantMessage, /limited support-safe/i);
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

test("natural account lookup prompts no longer route directly without triage", () => {
  for (const prompt of [
    "Show my canceled orders",
    "Which orders are scheduled?",
    "Show unpaid bookings",
    "Which bookings are awaiting confirmation?",
    "Show my completed bookings",
    "Show my paid orders",
    "Which of my bookings can I cancel?",
    "Welche meiner Buchungen kann ich stornieren?",
    "Check the order with this provider from last week",
    "Have I paid for anything?",
    "Do I have unpaid orders?",
    "Did I pay already for any order?",
    "Habe ich schon eine Buchung bezahlt?",
  ]) {
    assert.equal(routeSupportAccountAwareRequest(prompt).kind, "none", prompt);
  }
});

test("general cancellation help does not route to account candidates", () => {
  for (const prompt of [
    "Ich brauche Hilfe beim Stornieren einer Buchung.",
    "Wie funktioniert Stornierung?",
    "Can a booking be canceled?",
    "What happens when a booking is canceled?",
    "schon geplant",
  ]) {
    assert.equal(routeSupportAccountAwareRequest(prompt).kind, "none", prompt);
  }
});

test("direct cancellation mutation commands do not route to candidate lookup", () => {
  for (const prompt of [
    "Cancel my booking now.",
    "Storniere meine Buchung jetzt.",
  ]) {
    assert.equal(routeSupportAccountAwareRequest(prompt).kind, "none", prompt);
  }
});

test("paid-order lookup prompts do not bypass triage", () => {
  const prompts = [
    "Did I pay already for any order?",
    "Have I paid for any booking?",
    "Any paid orders?",
    "Which orders have I paid?",
    "Habe ich schon eine Buchung bezahlt?",
    "Ai-je deja paye des commandes ?",
    "Ho già pagato qualche ordine?",
    "Ho gia pagato ordini?",
    "Ya he pagado pedidos?",
    "Ja paguei pedidos?",
    "Czy zaplacilem za zamowienia?",
    "Am platit comenzi?",
  ];

  for (const prompt of prompts) {
    assert.equal(routeSupportAccountAwareRequest(prompt).kind, "none", prompt);
  }
});

test("payment overview prompts do not bypass triage across launched locales", () => {
  const prompts = [
    "Did I pay already for any order?",
    "Do I have unpaid orders?",
    "Habe ich schon eine Buchung bezahlt?",
    "Habe ich unbezahlte Buchungen?",
    "Ai-je déjà payé une commande ?",
    "Ai-je déjà payé des commandes ?",
    "Ai-je des réservations impayées ?",
    "Ho già pagato qualche ordine?",
    "Ho già pagato ordini?",
    "Ho prenotazioni non pagate?",
    "Tengo pedidos sin pagar?",
    "¿Ya he pagado pedidos?",
    "¿Tengo pedidos sin pagar?",
    "Já paguei algum pedido?",
    "Já paguei pedidos?",
    "Tenho reservas por pagar?",
    "Czy zapłaciłem już za jakieś zamówienie?",
    "Czy zapłaciłem już za zamówienia?",
    "Czy mam nieopłacone rezerwacje?",
    "Am plătit deja vreo comandă?",
    "Am plătit comenzi?",
    "Am comenzi neplătite?",
    "Чи я вже оплатив якесь замовлення?",
    "Чи маю неоплачені бронювання?",
  ];

  for (const prompt of prompts) {
    assert.equal(routeSupportAccountAwareRequest(prompt).kind, "none", prompt);
  }
});

function routeSummary(route: ReturnType<typeof routeSupportAccountAwareRequest>) {
  if (route.kind === "helper") return `helper:${route.helper}`;
  if (route.kind === "candidate_selection") {
    return `candidate_selection:${route.statusFilter ?? ""}`;
  }
  return route.kind;
}

test("exact account helper prompts route across launched locales", () => {
  const cases = [
    [
      "order",
      "helper:getOrderStatusForCurrentUser",
      [
        `What is my order status ${ORDER_REQUESTED_A}?`,
        `Wie ist der Status meiner Bestellung ${ORDER_REQUESTED_A}?`,
        `Quel est le statut de ma commande ${ORDER_REQUESTED_A} ?`,
        `Qual è lo stato del mio ordine ${ORDER_REQUESTED_A}?`,
        `¿Cuál es el estado de mi pedido ${ORDER_REQUESTED_A}?`,
        `Qual é o estado do meu pedido ${ORDER_REQUESTED_A}?`,
        `Jaki jest status mojego zamówienia ${ORDER_REQUESTED_A}?`,
        `Care este statusul comenzii mele ${ORDER_REQUESTED_A}?`,
        `Який статус мого замовлення ${ORDER_REQUESTED_A}?`,
      ],
    ],
    [
      "payment",
      "helper:getPaymentStatusForCurrentUser",
      [
        `Payment status for order ${ORDER_REQUESTED_A}`,
        `Wie ist der Zahlungsstatus für Bestellung ${ORDER_REQUESTED_A}?`,
        `Quel est le statut du paiement pour la commande ${ORDER_REQUESTED_A} ?`,
        `Qual è lo stato del pagamento per l'ordine ${ORDER_REQUESTED_A}?`,
        `¿Cuál es el estado del pago del pedido ${ORDER_REQUESTED_A}?`,
        `Qual é o estado do pagamento do pedido ${ORDER_REQUESTED_A}?`,
        `Jaki jest status płatności za zamówienie ${ORDER_REQUESTED_A}?`,
        `Care este statusul plății pentru comanda ${ORDER_REQUESTED_A}?`,
        `Який статус оплати замовлення ${ORDER_REQUESTED_A}?`,
      ],
    ],
    [
      "cancel",
      "helper:canCancelOrderForCurrentUser",
      [
        `Can I cancel order ${ORDER_REQUESTED_A}?`,
        `Kann ich Buchung ${ORDER_REQUESTED_A} stornieren?`,
        `Puis-je annuler la réservation ${ORDER_REQUESTED_A} ?`,
        `Posso annullare la prenotazione ${ORDER_REQUESTED_A}?`,
        `¿Puedo cancelar la reserva ${ORDER_REQUESTED_A}?`,
        `Posso cancelar a reserva ${ORDER_REQUESTED_A}?`,
        `Czy mogę anulować rezerwację ${ORDER_REQUESTED_A}?`,
        `Pot anula rezervarea ${ORDER_REQUESTED_A}?`,
        `Чи можу я скасувати бронювання ${ORDER_REQUESTED_A}?`,
      ],
    ],
  ] as const;

  for (const [label, expected, prompts] of cases) {
    for (const prompt of prompts) {
      assert.equal(routeSummary(routeSupportAccountAwareRequest(prompt)), expected, `${label}: ${prompt}`);
    }
  }
});

test("status-filtered candidate prompts do not bypass triage across launched locales", () => {
  const cases = [
    ["scheduled", "candidate_selection:scheduled", [
      "Which orders are scheduled?",
      "Welche Buchungen sind geplant?",
      "Quelles réservations sont programmées ?",
      "Quali prenotazioni sono programmate?",
      "¿Qué pedidos están programados?",
      "Quais reservas estão agendadas?",
      "Które rezerwacje są zaplanowane?",
      "Ce rezervări sunt programate?",
      "Які бронювання заплановані?",
    ]],
    ["canceled", "candidate_selection:canceled", [
      "Show my canceled orders",
      "Zeige meine stornierten Buchungen",
      "Afficher mes réservations annulées",
      "Mostra le mie prenotazioni annullate",
      "Mostrar mis pedidos cancelados",
      "Mostrar minhas reservas canceladas",
      "Pokaż moje anulowane rezerwacje",
      "Arată rezervările anulate",
      "Показати мої скасовані бронювання",
    ]],
    ["unpaid", "candidate_selection:payment_pending", [
      "Show unpaid bookings",
      "Zeige unbezahlte Buchungen",
      "Afficher les réservations impayées",
      "Mostra prenotazioni non pagate",
      "Mostrar reservas sin pagar",
      "Mostrar reservas por pagar",
      "Pokaż nieopłacone rezerwacje",
      "Arată rezervările neplătite",
      "Показати неоплачені бронювання",
    ]],
  ] as const;

  for (const [label, , prompts] of cases) {
    for (const prompt of prompts) {
      assert.equal(routeSummary(routeSupportAccountAwareRequest(prompt)), "none", `${label}: ${prompt}`);
    }
  }
});

test("broad account blockers route across launched locales", () => {
  for (const prompt of [
    "Show all my orders",
    "Zeige alle meine Buchungen",
    "Afficher toutes mes commandes",
    "Mostra tutti i miei ordini",
    "Mostrar todos mis pedidos",
    "Mostrar todos os meus pedidos",
    "Pokaż wszystkie moje zamówienia",
    "Arată toate comenzile mele",
    "Показати всі мої замовлення",
  ]) {
    assert.equal(routeSummary(routeSupportAccountAwareRequest(prompt)), "broad_or_deferred", prompt);
  }
});

test("selected-order follow-ups route across launched locales", () => {
  const selected = { referenceType: "order_id" as const, reference: ORDER_REQUESTED_A };
  const cases = [
    ["payment", "helper:getPaymentStatusForCurrentUser", [
      "What about payment?",
      "Was ist mit der Zahlung?",
      "Et le paiement ?",
      "E il pagamento?",
      "¿Y el pago?",
      "E o pagamento?",
      "A płatność?",
      "Dar plata?",
      "А що з оплатою?",
    ]],
    ["status", "helper:getOrderStatusForCurrentUser", [
      "What is its status?",
      "Wie ist der Status?",
      "Quel est son statut ?",
      "Qual è il suo stato?",
      "¿Cuál es su estado?",
      "Qual é o estado?",
      "Jaki jest status?",
      "Care este statusul?",
      "Який статус?",
    ]],
    ["details", "helper:getOrderStatusForCurrentUser", [
      "Who is the provider for this booking?",
      "Wer ist der Dienstleister für diese Buchung?",
      "Qui est le prestataire pour cette réservation ?",
      "Chi è il fornitore per questa prenotazione?",
      "¿Quién es el proveedor de esta reserva?",
      "Quem é o prestador desta reserva?",
      "Kto jest usługodawcą dla tej rezerwacji?",
      "Cine este prestatorul pentru această rezervare?",
      "Хто постачальник для цього бронювання?",
    ]],
    ["cancel", "helper:canCancelOrderForCurrentUser", [
      "Can I cancel it?",
      "Kann ich sie stornieren?",
      "Puis-je l’annuler ?",
      "Posso annullarla?",
      "¿Puedo cancelarlo?",
      "Posso cancelá-la?",
      "Czy mogę ją anulować?",
      "Pot să o anulez?",
      "Чи можу я його скасувати?",
    ]],
  ] as const;

  for (const [label, expected, prompts] of cases) {
    for (const prompt of prompts) {
      assert.equal(
        routeSummary(routeSupportAccountAwareRequest(prompt, { selectedOrder: selected })),
        expected,
        `${label}: ${prompt}`,
      );
    }
  }
});

test("tenant awaiting-confirmation prompts do not bypass triage across launched locales", () => {
  for (const prompt of [
    "Which bookings are awaiting confirmation?",
    "Welche Buchungen warten auf Bestätigung?",
    "Quelles réservations attendent une confirmation ?",
    "Quali prenotazioni attendono conferma?",
    "¿Qué reservas esperan confirmación?",
    "Quais reservas aguardam confirmação?",
    "Które rezerwacje czekają na potwierdzenie?",
    "Ce rezervări așteaptă confirmarea?",
    "Які бронювання очікують підтвердження?",
  ]) {
    assert.equal(
      routeSummary(routeSupportAccountAwareRequest(prompt)),
      "none",
      prompt,
    );
  }
});

test("localized policy-only status questions stay out of account routing", () => {
  for (const prompt of [
    "What do booking statuses mean?",
    "Que signifient les statuts de réservation ?",
    "¿Qué significan los estados de reserva?",
  ]) {
    assert.equal(routeSupportAccountAwareRequest(prompt).kind, "none", prompt);
  }
});

test("generic cancellation prompts do not route to order cancellation helper", () => {
  for (const prompt of [
    "Can I cancel my account?",
    "Can I cancel my subscription?",
  ]) {
    assert.equal(routeSupportAccountAwareRequest(prompt).kind, "none", prompt);
  }
});

test("generic history and export prompts do not route to account broad blocker", () => {
  for (const prompt of [
    "What is the history of your platform?",
    "Can I export this chat?",
  ]) {
    assert.equal(routeSupportAccountAwareRequest(prompt).kind, "none", prompt);
  }
});

test("vague account prompts do not bypass triage", () => {
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
      "none",
      prompt,
    );
  }
});

test("candidate selection returns clickable actions without exact helper calls", async () => {
  const { route, response, db } = await respondWithRoute({
    kind: "candidate_selection",
    selectionHelper: "getOrderStatusForCurrentUser",
  });

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
  assertSupportSafeSnapshots(response.accountContextSnapshots);
  assert.doesNotMatch(response.actions?.[0]?.token ?? "", new RegExp(ORDER_REQUESTED_A));
  assert.doesNotMatch(response.assistantMessage, /your last order is/i);
  assert.doesNotMatch(response.assistantMessage, /reply\s+(1|one)/i);
  assert.equal(
    db.calls.some((call) => call.method === "findByID"),
    false,
  );
});

test("filtered candidate selection returns bounded customer candidates", async () => {
  const { route, response, db } = await respondWithRoute({
    kind: "candidate_selection",
    selectionHelper: "getOrderStatusForCurrentUser",
    statusFilter: "canceled",
  });

  assert.equal(route.kind, "candidate_selection");
  if (route.kind === "candidate_selection") {
    assert.equal(route.statusFilter, "canceled");
  }
  assert.equal(response.disposition, "uncertain");
  assert.equal(
    response.accountHelperMetadata.helper,
    "getSupportOrderCandidatesForCurrentUser",
  );
  assert.match(response.assistantMessage, /recent canceled booking that may match/i);
  assert.equal(response.actions?.length, 1);
  assert.match(response.actions?.[0]?.description ?? "", /canceled/i);
  assert.equal(
    db.calls.some((call) => call.method === "findByID" && call.collection === "orders"),
    false,
  );
});

test("filtered candidate selection returns tenant-owned candidates", async () => {
  const { route, response } = await respondWithRoute(
    {
      kind: "candidate_selection",
      selectionHelper: "getOrderStatusForCurrentUser",
      statusFilter: "requested",
    },
    "clerk-user-tenant",
  );

  assert.equal(route.kind, "candidate_selection");
  if (route.kind === "candidate_selection") {
    assert.equal(route.statusFilter, "requested");
  }
  assert.equal(response.disposition, "uncertain");
  assert.match(response.assistantMessage, /recent requested bookings that may match/i);
  assert.equal(response.actions?.length, 2);
  assert.doesNotMatch(
    JSON.stringify(response.actions),
    new RegExp(ORDER_OTHER_TENANT),
  );
});

test("empty filtered candidate selection stays bounded and deterministic", async () => {
  const { response } = await respondWithRoute(
    {
      kind: "candidate_selection",
      selectionHelper: "getPaymentStatusForCurrentUser",
      statusFilter: "paid",
    },
    "clerk-user-other-tenant",
  );

  assert.equal(response.disposition, "answered");
  assert.match(response.assistantMessage, /could not find recent paid bookings/i);
  assert.match(response.assistantMessage, /not a full history check/i);
  assert.equal(response.actions?.length, 0);
  assert.equal(response.accountContextSnapshots?.[0]?.orders.length, 0);
  assert.equal(response.accountContextSnapshots?.[0]?.statusFilter, "paid");
});

test("paid candidate click answers paid status from invoice cache", async () => {
  const { route, response, accountContext, db } = await respondWithRoute({
    kind: "candidate_selection",
    selectionHelper: "getPaymentStatusForCurrentUser",
    statusFilter: "paid",
  });

  assert.equal(route.kind, "candidate_selection");
  if (route.kind === "candidate_selection") {
    assert.equal(route.statusFilter, "paid");
    assert.equal(route.selectionHelper, "getPaymentStatusForCurrentUser");
  }
  assert.equal(response.actions?.length, 1);
  assert.match(response.actions?.[0]?.description ?? "", /invoice paid/i);
  assert.equal(
    db.calls.find((call) => call.collection === "orders")?.limit,
    50,
  );

  const click = await buildAccountAwareActionResponse({
    token: response.actions?.[0]?.token ?? "",
    threadId: THREAD_ID,
    accountContext,
    locale: "en",
  });

  assert.equal(click.disposition, "answered");
  assert.equal(click.accountHelperMetadata.helper, "getPaymentStatusForCurrentUser");
  assert.match(click.assistantMessage, /payment is marked paid/i);
  assert.doesNotMatch(click.assistantMessage, /not due/i);
});

test("paid candidate lookup finds paid orders outside the old recent window", async () => {
  const newerUnpaidOrders = Array.from({ length: 16 }, (_, index) =>
    order({
      id: `10000000000000000000${(0x100 + index).toString(16).padStart(4, "0")}`,
      serviceStatus: "scheduled",
      invoiceStatus: "none",
      createdAt: `2026-04-22T${String(index).padStart(2, "0")}:00:00.000Z`,
    }),
  );

  const { route, response, db } = await respondWithRoute(
    {
      kind: "candidate_selection",
      selectionHelper: "getPaymentStatusForCurrentUser",
      statusFilter: "paid",
    },
    "clerk-user-a",
    "en",
    { extraOrders: newerUnpaidOrders },
  );

  assert.equal(route.kind, "candidate_selection");
  if (route.kind === "candidate_selection") {
    assert.equal(route.selectionHelper, "getPaymentStatusForCurrentUser");
    assert.equal(route.statusFilter, "paid");
  }
  assert.equal(
    db.calls.find((call) => call.collection === "orders")?.limit,
    50,
  );
  assert.ok(response.actions?.length);
  assert.match(response.actions?.[0]?.id ?? "", /getPaymentStatusForCurrentUser/);
  assert.match(response.actions?.[0]?.description ?? "", /invoice paid/i);
});

test("payment overview returns bounded deterministic summary", async () => {
  const { route, response, db } = await respondWithRoute({
    kind: "payment_overview",
  });

  assert.equal(route.kind, "payment_overview");
  assert.equal(response.disposition, "answered");
  assert.equal(response.needsHumanSupport, false);
  assert.equal(
    response.accountHelperMetadata.helper,
    "getSupportPaymentOverviewForCurrentUser",
  );
  assert.equal(response.accountHelperMetadata.resultCategory, "payment_overview");
  assert.match(response.assistantMessage, /recent support-safe order window/i);
  assert.match(response.assistantMessage, /1 paid order/i);
  assert.match(response.assistantMessage, /1 with payment pending/i);
  assert.match(response.assistantMessage, /2 where payment is not due yet/i);
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

test("Spanish payment overview returns localized deterministic summary", async () => {
  const { route, response } = await respondWithRoute(
    { kind: "payment_overview" },
    "clerk-user-a",
    "es",
  );

  assert.equal(route.kind, "payment_overview");
  assert.equal(response.disposition, "answered");
  assert.equal(
    response.accountHelperMetadata.helper,
    "getSupportPaymentOverviewForCurrentUser",
  );
  assert.equal(response.accountHelperMetadata.resultCategory, "payment_overview");
  assert.match(response.assistantMessage, /pedidos recientes/i);
  assert.match(response.assistantMessage, /historial completo de pagos/i);
  assert.doesNotMatch(response.assistantMessage, /No puedo ver tu cuenta/i);
});

test("signed-out payment overview returns safe handoff without account reads", async () => {
  const { accountContext, db } = makeCtx(null);
  const response = await buildAccountAwareServerResponse({
    route: { kind: "payment_overview" },
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
  const { response, db, accountContext } = await respondWithRoute({
    kind: "candidate_selection",
    selectionHelper: "getOrderStatusForCurrentUser",
  });
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
  assert.equal(clickResponse.selectedOrderContext?.type, "selected_order");
  assert.ok(clickResponse.selectedOrderContext?.token);
  assert.doesNotMatch(
    clickResponse.selectedOrderContext?.token ?? "",
    new RegExp(ORDER_REQUESTED_A),
  );
  assert.equal(
    db.calls.some(
      (call) => call.method === "findByID" && call.collection === "orders",
    ),
    true,
  );
});

test("topic cancellation follow-up escalates to scheduled cancellation candidates with personal booking intent", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "meine geplante Buchung",
    threadId: THREAD_ID,
    locale: "de",
    accountContext,
    supportTopicContext: createSupportTopicContext({
      topic: "cancellation",
      source: "starter_prompt",
    }),
  });

  assert.equal(response.disposition, "uncertain");
  assert.equal(
    response.accountHelperMetadata?.helper,
    "getSupportOrderCandidatesForCurrentUser",
  );
  assert.equal(response.supportTopic?.topic, "cancellation");
  assert.equal(response.supportTopic?.source, "follow_up");
  assert.ok(response.supportTopicContext);
  assert.ok(response.actions?.length);
  assert.match(response.actions?.[0]?.id ?? "", /canCancelOrderForCurrentUser/);
  assert.doesNotMatch(response.assistantMessage, /недостатньо інформації/i);
  assert.ok(
    db.calls.some(
      (call) => call.method === "find" && call.collection === "orders",
    ),
  );
});

test("topic cancellation follow-up fallback handles personal cancellation lookup without status filter", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "Gibt es bei mir noch Buchungen die ich stornieren kann?",
    threadId: THREAD_ID,
    locale: "de",
    accountContext,
    supportTopicContext: createSupportTopicContext({
      topic: "cancellation",
      source: "starter_prompt",
    }),
  });

  assert.equal(response.disposition, "uncertain");
  assert.equal(
    response.accountHelperMetadata?.helper,
    "getSupportOrderCandidatesForCurrentUser",
  );
  assert.equal(response.supportTopic?.topic, "cancellation");
  assert.ok(response.actions?.length);
  assert.match(response.actions?.[0]?.id ?? "", /canCancelOrderForCurrentUser/);
  assert.ok(
    db.calls.some(
      (call) => call.method === "find" && call.collection === "orders",
    ),
  );
});

test("French cancellation topic follow-up routes to cancellable candidates", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "Quelles réservations puis-je annuler ?",
    threadId: THREAD_ID,
    locale: "fr",
    accountContext,
    supportTopicContext: createSupportTopicContext({
      topic: "cancellation",
      source: "starter_prompt",
    }),
  });

  assert.equal(response.disposition, "uncertain");
  assert.equal(
    response.accountHelperMetadata?.helper,
    "getSupportOrderCandidatesForCurrentUser",
  );
  assert.equal(response.supportTopic?.topic, "cancellation");
  assert.ok(response.actions?.length);
  assert.match(response.actions?.[0]?.id ?? "", /canCancelOrderForCurrentUser/);
  assert.ok(
    db.calls.some(
      (call) => call.method === "find" && call.collection === "orders",
    ),
  );
});

test("intent triage routes typoed scheduled booking follow-ups through eligibility", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "Meine Buchung ist geplant.",
    threadId: THREAD_ID,
    locale: "de",
    accountContext,
    intentTriageOverride: {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "scheduled",
      confidence: "high",
    },
  });

  assert.equal(response.disposition, "uncertain");
  assert.equal(response.triage?.intent, "account_candidate_lookup");
  assert.equal(response.triage?.topic, "booking");
  assert.equal(response.triage?.statusFilter, "scheduled");
  assert.equal(response.triageMappedHelper, "getOrderStatusForCurrentUser");
  assert.equal(response.triageEligibilityAllowed, true);
  assert.equal(response.triageEligibilityReason, undefined);
  assert.equal(
    response.accountHelperMetadata?.helper,
    "getSupportOrderCandidatesForCurrentUser",
  );
  assert.ok(response.actions?.length);
  assert.ok(
    db.calls.some(
      (call) => call.method === "find" && call.collection === "orders",
    ),
  );
});

test("intent triage maps high-confidence candidate lookups to allowed helpers", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");

  const cases: Array<{
    message: string;
    locale: "en" | "fr";
    triage: {
      intent: "account_candidate_lookup";
      topic: "booking" | "payment" | "cancellation";
      statusFilter:
        | "requested"
        | "scheduled"
        | "canceled"
        | "paid"
        | "payment_pending"
        | "payment_not_due";
      confidence: "high";
    };
    mappedHelper:
      | "getOrderStatusForCurrentUser"
      | "getPaymentStatusForCurrentUser"
      | "canCancelOrderForCurrentUser";
    actionHelper:
      | "getOrderStatusForCurrentUser"
      | "getPaymentStatusForCurrentUser"
      | "canCancelOrderForCurrentUser";
  }> = [
    {
      message: "reservation anuler typo maybe",
      locale: "fr" as const,
      triage: {
        intent: "account_candidate_lookup" as const,
        topic: "cancellation" as const,
        statusFilter: "scheduled" as const,
        confidence: "high" as const,
      },
      mappedHelper: "canCancelOrderForCurrentUser",
      actionHelper: "canCancelOrderForCurrentUser",
    },
    {
      message: "paymnt paid thing maybe",
      locale: "en" as const,
      triage: {
        intent: "account_candidate_lookup" as const,
        topic: "payment" as const,
        statusFilter: "paid" as const,
        confidence: "high" as const,
      },
      mappedHelper: "getPaymentStatusForCurrentUser",
      actionHelper: "getPaymentStatusForCurrentUser",
    },
    {
      message: "bookng requested thing maybe",
      locale: "en" as const,
      triage: {
        intent: "account_candidate_lookup" as const,
        topic: "booking" as const,
        statusFilter: "requested" as const,
        confidence: "high" as const,
      },
      mappedHelper: "getOrderStatusForCurrentUser",
      actionHelper: "getOrderStatusForCurrentUser",
    },
  ];

  for (const item of cases) {
    const { db, accountContext } = makeCtx("clerk-user-a");
    const response = await generateSupportResponse({
      message: item.message,
      threadId: THREAD_ID,
      locale: item.locale,
      accountContext,
      supportTopicContext: createSupportTopicContext({
        topic: item.triage.topic,
        source: "starter_prompt",
      }),
      intentTriageOverride: item.triage,
    });

    assert.equal(response.triage?.intent, "account_candidate_lookup", item.message);
    assert.equal(response.triage?.topic, item.triage.topic, item.message);
    assert.equal(
      response.triage?.statusFilter,
      item.triage.statusFilter,
      item.message,
    );
    assert.equal(response.triageMappedHelper, item.mappedHelper, item.message);
    assert.equal(response.triageEligibilityAllowed, true, item.message);
    assert.equal(response.triageEligibilityReason, undefined, item.message);
    assert.equal(
      response.accountHelperMetadata?.helper,
      "getSupportOrderCandidatesForCurrentUser",
      item.message,
    );
    assert.match(
      response.actions?.[0]?.id ?? "",
      new RegExp(item.actionHelper),
      item.message,
    );
    assert.ok(
      db.calls.some(
        (call) => call.method === "find" && call.collection === "orders",
      ),
      item.message,
    );
  }
});

test("intent triage cannot invent unsupported helper mappings or filters", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "Which of my bookings are already paid?",
    threadId: THREAD_ID,
    locale: "en",
    accountContext,
    conversationMemory: {
      previousUserMessage: "I need help with a booking.",
      previousAssistantMessage: "Which booking do you mean?",
      activeTopic: "booking",
      hasSelectedOrderContext: false,
      lastAssistantAskedForSelection: false,
    },
    intentTriageOverride: {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "paid",
      confidence: "high",
      reason: "Invalid model-selected booking/payment combination.",
    },
  });

  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(response.triageEligibilityAllowed, false);
  assert.equal(response.triageEligibilityReason, "no_allowed_mapping");
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("intent triage model failure falls back without account helper execution", async () => {
  useSupportModelEnv();
  delete process.env.OPENAI_API_KEY;
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "Meine Buchung ist geplant.",
    threadId: THREAD_ID,
    locale: "de",
    accountContext,
    conversationMemory: {
      previousUserMessage: "Ich brauche Hilfe mit einer Buchung.",
      previousAssistantMessage: "Welche Buchung meinst du?",
      activeTopic: "booking",
      hasSelectedOrderContext: false,
      lastAssistantAskedForSelection: false,
    },
  });

  assert.equal(response.triage, undefined);
  assert.equal(response.triageMappedHelper, undefined);
  assert.equal(response.triageEligibilityAllowed, undefined);
  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("intent triage does not route unsupported provider account lookup to helpers", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "thing maybe",
    threadId: THREAD_ID,
    locale: "en",
    accountContext,
    supportTopicContext: createSupportTopicContext({
      topic: "provider_onboarding",
      source: "starter_prompt",
    }),
    intentTriageOverride: {
      intent: "account_candidate_lookup",
      topic: "provider_onboarding",
      confidence: "high",
    },
  });

  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(response.triageEligibilityAllowed, false);
  assert.equal(response.triageEligibilityReason, "unsupported_topic");
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("intent triage cannot route account helpers without account context", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const response = await generateSupportResponse({
    message: "thing maybe",
    threadId: THREAD_ID,
    locale: "en",
    supportTopicContext: createSupportTopicContext({
      topic: "cancellation",
      source: "starter_prompt",
    }),
    intentTriageOverride: {
      intent: "account_candidate_lookup",
      topic: "cancellation",
      confidence: "high",
    },
  });

  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(response.triageEligibilityAllowed, undefined);
  assert.equal(response.triageEligibilityReason, undefined);
});

test("intent triage denies helper routing for signed-out account context", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx(null);
  const response = await generateSupportResponse({
    message: "Meine Buchung ist geplant.",
    threadId: THREAD_ID,
    locale: "de",
    accountContext,
    conversationMemory: {
      previousUserMessage: "Ich brauche Hilfe mit einer Buchung.",
      previousAssistantMessage: "Welche Buchung meinst du?",
      activeTopic: "booking",
      hasSelectedOrderContext: false,
      lastAssistantAskedForSelection: false,
    },
    intentTriageOverride: {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "scheduled",
      confidence: "high",
    },
  });

  assert.equal(response.disposition, "unsupported_account_question");
  assert.equal(response.triageEligibilityAllowed, false);
  assert.equal(response.triageEligibilityReason, "not_signed_in");
  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("intent triage asks for clarification on low confidence instead of support handoff", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "storno thing maybe",
    threadId: THREAD_ID,
    locale: "en",
    accountContext,
    intentTriageOverride: {
      intent: "account_candidate_lookup",
      topic: "cancellation",
      confidence: "low",
    },
  });

  assert.equal(response.disposition, "uncertain");
  assert.equal(response.needsHumanSupport, false);
  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(response.triageEligibilityAllowed, false);
  assert.equal(response.triageEligibilityReason, "low_confidence");
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("intent triage unsafe mutation returns no-action boundary copy", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "Cancel this booking now",
    threadId: THREAD_ID,
    locale: "en",
    accountContext,
    intentTriageOverride: {
      intent: "unsafe_mutation",
      topic: "cancellation",
      confidence: "high",
    },
  });

  assert.equal(response.disposition, "unsupported_account_question");
  assert.equal(
    response.assistantMessage,
    getSupportChatCopy("en").serverMessages.unsafeActionBlocked,
  );
  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(response.triageEligibilityAllowed, false);
  assert.equal(response.triageEligibilityReason, "unsafe_mutation");
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("intent triage routes selected-order follow-up typos to exact helpers", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { accountContext } = makeCtx("clerk-user-a");
  const token = createSelectedOrderContextToken({
    reference: ORDER_SCHEDULED_A,
    threadId: THREAD_ID,
  });
  const response = await generateSupportResponse({
    message: "was mit zahlun?",
    threadId: THREAD_ID,
    locale: "de",
    accountContext,
    selectedOrderContext: {
      type: "selected_order",
      token,
    },
    intentTriageOverride: {
      intent: "selected_order_follow_up",
      topic: "payment",
      confidence: "high",
    },
  });

  assert.equal(response.triage?.intent, "selected_order_follow_up");
  assert.equal(response.triage?.topic, "payment");
  assert.equal(response.triageMappedHelper, "getPaymentStatusForCurrentUser");
  assert.equal(response.triageEligibilityAllowed, true);
  assert.equal(response.triageEligibilityReason, undefined);
  assert.equal(
    response.accountHelperMetadata?.helper,
    "getPaymentStatusForCurrentUser",
  );
  assert.equal(response.actions, undefined);
});

test("intent triage fails closed for unsupported selected-order follow-up topics", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const token = createSelectedOrderContextToken({
    reference: ORDER_SCHEDULED_A,
    threadId: THREAD_ID,
  });
  const response = await generateSupportResponse({
    message: "help with provider onboarding for this",
    threadId: THREAD_ID,
    locale: "en",
    accountContext,
    selectedOrderContext: {
      type: "selected_order",
      token,
    },
    intentTriageOverride: {
      intent: "selected_order_follow_up",
      topic: "provider_onboarding",
      confidence: "high",
    },
  });

  assert.equal(response.triage?.intent, "selected_order_follow_up");
  assert.equal(response.triage?.topic, "provider_onboarding");
  assert.equal(response.triageEligibilityAllowed, false);
  assert.equal(response.triageEligibilityReason, "unsupported_topic");
  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("intent triage fails closed for missing selected-order follow-up topic", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const token = createSelectedOrderContextToken({
    reference: ORDER_SCHEDULED_A,
    threadId: THREAD_ID,
  });
  const response = await generateSupportResponse({
    message: "help with this selected item",
    threadId: THREAD_ID,
    locale: "en",
    accountContext,
    selectedOrderContext: {
      type: "selected_order",
      token,
    },
    intentTriageOverride: {
      intent: "selected_order_follow_up",
      confidence: "high",
    },
  });

  assert.equal(response.triage?.intent, "selected_order_follow_up");
  assert.equal(response.triageEligibilityAllowed, false);
  assert.equal(response.triageEligibilityReason, "unsupported_topic");
  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("intent triage requires selected-order context for selected-order follow-ups", async () => {
  useSupportModelEnv();
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const response = await generateSupportResponse({
    message: "was mit zahlun?",
    threadId: THREAD_ID,
    locale: "de",
    accountContext,
    conversationMemory: {
      previousUserMessage: "Gib mir meine letzte Buchungen",
      previousAssistantMessage: "Welche Bestellung meinst du?",
      hasSelectedOrderContext: true,
      lastAssistantAskedForSelection: false,
    },
    intentTriageOverride: {
      intent: "selected_order_follow_up",
      topic: "payment",
      confidence: "high",
    },
  });

  assert.equal(response.triage?.intent, "selected_order_follow_up");
  assert.equal(response.triageEligibilityAllowed, false);
  assert.equal(response.triageEligibilityReason, "missing_selected_order");
  assert.equal(response.accountHelperMetadata, undefined);
  assert.equal(response.actions, undefined);
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("selected order context routes follow-up questions to exact helpers", () => {
  const selected = { referenceType: "order_id" as const, reference: ORDER_SCHEDULED_A };

  for (const prompt of ["Did I pay already?", "Have I paid?"]) {
    const route = routeSupportAccountAwareRequest(prompt, {
      selectedOrder: selected,
    });
    assert.equal(route.kind, "helper", prompt);
    if (route.kind === "helper") {
      assert.equal(route.helper, "getPaymentStatusForCurrentUser", prompt);
      assert.deepEqual(route.input, selected, prompt);
    }
  }

  const payment = routeSupportAccountAwareRequest(
    "Why is payment not due for this order yet?",
    { selectedOrder: selected },
  );
  assert.equal(payment.kind, "helper");
  if (payment.kind === "helper") {
    assert.equal(payment.helper, "getPaymentStatusForCurrentUser");
    assert.deepEqual(payment.input, selected);
  }

  const cancel = routeSupportAccountAwareRequest("Can I cancel it?", {
    selectedOrder: selected,
  });
  assert.equal(cancel.kind, "helper");
  if (cancel.kind === "helper") {
    assert.equal(cancel.helper, "canCancelOrderForCurrentUser");
    assert.deepEqual(cancel.input, selected);
  }

  const status = routeSupportAccountAwareRequest("What is its status?", {
    selectedOrder: selected,
  });
  assert.equal(status.kind, "helper");
  if (status.kind === "helper") {
    assert.equal(status.helper, "getOrderStatusForCurrentUser");
    assert.deepEqual(status.input, selected);
  }

  const aboutPayment = routeSupportAccountAwareRequest("What about payment?", {
    selectedOrder: selected,
  });
  assert.equal(aboutPayment.kind, "helper");
  if (aboutPayment.kind === "helper") {
    assert.equal(aboutPayment.helper, "getPaymentStatusForCurrentUser");
    assert.deepEqual(aboutPayment.input, selected);
  }

  const paidOrders = routeSupportAccountAwareRequest(
    "Do I have any paid orders?",
    { selectedOrder: selected },
  );
  assert.equal(paidOrders.kind, "none");

  const showPaidOrders = routeSupportAccountAwareRequest("Show my paid orders", {
    selectedOrder: selected,
  });
  assert.equal(showPaidOrders.kind, "none");

  const pendingPayments = routeSupportAccountAwareRequest(
    "Which payments are still pending?",
    { selectedOrder: selected },
  );
  assert.equal(pendingPayments.kind, "none");

  for (const prompt of [
    "Why was the invoice not issued yet?",
    "Why is there no invoice?",
    "What does not invoiced yet mean?",
  ]) {
    const invoiceLifecycle = routeSupportAccountAwareRequest(prompt, {
      selectedOrder: selected,
    });
    assert.equal(invoiceLifecycle.kind, "helper");
    if (invoiceLifecycle.kind === "helper") {
      assert.equal(invoiceLifecycle.helper, "getOrderStatusForCurrentUser");
      assert.equal(
        invoiceLifecycle.responseIntent,
        "invoice_lifecycle_explanation",
      );
      assert.deepEqual(invoiceLifecycle.input, selected);
    }
  }
});

test("selected order cancellation why follow-ups explain safe block reasons", async () => {
  const selected = {
    referenceType: "order_id" as const,
    reference: ORDER_CANCELED_A,
  };
  const route = routeSupportAccountAwareRequest(
    "Warum kann ich diese Buchung nicht stornieren?",
    { selectedOrder: selected },
  );
  assert.equal(route.kind, "helper");
  if (route.kind === "helper") {
    assert.equal(route.helper, "canCancelOrderForCurrentUser");
    assert.deepEqual(route.input, selected);
  }

  const { accountContext } = makeCtx();
  const response = await buildAccountAwareServerResponse({
    route: route as Exclude<typeof route, { kind: "none" }>,
    accountContext,
    locale: "de",
    threadId: THREAD_ID,
  });

  assert.equal(response.disposition, "answered");
  assert.equal(
    response.accountHelperMetadata.helper,
    "canCancelOrderForCurrentUser",
  );
  assert.match(response.assistantMessage, /bereits storniert/i);
  assert.doesNotMatch(response.assistantMessage, /kontaktiere den Support/i);

  const genericPolicyQuestion = routeSupportAccountAwareRequest(
    "Warum kann ich eine Buchung nicht stornieren?",
  );
  assert.equal(genericPolicyQuestion.kind, "none");
});

test("selected order detail follow-ups use support-safe order context", async () => {
  const selected = {
    referenceType: "order_id" as const,
    reference: ORDER_DETAIL_A,
  };
  const route = routeSupportAccountAwareRequest(
    "Wer ist der Anbieter für diese Buchung?",
    { selectedOrder: selected },
  );
  assert.equal(route.kind, "helper");
  if (route.kind === "helper") {
    assert.equal(route.helper, "getOrderStatusForCurrentUser");
    assert.deepEqual(route.input, selected);
  }

  const { accountContext } = makeCtx();
  const response = await buildAccountAwareServerResponse({
    route: route as Exclude<typeof route, { kind: "none" }>,
    accountContext,
    locale: "de",
    threadId: THREAD_ID,
  });

  assert.equal(response.disposition, "answered");
  assert.equal(
    response.accountHelperMetadata.helper,
    "getOrderStatusForCurrentUser",
  );
  assert.match(response.assistantMessage, /Dienstleister: react_jedi/i);
  assert.doesNotMatch(response.assistantMessage, /\bAnbieter:/i);
  assert.doesNotMatch(response.assistantMessage, /keinen Zugriff/i);
});

test("selected order context gives role-aware invoice lifecycle explanations", async () => {
  const customerSelected = {
    referenceType: "order_id" as const,
    reference: ORDER_SCHEDULED_NOT_DUE_A,
  };
  const customerRoute = routeSupportAccountAwareRequest(
    "Why was the invoice not issued yet?",
    { selectedOrder: customerSelected },
  );
  assert.equal(customerRoute.kind, "helper");
  const customerResponse = await buildAccountAwareServerResponse({
    route: customerRoute as Exclude<typeof customerRoute, { kind: "none" }>,
    accountContext: makeCtx().accountContext,
    locale: "en",
    threadId: THREAD_ID,
  });

  assert.equal(customerResponse.disposition, "answered");
  assert.equal(
    customerResponse.accountHelperMetadata.helper,
    "getOrderStatusForCurrentUser",
  );
  assert.match(customerResponse.assistantMessage, /scheduled booking/i);
  assert.match(customerResponse.assistantMessage, /invoice\/payment step/i);
  assert.match(customerResponse.assistantMessage, /Orders page/i);
  assert.doesNotMatch(customerResponse.assistantMessage, /Which order do you mean/i);

  const tenantSelected = {
    referenceType: "order_id" as const,
    reference: ORDER_USER_B,
  };
  const tenantRoute = routeSupportAccountAwareRequest(
    "Why was the invoice not issued yet?",
    { selectedOrder: tenantSelected },
  );
  assert.equal(tenantRoute.kind, "helper");
  const tenantResponse = await buildAccountAwareServerResponse({
    route: tenantRoute as Exclude<typeof tenantRoute, { kind: "none" }>,
    accountContext: makeCtx("clerk-user-tenant").accountContext,
    locale: "en",
    threadId: THREAD_ID,
  });

  assert.equal(tenantResponse.disposition, "answered");
  assert.equal(
    tenantResponse.accountHelperMetadata.helper,
    "getOrderStatusForCurrentUser",
  );
  assert.match(tenantResponse.assistantMessage, /customer booking/i);
  assert.match(tenantResponse.assistantMessage, /awaiting your confirmation/i);
  assert.match(tenantResponse.assistantMessage, /provider side/i);
  assert.doesNotMatch(tenantResponse.assistantMessage, /Which order do you mean/i);
  assert.doesNotMatch(tenantResponse.assistantMessage, /Ada|Lovelace|stripe/i);

  const wrongTenantRoute = routeSupportAccountAwareRequest(
    "Why was the invoice not issued yet?",
    {
      selectedOrder: {
        referenceType: "order_id",
        reference: ORDER_OTHER_TENANT,
      },
    },
  );
  assert.equal(wrongTenantRoute.kind, "helper");
  const wrongTenantResponse = await buildAccountAwareServerResponse({
    route: wrongTenantRoute as Exclude<typeof wrongTenantRoute, { kind: "none" }>,
    accountContext: makeCtx("clerk-user-tenant").accountContext,
    locale: "en",
    threadId: THREAD_ID,
  });

  assert.equal(wrongTenantResponse.disposition, "unsupported_account_question");
  assert.equal(
    wrongTenantResponse.accountHelperMetadata.deniedReason,
    "not_found_or_not_owned",
  );
  assert.doesNotMatch(wrongTenantResponse.assistantMessage, /Other Provider/i);
});

test("localized account-aware responses stay deterministic outside English", async () => {
  const frenchCandidates = await respondWithRoute(
    {
      kind: "candidate_selection",
      selectionHelper: "getOrderStatusForCurrentUser",
    },
    "clerk-user-a",
    "fr",
  );

  assert.equal(frenchCandidates.response.disposition, "uncertain");
  assert.equal(
    frenchCandidates.response.accountHelperMetadata.helper,
    "getSupportOrderCandidatesForCurrentUser",
  );
  assert.match(frenchCandidates.response.assistantMessage, /J'ai trouvé/i);
  assert.doesNotMatch(
    frenchCandidates.response.assistantMessage,
    /I found|Which order do you mean/i,
  );
  assert.equal(frenchCandidates.response.actions?.length, 3);
  assert.match(frenchCandidates.response.actions?.[0]?.description ?? "", /paiement/i);
  assert.doesNotMatch(
    frenchCandidates.response.actions?.[0]?.description ?? "",
    /payment|scheduled|requested/i,
  );

  const frenchStatus = await respond(
    `What is my order status ${ORDER_SCHEDULED_NOT_DUE_A}?`,
    "clerk-user-a",
    "fr",
  );
  assert.equal(frenchStatus.response.disposition, "answered");
  assert.match(frenchStatus.response.assistantMessage, /Cette commande est planifiée/i);
  assert.match(frenchStatus.response.assistantMessage, /Prestataire:/i);
  assert.doesNotMatch(frenchStatus.response.assistantMessage, /This order|Provider:/i);

  const selected = {
    referenceType: "order_id" as const,
    reference: ORDER_SCHEDULED_NOT_DUE_A,
  };
  const frenchInvoiceRoute = routeSupportAccountAwareRequest(
    "Pourquoi la facture n'a-t-elle pas encore été émise ?",
    { selectedOrder: selected },
  );
  assert.equal(frenchInvoiceRoute.kind, "helper");
  if (frenchInvoiceRoute.kind === "helper") {
    assert.equal(frenchInvoiceRoute.helper, "getOrderStatusForCurrentUser");
    assert.equal(
      frenchInvoiceRoute.responseIntent,
      "invoice_lifecycle_explanation",
    );
  }
  const frenchInvoiceResponse = await buildAccountAwareServerResponse({
    route: frenchInvoiceRoute as Exclude<typeof frenchInvoiceRoute, { kind: "none" }>,
    accountContext: makeCtx().accountContext,
    locale: "fr",
    threadId: THREAD_ID,
  });
  assert.equal(frenchInvoiceResponse.disposition, "answered");
  assert.equal(
    frenchInvoiceResponse.accountHelperMetadata.helper,
    "getOrderStatusForCurrentUser",
  );
  assert.match(frenchInvoiceResponse.assistantMessage, /Aucune facture/i);
  assert.doesNotMatch(
    frenchInvoiceResponse.assistantMessage,
    /An invoice|Which order do you mean/i,
  );
});

test("candidate prompts use the active locale across launched locales", async () => {
  const expectations = [
    ["de", /Ich habe/i, /Diese Bestellung ist geplant/i],
    ["fr", /J'ai trouvé/i, /Cette commande est planifiée/i],
    ["it", /Ho trovato/i, /Questo ordine è programmato/i],
    ["es", /Encontré/i, /Este pedido está programado/i],
    ["pt", /Encontrei/i, /Este pedido está agendado/i],
    ["pl", /Znalazłem/i, /To zamówienie jest zaplanowane/i],
    ["ro", /Am găsit/i, /Această comandă este programată/i],
    ["uk", /Я знайшов/i, /Це замовлення заплановано/i],
  ] as const;

  for (const [locale, expectedCandidate, expectedStatus] of expectations) {
    const response = await respondWithRoute(
      {
        kind: "candidate_selection",
        selectionHelper: "getOrderStatusForCurrentUser",
      },
      "clerk-user-a",
      locale,
    );
    assert.equal(response.response.disposition, "uncertain", locale);
    assert.match(response.response.assistantMessage, expectedCandidate, locale);
    assert.doesNotMatch(
      response.response.assistantMessage,
      /I found|Which order do you mean/i,
      locale,
    );

    const exactStatus = await respond(
      `What is my order status ${ORDER_SCHEDULED_NOT_DUE_A}?`,
      "clerk-user-a",
      locale,
    );
    assert.equal(exactStatus.response.disposition, "answered", locale);
    assert.match(exactStatus.response.assistantMessage, expectedStatus, locale);
    assert.doesNotMatch(
      exactStatus.response.assistantMessage,
      /This order|Provider:/i,
      locale,
    );
    if (locale !== "fr") {
      assert.doesNotMatch(exactStatus.response.assistantMessage, /Cette commande/i, locale);
    }
  }
});

test("selected invoice lifecycle follow-ups route deterministically across launched locales", () => {
  const selected = {
    referenceType: "order_id" as const,
    reference: ORDER_SCHEDULED_NOT_DUE_A,
  };
  const prompts = [
    "Warum wurde die Rechnung noch nicht ausgestellt?",
    "Pourquoi la facture n'a-t-elle pas encore été émise ?",
    "Perché la fattura non è ancora stata emessa?",
    "¿Por qué no se ha emitido la factura todavía?",
    "Por que a fatura ainda não foi emitida?",
    "Dlaczego faktura nie została jeszcze wystawiona?",
    "De ce factura nu a fost emisă încă?",
    "Чому рахунок ще не виставлено?",
  ];

  for (const prompt of prompts) {
    const route = routeSupportAccountAwareRequest(prompt, {
      selectedOrder: selected,
    });

    assert.equal(route.kind, "helper", prompt);
    if (route.kind === "helper") {
      assert.equal(route.helper, "getOrderStatusForCurrentUser", prompt);
      assert.equal(route.responseIntent, "invoice_lifecycle_explanation", prompt);
      assert.deepEqual(route.input, selected, prompt);
    }
  }
});

test("selected order context does not capture unrelated it follow-ups", () => {
  const selected = { referenceType: "order_id" as const, reference: ORDER_SCHEDULED_A };

  for (const prompt of [
    "It does not work",
    "Is it possible?",
    "I don't understand it",
    "It is confusing",
    "What date?",
    "What time?",
  ]) {
    const route = routeSupportAccountAwareRequest(prompt, {
      selectedOrder: selected,
    });

    assert.notEqual(
      route.kind,
      "helper",
      `unexpected selected-order helper route for: ${prompt}`,
    );
  }
});

test("selected order follow-up predicate only captures selected-order references", () => {
  assert.equal(isSelectedOrderFollowUpMessage("What about payment?"), true);
  assert.equal(
    isSelectedOrderFollowUpMessage("Who is the provider for this booking?"),
    true,
  );
  assert.equal(isSelectedOrderFollowUpMessage("Can I cancel it?"), true);
  assert.equal(isSelectedOrderFollowUpMessage("How does cancellation work?"), false);
});

test("selected order context tokens validate thread and expiry", () => {
  assert.throws(() =>
    createSelectedOrderContextToken({
      reference: "not-an-order-id",
      threadId: THREAD_ID,
    }),
  );

  const token = createSelectedOrderContextToken({
    reference: ORDER_SCHEDULED_A,
    threadId: THREAD_ID,
    displayLabel: "Provider - 26 Apr 2026",
  });

  const verified = verifySelectedOrderContextToken({
    token,
    threadId: THREAD_ID,
  });
  assert.equal(verified.ok, true);
  if (verified.ok) {
    assert.deepEqual(verified.input, {
      referenceType: "order_id",
      reference: ORDER_SCHEDULED_A,
    });
    assert.equal(verified.displayLabel, "Provider - 26 Apr 2026");
  }

  const wrongThread = verifySelectedOrderContextToken({
    token,
    threadId: "22222222-2222-4222-8222-222222222222",
  });
  assert.deepEqual(wrongThread, { ok: false, reason: "invalid_token" });

  const expiredToken = createSelectedOrderContextToken({
    reference: ORDER_SCHEDULED_A,
    threadId: THREAD_ID,
    now: new Date(Date.now() - 60 * 60 * 1000),
  });
  const expired = verifySelectedOrderContextToken({
    token: expiredToken,
    threadId: THREAD_ID,
  });
  assert.deepEqual(expired, { ok: false, reason: "expired_token" });
});

test("expired selected order context returns deterministic reselect copy", async () => {
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const expiredToken = createSelectedOrderContextToken({
    reference: ORDER_SCHEDULED_A,
    threadId: THREAD_ID,
    now: new Date(Date.now() - 60 * 60 * 1000),
  });

  const response = await generateSupportResponse({
    message: "What about payment?",
    threadId: THREAD_ID,
    locale: "en",
    accountContext,
    selectedOrderContext: {
      type: "selected_order",
      token: expiredToken,
    },
  });

  assert.equal(response.disposition, "uncertain");
  assert.equal(response.needsHumanSupport, false);
  assert.equal(response.responseOrigin, "server");
  assert.equal(response.accountHelperMetadata?.actionTokenReason, "expired_token");
  assert.match(response.assistantMessage, /selection expired/i);
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("invalid selected order context returns safe fallback without account lookup", async () => {
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");

  const response = await generateSupportResponse({
    message: "What about payment?",
    threadId: THREAD_ID,
    locale: "en",
    accountContext,
    selectedOrderContext: {
      type: "selected_order",
      token: "not-a-token",
    },
  });

  assert.equal(response.disposition, "unsupported_account_question");
  assert.equal(response.responseOrigin, "server");
  assert.equal(response.accountHelperMetadata?.actionTokenReason, "invalid_token");
  assert.match(response.assistantMessage, /limited support-safe/i);
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("expired selected order context does not block unrelated general questions", async () => {
  const { generateSupportResponse } = await import("../generate-support-response");
  const { db, accountContext } = makeCtx("clerk-user-a");
  const expiredToken = createSelectedOrderContextToken({
    reference: ORDER_SCHEDULED_A,
    threadId: THREAD_ID,
    now: new Date(Date.now() - 60 * 60 * 1000),
  });

  const response = await generateSupportResponse({
    message: "How does cancellation work?",
    threadId: THREAD_ID,
    locale: "en",
    accountContext,
    selectedOrderContext: {
      type: "selected_order",
      token: expiredToken,
    },
  });

  assert.notEqual(response.accountHelperMetadata?.actionTokenReason, "expired_token");
  assert.doesNotMatch(response.assistantMessage, /selection expired/i);
  assert.equal(
    db.calls.some((call) => call.collection === "orders"),
    false,
  );
});

test("candidate action token is re-authorized for tenant order access", async () => {
  assert.throws(() =>
    createAccountCandidateActionToken({
      helper: "getOrderStatusForCurrentUser",
      reference: "not-an-order-id",
      threadId: THREAD_ID,
    }),
  );

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
  const payment = await respondWithRoute({
    kind: "candidate_selection",
    selectionHelper: "getPaymentStatusForCurrentUser",
  });
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
  assert.match(paymentClick.assistantMessage, /booking request/i);
  assert.match(paymentClick.assistantMessage, /awaiting provider confirmation/i);

  const lastPayment = await respondWithRoute({
    kind: "candidate_selection",
    selectionHelper: "getPaymentStatusForCurrentUser",
  });
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

  const cancel = await respondWithRoute({
    kind: "candidate_selection",
    selectionHelper: "canCancelOrderForCurrentUser",
  });
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
  const { response, accountContext } = await respondWithRoute({
    kind: "candidate_selection",
    selectionHelper: "getOrderStatusForCurrentUser",
  });
  const action = response.actions?.[0];
  assert.ok(action);

  const tampered = await buildAccountAwareActionResponse({
    token: `${action.token.slice(0, -2)}xx`,
    threadId: THREAD_ID,
    accountContext,
    locale: "en",
  });
  assert.equal(tampered.disposition, "unsupported_account_question");
  assert.match(tampered.assistantMessage, /limited support-safe/i);

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
  assert.equal(expired.disposition, "uncertain");
  assert.equal(expired.needsHumanSupport, false);
  assert.equal(expired.accountHelperMetadata.actionTokenReason, "expired_token");
  assert.match(expired.assistantMessage, /selection expired/i);

  const { response } = await respondWithRoute({
    kind: "candidate_selection",
    selectionHelper: "getOrderStatusForCurrentUser",
  });
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

  const response = await buildAccountAwareServerResponse({
    route: {
      kind: "candidate_selection",
      selectionHelper: "canCancelOrderForCurrentUser",
    },
    accountContext,
    locale: "en",
    threadId: THREAD_ID,
  });

  assert.match(response.assistantMessage, /one recent order that may match/i);
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

function rewriteBaseResponse(resultCategory = "payment_status") {
  return {
    assistantMessage:
      "Payment is not due yet because this booking request is still awaiting provider confirmation.",
    disposition: "answered" as const,
    needsHumanSupport: false,
    accountHelperMetadata: {
      helper: "getPaymentStatusForCurrentUser" as const,
      helperVersion: "support-account-helpers-v1",
      resultCategory,
      authenticated: true,
      requiredInputPresent: true,
      serverAuthored: true as const,
    },
  };
}

const rewritePaymentDTO = {
  helper: "getPaymentStatusForCurrentUser" as const,
  referenceType: "order_id" as const,
  resultCategory: "payment_status" as const,
  nextStepKey: "wait_for_provider" as const,
  paymentStatusCategory: "not_due" as const,
  invoiceStatusCategory: "none" as const,
  serviceStatusCategory: "requested" as const,
  accessRole: "customer" as const,
};

const rewritePaymentOverviewDTO = {
  helper: "getSupportPaymentOverviewForCurrentUser" as const,
  resultCategory: "payment_overview" as const,
  inspectedOrderCount: 2,
  limitDescription: "recent_support_orders" as const,
  categories: {
    paid: 0,
    paymentPending: 1,
    paymentNotDue: 1,
    paymentCanceled: 0,
    refunded: 0,
    unknown: 0,
  },
  recentExamples: [],
  nextStepKey: "view_orders" as const,
};

async function withRewriteFlag<T>(enabled: boolean, callback: () => Promise<T>) {
  const previous = process.env.SUPPORT_CHAT_ACCOUNT_REWRITE_ENABLED;
  process.env.SUPPORT_CHAT_ACCOUNT_REWRITE_ENABLED = enabled ? "true" : "false";
  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.SUPPORT_CHAT_ACCOUNT_REWRITE_ENABLED;
    } else {
      process.env.SUPPORT_CHAT_ACCOUNT_REWRITE_ENABLED = previous;
    }
  }
}

test("account rewrite disabled keeps deterministic account answer without model call", async () => {
  let calls = 0;
  const response = await withRewriteFlag(false, () =>
    rewriteAccountAwareServerResponse({
      response: rewriteBaseResponse(),
      helperResult: rewritePaymentDTO,
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse: async () => {
        calls += 1;
        throw new Error("disabled rewrite should not call model");
      },
    }),
  );

  assert.equal(calls, 0);
  assert.equal(response.accountAnswerMode, "model_rewrite_disabled");
  assert.equal(response.accountRewriteRejectedReason, "feature_disabled");
  assert.equal(response.accountRewriteFallbackUsed, true);
  assert.match(response.assistantMessage, /Payment is not due yet/i);
});

test("account rewrite accepts safe model wording from sanitized DTOs", async () => {
  const response = await withRewriteFlag(true, () =>
    rewriteAccountAwareServerResponse({
      response: rewriteBaseResponse(),
      helperResult: rewritePaymentDTO,
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse: async () => ({
        ok: true,
        text:
          "You have not been asked to pay yet because this booking is still waiting for provider confirmation.",
        model: "rewrite-model",
        modelVersion: "rewrite-v1",
        requestId: "req_rewrite",
      }),
    }),
  );

  assert.equal(response.accountAnswerMode, "model_rewritten");
  assert.equal(response.accountRewriteModel, "rewrite-model");
  assert.equal(response.accountRewriteModelVersion, "rewrite-v1");
  assert.equal(response.accountRewriteFallbackUsed, false);
  assert.match(response.assistantMessage, /not been asked to pay yet/i);
});

test("account rewrite accepts explicit payment not due wording", async () => {
  const response = await withRewriteFlag(true, () =>
    rewriteAccountAwareServerResponse({
      response: rewriteBaseResponse(),
      helperResult: rewritePaymentDTO,
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse: async () => ({
        ok: true,
        text:
          "Payment is not due yet because this booking is still awaiting provider confirmation.",
        model: "rewrite-model",
        modelVersion: "rewrite-v1",
        requestId: "req_not_due",
      }),
    }),
  );

  assert.equal(response.accountAnswerMode, "model_rewritten");
  assert.equal(response.accountRewriteFallbackUsed, false);
  assert.match(response.assistantMessage, /Payment is not due yet/i);
});

test("account rewrite detects not-due contradictions from the helper DTO", async () => {
  const response = await withRewriteFlag(true, () =>
    rewriteAccountAwareServerResponse({
      response: {
        ...rewriteBaseResponse(),
        assistantMessage: "El pago todavia no vence para este pedido.",
      },
      helperResult: rewritePaymentDTO,
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse: async () => ({
        ok: true,
        text: "Payment is due now for this order.",
        model: "rewrite-model",
        modelVersion: "rewrite-v1",
        requestId: "req_due_now",
      }),
    }),
  );

  assert.equal(response.accountAnswerMode, "model_rewrite_rejected");
  assert.equal(response.accountRewriteRejectedReason, "contradicts_fallback");
  assert.equal(response.accountRewriteFallbackUsed, true);
});

test("account rewrite accepts negative paid wording for non-paid DTOs", async () => {
  for (const text of ["This order is not paid yet.", "This order is unpaid."]) {
    const response = await withRewriteFlag(true, () =>
      rewriteAccountAwareServerResponse({
        response: rewriteBaseResponse(),
        helperResult: rewritePaymentDTO,
        locale: "en",
        threadId: THREAD_ID,
        createModelResponse: async () => ({
          ok: true,
          text,
          model: "rewrite-model",
          modelVersion: "rewrite-v1",
          requestId: "req_not_paid",
        }),
      }),
    );

    assert.equal(response.accountAnswerMode, "model_rewritten", text);
    assert.equal(response.accountRewriteFallbackUsed, false, text);
    assert.equal(response.assistantMessage, text, text);
  }
});

test("account rewrite falls back on model errors and empty output", async () => {
  const modelError = await withRewriteFlag(true, () =>
    rewriteAccountAwareServerResponse({
      response: rewriteBaseResponse(),
      helperResult: rewritePaymentDTO,
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse: async () => ({
        ok: false,
        reason: "openai_unavailable",
        fallbackMessage: "unused",
        model: "rewrite-model",
        modelVersion: "rewrite-v1",
        requestId: null,
      }),
    }),
  );
  assert.equal(modelError.accountAnswerMode, "model_rewrite_rejected");
  assert.equal(modelError.accountRewriteRejectedReason, "model_error");
  assert.equal(modelError.accountRewriteFallbackUsed, true);

  const thrown = await withRewriteFlag(true, () =>
    rewriteAccountAwareServerResponse({
      response: rewriteBaseResponse(),
      helperResult: rewritePaymentDTO,
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse: async () => {
        throw new Error("rewrite model unavailable");
      },
    }),
  );
  assert.equal(thrown.accountAnswerMode, "model_rewrite_rejected");
  assert.equal(thrown.accountRewriteRejectedReason, "model_error");
  assert.equal(thrown.accountRewriteFallbackUsed, true);
  assert.match(thrown.assistantMessage, /Payment is not due yet/i);

  const empty = await withRewriteFlag(true, () =>
    rewriteAccountAwareServerResponse({
      response: rewriteBaseResponse(),
      helperResult: rewritePaymentDTO,
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse: async () => ({
        ok: false,
        reason: "empty_output",
        fallbackMessage: "unused",
        model: "rewrite-model",
        modelVersion: "rewrite-v1",
        requestId: null,
      }),
    }),
  );
  assert.equal(empty.accountRewriteRejectedReason, "empty_output");
  assert.match(empty.assistantMessage, /Payment is not due yet/i);
});

test("account rewrite guardrails reject unsafe drafts", async () => {
  const cases = [
    {
      text: "I checked your Stripe account and payment is not due.",
      reason: "unsafe_system_claim",
      locale: "en" as const,
    },
    {
      text: "I canceled the order for you.",
      reason: "mutation_claim",
      locale: "en" as const,
    },
    {
      text: "This order is definitely paid.",
      reason: "unsupported_fact",
      locale: "en" as const,
    },
    {
      text: "This order is already paid.",
      reason: "contradicts_fallback",
      locale: "en" as const,
    },
    {
      text: "This order is paid.",
      reason: "contradicts_fallback",
      locale: "en" as const,
    },
    {
      text: "Payment is due now for this order.",
      reason: "contradicts_fallback",
      locale: "en" as const,
    },
    {
      text: "This order is still waiting for payment.",
      reason: "wrong_locale",
      locale: "fr" as const,
    },
  ];

  for (const item of cases) {
    const response = await withRewriteFlag(true, () =>
      rewriteAccountAwareServerResponse({
        response: rewriteBaseResponse(),
        helperResult: rewritePaymentDTO,
        locale: item.locale,
        threadId: THREAD_ID,
        createModelResponse: async () => ({
          ok: true,
          text: item.text,
          model: "rewrite-model",
          modelVersion: "rewrite-v1",
          requestId: null,
        }),
      }),
    );

    assert.equal(response.accountAnswerMode, "model_rewrite_rejected", item.text);
    assert.equal(response.accountRewriteRejectedReason, item.reason, item.text);
    assert.equal(response.accountRewriteFallbackUsed, true, item.text);
  }
});

test("payment overview rewrite must preserve bounded-history limitation", async () => {
  const response = await withRewriteFlag(true, () =>
    rewriteAccountAwareServerResponse({
      response: {
        ...rewriteBaseResponse("payment_overview"),
        assistantMessage:
          "From the recent orders I can safely check, I found 0 paid orders.\n\nI inspected 2 recent support-safe orders. This is not a full payment history.",
        accountHelperMetadata: {
          ...rewriteBaseResponse("payment_overview").accountHelperMetadata,
          helper: "getSupportPaymentOverviewForCurrentUser",
          requiredInputPresent: false,
        },
      },
      helperResult: rewritePaymentOverviewDTO,
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse: async () => ({
        ok: true,
        text: "You have 0 paid orders and 1 pending payment.",
        model: "rewrite-model",
        modelVersion: "rewrite-v1",
        requestId: null,
      }),
    }),
  );

  assert.equal(response.accountAnswerMode, "model_rewrite_rejected");
  assert.equal(response.accountRewriteRejectedReason, "missing_required_limitation");
  assert.match(response.assistantMessage, /not a full payment history/i);
});

test("account rewrite is not attempted for candidate or denied responses", async () => {
  let calls = 0;
  const createModelResponse = async () => {
    calls += 1;
    throw new Error("ineligible responses should not call model");
  };

  const candidate = await withRewriteFlag(true, () =>
    rewriteAccountAwareServerResponse({
      response: {
        assistantMessage: "I found a few recent orders that may match. Which order do you mean?",
        disposition: "uncertain",
        needsHumanSupport: false,
        accountHelperMetadata: {
          helper: "getSupportOrderCandidatesForCurrentUser",
          helperVersion: "support-account-helpers-v1",
          resultCategory: "order_candidates",
          authenticated: true,
          requiredInputPresent: false,
          serverAuthored: true,
        },
      },
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse,
    }),
  );

  const denied = await withRewriteFlag(true, () =>
    rewriteAccountAwareServerResponse({
      response: {
        assistantMessage: "I cannot check live order details in this chat yet.",
        disposition: "unsupported_account_question",
        needsHumanSupport: true,
        accountHelperMetadata: {
          helper: "getOrderStatusForCurrentUser",
          helperVersion: "support-account-helpers-v1",
          deniedReason: "not_found_or_not_owned",
          authenticated: true,
          requiredInputPresent: true,
          serverAuthored: true,
        },
      },
      helperResult: rewritePaymentDTO,
      locale: "en",
      threadId: THREAD_ID,
      createModelResponse,
    }),
  );

  assert.equal(calls, 0);
  assert.equal(candidate.accountAnswerMode, "server_deterministic");
  assert.equal(denied.accountAnswerMode, "server_deterministic");
});
