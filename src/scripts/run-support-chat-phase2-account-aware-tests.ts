import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import type { Booking, Invoice, Order, Tenant } from "@/payload-types";
import type { GenerateSupportResponseResult } from "@/modules/support-chat/server/generate-support-response";
import {
  PHASE2_ACCOUNT_FIXTURE_IDS,
  SUPPORT_CHAT_PHASE2_ACCOUNT_AWARE_TEST_CASES,
  type SupportChatPhase2AccountAwareCase,
} from "@/modules/support-chat/testing/phase2-account-aware-test-cases";

type RunnerArgs = {
  caseId?: string;
  json: boolean;
  out?: string;
};

type DbCall = {
  method: string;
  collection?: string;
  id?: string;
  where?: unknown;
  limit?: number;
  sort?: string;
  depth?: number;
  overrideAccess?: boolean;
};

type Phase2Result = {
  id: string;
  category: SupportChatPhase2AccountAwareCase["category"];
  prompt: string;
  actualDisposition: GenerateSupportResponseResult["disposition"];
  expectedDisposition?: GenerateSupportResponseResult["disposition"];
  actualNeedsHumanSupport: boolean;
  expectedNeedsHumanSupport?: boolean;
  responseOrigin: GenerateSupportResponseResult["responseOrigin"];
  expectedResponseOrigin?: GenerateSupportResponseResult["responseOrigin"];
  assistantMessage: string;
  actions: GenerateSupportResponseResult["actions"];
  accountHelperMetadata: GenerateSupportResponseResult["accountHelperMetadata"];
  dbCalls: DbCall[];
  checks: Record<string, boolean>;
};

const USER_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const USER_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const USER_TENANT = "dddddddddddddddddddddddd";
const TENANT_ID = "cccccccccccccccccccccccc";
const SLOT_REQUESTED = "300000000000000000000001";
const SLOT_INVOICED = "300000000000000000000004";

function parseArgs(argv: string[]): RunnerArgs {
  const args: RunnerArgs = { json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--json") {
      args.json = true;
      continue;
    }
    if (value === "--case") {
      args.caseId = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--out") {
      args.out = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

function pickCases(caseId?: string) {
  if (!caseId) return SUPPORT_CHAT_PHASE2_ACCOUNT_AWARE_TEST_CASES;

  const match = SUPPORT_CHAT_PHASE2_ACCOUNT_AWARE_TEST_CASES.find(
    (item) => item.id === caseId,
  );
  if (!match) {
    throw new Error(`Unknown support-chat Phase 2 account-aware case "${caseId}".`);
  }
  return [match];
}

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
    order: PHASE2_ACCOUNT_FIXTURE_IDS.ownedInvoicedOrder,
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

function makeAccountContext(authUser: SupportChatPhase2AccountAwareCase["authUser"]) {
  const ids = PHASE2_ACCOUNT_FIXTURE_IDS;
  const orders = new Map<string, Order>([
    [ids.ownedRequestedOrder, order({ id: ids.ownedRequestedOrder })],
    [
      ids.ownedInvoicedOrder,
      order({
        id: ids.ownedInvoicedOrder,
        serviceStatus: "scheduled",
        invoiceStatus: "issued",
        invoiceIssuedAt: "2026-04-27T11:00:00.000Z",
        paymentDueAt: "2026-05-11T11:00:00.000Z",
        slots: [SLOT_INVOICED],
        createdAt: "2026-04-26T09:00:00.000Z",
      }),
    ],
    [
      ids.wrongOwnerOrder,
      order({
        id: ids.wrongOwnerOrder,
        user: USER_B,
        createdAt: "2026-04-28T09:00:00.000Z",
      }),
    ],
  ]);
  const invoices = new Map<string, Invoice>([
    [ids.ownedInvoice, invoice({ id: ids.ownedInvoice })],
    [ids.wrongOwnerInvoice, invoice({ id: ids.wrongOwnerInvoice, customer: USER_B })],
  ]);
  const bookings = new Map<string, Booking>([
    [SLOT_REQUESTED, booking({ id: SLOT_REQUESTED })],
    [SLOT_INVOICED, booking({ id: SLOT_INVOICED, serviceStatus: "scheduled" })],
  ]);
  const tenants = new Map<string, Tenant>([
    [TENANT_ID, tenant({ id: TENANT_ID })],
  ]);
  const calls: DbCall[] = [];

  // The Phase 2 regression fake DB intentionally supports only exact account
  // reads and throws on mutation or broad account searches.
  const db = {
    calls,
    async find(args: {
      collection: string;
      where?: unknown;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess?: boolean;
    }) {
      calls.push({
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
        return { docs: [] };
      }

      if (args.collection === "bookings") {
        const idsFromQuery = clauseIn(args.where, "id");
        return {
          docs: idsFromQuery
            .map((id) => (typeof id === "string" ? bookings.get(id) : null))
            .filter(Boolean),
        };
      }

      if (args.collection === "orders") {
        const userId = clauseEquals(args.where, "user");
        const tenantIds = clauseIn(args.where, "tenant");
        const lifecycleMode = clauseEquals(args.where, "lifecycleMode");
        if (
          (args.limit !== 10 && args.limit !== 15 && args.limit !== 50) ||
          args.sort !== "-createdAt" ||
          args.depth !== 0 ||
          args.overrideAccess !== true ||
          lifecycleMode !== "slot"
        ) {
          throw new Error("Unexpected broad orders lookup");
        }
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
        throw new Error(`Unexpected broad ${args.collection} lookup`);
      }

      if (args.collection === "tenants") {
        const userId = clauseEquals(args.where, "user");
        return {
          docs: [...tenants.values()].filter((item) => item.user === userId),
        };
      }

      return { docs: [] };
    },
    async findByID(args: { collection: string; id: string }) {
      calls.push({ method: "findByID", collection: args.collection, id: args.id });
      if (args.collection === "orders") return orders.get(args.id) ?? null;
      if (args.collection === "invoices") return invoices.get(args.id) ?? null;
      if (args.collection === "tenants") return tenants.get(args.id) ?? null;
      return null;
    },
    create() {
      calls.push({ method: "create" });
      throw new Error("Unexpected mutation");
    },
    update() {
      calls.push({ method: "update" });
      throw new Error("Unexpected mutation");
    },
    delete() {
      calls.push({ method: "delete" });
      throw new Error("Unexpected mutation");
    },
  };

  return {
    db,
    userId:
      authUser === "signed-out"
        ? null
        : authUser === "tenant-owner"
          ? "clerk-user-tenant"
          : "clerk-user-a",
    calls,
  };
}

function containsAny(message: string, patterns: string[] | undefined) {
  if (!patterns?.length) return true;
  return patterns.every((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

function containsNone(message: string, patterns: string[] | undefined) {
  if (!patterns?.length) return true;
  return patterns.every(
    (pattern) => !message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

function actionText(result: GenerateSupportResponseResult) {
  return (result.actions ?? [])
    .map((action) => `${action.label} ${action.description ?? ""}`)
    .join("\n");
}

function hasAccountDbCall(calls: DbCall[]) {
  return calls.some(
    (call) =>
      (call.method === "find" || call.method === "findByID") &&
      (call.collection === "users" ||
        call.collection === "tenants" ||
        call.collection === "orders" ||
        call.collection === "invoices" ||
        call.collection === "bookings"),
  );
}

function hasBroadLookup(calls: DbCall[]) {
  return calls.some(
    (call) => {
      if (call.method !== "find") return false;
      if (call.collection === "invoices") return true;
      if (call.collection !== "orders") return false;
      // Candidate and overview helpers are bounded, server-defined lookups.
      // Treat those narrow shapes as safe in this regression runner.
      if (
        (call.limit === 10 || call.limit === 15) &&
        call.sort === "-createdAt" &&
        call.depth === 0 &&
        call.overrideAccess === true &&
        clauseEquals(call.where, "lifecycleMode") === "slot" &&
        (clauseEquals(call.where, "user") === USER_A ||
          clauseIn(call.where, "tenant").includes(TENANT_ID))
      ) {
        return false;
      }
      return !(
        call.limit === 3 &&
        call.sort === "-createdAt" &&
        call.depth === 0 &&
        call.overrideAccess === true &&
        clauseEquals(call.where, "user") === USER_A &&
        clauseEquals(call.where, "lifecycleMode") === "slot"
      );
    },
  );
}

function hasExactLookup(calls: DbCall[]) {
  return calls.some((call) => call.method === "findByID");
}

function hasMutation(calls: DbCall[]) {
  return calls.some((call) =>
    ["create", "update", "delete"].includes(call.method),
  );
}

function evaluateCase(
  testCase: SupportChatPhase2AccountAwareCase,
  result: GenerateSupportResponseResult,
  calls: DbCall[],
): Phase2Result {
  const metadata = result.accountHelperMetadata;
  const actions = actionText(result);
  const checks: Record<string, boolean> = {
    expectedDisposition:
      testCase.expectedDisposition == null ||
      result.disposition === testCase.expectedDisposition,
    expectedNeedsHumanSupport:
      testCase.expectedNeedsHumanSupport == null ||
      result.needsHumanSupport === testCase.expectedNeedsHumanSupport,
    expectedResponseOrigin:
      testCase.expectedResponseOrigin == null ||
      result.responseOrigin === testCase.expectedResponseOrigin,
    expectedHelper:
      testCase.expectedHelper == null ||
      metadata?.helper === testCase.expectedHelper,
    expectedDeniedReason:
      testCase.expectedDeniedReason == null ||
      metadata?.deniedReason === testCase.expectedDeniedReason,
    noAccountHelper:
      testCase.expectNoAccountHelper !== true || metadata == null,
    noAccountDbCalls:
      testCase.expectNoAccountDbCalls !== true || !hasAccountDbCall(calls),
    noBroadLookup:
      testCase.expectNoBroadLookup !== true || !hasBroadLookup(calls),
    noExactLookup:
      testCase.expectNoExactLookup !== true || !hasExactLookup(calls),
    noMutation: testCase.expectNoMutation !== true || !hasMutation(calls),
    expectedAnswerPatterns: containsAny(
      result.assistantMessage,
      testCase.expectedAnswerPatterns,
    ),
    forbiddenAnswerPatterns: containsNone(
      result.assistantMessage,
      testCase.forbiddenAnswerPatterns,
    ),
    expectedActionPatterns: containsAny(
      actions,
      testCase.expectedActionPatterns,
    ),
    forbiddenActionPatterns: containsNone(
      actions,
      testCase.forbiddenActionPatterns,
    ),
    expectedActionCount:
      testCase.expectedActionCount == null ||
      (result.actions ?? []).length === testCase.expectedActionCount,
    accountResponsesAreServerAuthored:
      metadata == null ||
      (result.responseOrigin === "server" && metadata.serverAuthored === true),
    noModelMetadataForAccountResponses:
      metadata == null || result.modelMetadata == null,
  };

  return {
    id: testCase.id,
    category: testCase.category,
    prompt: testCase.prompt,
    actualDisposition: result.disposition,
    expectedDisposition: testCase.expectedDisposition,
    actualNeedsHumanSupport: result.needsHumanSupport,
    expectedNeedsHumanSupport: testCase.expectedNeedsHumanSupport,
    responseOrigin: result.responseOrigin,
    expectedResponseOrigin: testCase.expectedResponseOrigin,
    assistantMessage: result.assistantMessage,
    actions: result.actions,
    accountHelperMetadata: metadata,
    dbCalls: calls,
    checks,
  };
}

function formatResult(result: Phase2Result) {
  const checkEntries = Object.entries(result.checks).map(([key, passed]) => {
    return `${passed ? "PASS" : "FAIL"} ${key}`;
  });

  return [
    `\n[${result.id}] ${result.category}`,
    `Prompt: ${result.prompt}`,
    `Disposition: expected=${result.expectedDisposition ?? "*"} actual=${result.actualDisposition}`,
    `Needs human: expected=${result.expectedNeedsHumanSupport ?? "*"} actual=${result.actualNeedsHumanSupport}`,
    `Origin: expected=${result.expectedResponseOrigin ?? "*"} actual=${result.responseOrigin}`,
    `Helper metadata: ${JSON.stringify(result.accountHelperMetadata ?? null)}`,
    `Actions: ${JSON.stringify(result.actions ?? [])}`,
    `DB calls: ${result.dbCalls.map((call) => `${call.method}:${call.collection ?? ""}:${call.id ?? ""}`).join(", ")}`,
    ...checkEntries,
    `Answer: ${result.assistantMessage}`,
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = pickCases(args.caseId);
  const results: Phase2Result[] = [];
  const { generateSupportResponse } = await import(
    "@/modules/support-chat/server/generate-support-response"
  );
  const { createSelectedOrderContextToken } = await import(
    "@/modules/support-chat/server/account-aware/action-tokens"
  );

  for (const testCase of cases) {
    const account = makeAccountContext(testCase.authUser);
    const selectedOrderContext = testCase.selectedOrderContextReference
      ? {
          type: "selected_order" as const,
          token: createSelectedOrderContextToken({
            reference: testCase.selectedOrderContextReference,
            threadId: "11111111-1111-4111-8111-111111111111",
            now: testCase.selectedOrderContextCreatedAt
              ? new Date(testCase.selectedOrderContextCreatedAt)
              : undefined,
          }),
        }
      : undefined;
    const response = await generateSupportResponse({
      message: testCase.prompt,
      threadId: "11111111-1111-4111-8111-111111111111",
      locale: testCase.locale,
      accountContext: {
        db: account.db as never,
        userId: account.userId,
      },
      selectedOrderContext,
    });
    results.push(evaluateCase(testCase, response, account.calls));
  }

  const failedCount = results.filter((result) =>
    Object.values(result.checks).some((passed) => !passed),
  ).length;

  if (args.json) {
    const payload = JSON.stringify(results, null, 2);
    if (args.out) {
      await mkdir(path.dirname(args.out), { recursive: true });
      await writeFile(args.out, `${payload}\n`, "utf8");
    } else {
      console.log(payload);
    }
  } else {
    console.log(
      `Support Chat Phase 2 account-aware test run: ${results.length} case(s), ${failedCount} structured failure(s).`,
    );
    for (const result of results) {
      console.log(formatResult(result));
    }
  }

  if (args.out && !args.json) {
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  }

  if (failedCount > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error("[support-chat phase2 account-aware tests] runner failed", error);
  process.exitCode = 1;
});
