import assert from "node:assert/strict";
import test from "node:test";

import type {
  AdminSupportMessageRow,
  AdminSupportThreadRow,
} from "@/modules/support-chat/server/admin-procedures";
import {
  buildSupportThreadCsv,
  supportThreadCsvFilename,
} from "./support-chat-admin-csv";

const thread: AdminSupportThreadRow = {
  id: "payload-thread-id",
  threadId: "2c4f7f0a-191c-43d0-97de-72d689789e56",
  locale: "de",
  user: {
    id: "user-id",
    email: "valentyn@example.com",
    username: "valentyn",
    firstName: "Valentyn",
    lastName: "Kasyan",
    roles: ["user"],
    language: "de",
    country: "Germany",
  },
  status: "open",
  reviewState: "order_selection_requested",
  lastAssistantOutcome: "uncertain",
  lastNeedsHumanSupport: false,
  messageCount: 2,
  latestUserMessagePreview: "Meine Buchung ist geplant.",
  lastMessageAt: "2026-05-06T06:42:00.000Z",
  retentionUntil: "2026-11-02T06:42:00.000Z",
  createdAt: "2026-05-06T06:38:00.000Z",
};

function message(
  overrides: Partial<AdminSupportMessageRow> & Pick<AdminSupportMessageRow, "id" | "role" | "text">,
): AdminSupportMessageRow {
  return {
    redactedText: null,
    redactionApplied: false,
    redactionTypes: [],
    locale: "de",
    responseOrigin: "server",
    disposition: null,
    needsHumanSupport: false,
    model: null,
    modelVersion: null,
    promptVersion: null,
    guardrailVersion: null,
    retrievalVersion: null,
    knowledgePackVersion: null,
    openAIRequestId: null,
    accountContextSnapshots: [],
    triageIntent: null,
    triageTopic: null,
    triageStatusFilter: null,
    triageConfidence: null,
    triageReason: null,
    triageMappedHelper: null,
    triageEligibilityAllowed: null,
    triageEligibilityReason: null,
    groundingKind: null,
    sources: [],
    createdAt: "2026-05-06T06:38:00.000Z",
    ...overrides,
  };
}

test("buildSupportThreadCsv exports one row per message with UTF-8 BOM", () => {
  const csv = buildSupportThreadCsv({
    thread,
    messages: [
      message({
        id: "message-1",
        role: "user",
        text: "Hallo, ich habe eine Zahlungsfrage.",
      }),
      message({
        id: "message-2",
        role: "assistant",
        text: "Welche Buchung meinst du?",
        disposition: "uncertain",
        triageIntent: "account_candidate_lookup",
        triageTopic: "booking",
        triageStatusFilter: "scheduled",
        triageConfidence: "high",
        triageMappedHelper: "getOrderStatusForCurrentUser",
        triageEligibilityAllowed: true,
        groundingKind: "account_safe_dto",
      }),
    ],
  });

  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines.length, 3);
  assert.match(lines.at(0) ?? "", /"thread_id","thread_locale"/);
  assert.match(lines.at(1) ?? "", /"user"/);
  assert.match(lines.at(2) ?? "", /"assistant"/);
  assert.match(lines.at(2) ?? "", /"account_candidate_lookup"/);
});

test("buildSupportThreadCsv escapes quotes commas and newlines", () => {
  const csv = buildSupportThreadCsv({
    thread,
    messages: [
      message({
        id: "message-1",
        role: "user",
        text: 'Line 1, with comma\nLine 2 with "quote"',
      }),
    ],
  });

  assert.match(csv, /"Line 1, with comma\nLine 2 with ""quote"""/);
});

test("buildSupportThreadCsv prefixes formula-like cells", () => {
  const csv = buildSupportThreadCsv({
    thread,
    messages: [
      message({
        id: "message-1",
        role: "user",
        text: '=HYPERLINK("https://bad.example")',
      }),
    ],
  });

  assert.match(csv, /"'=HYPERLINK\(""https:\/\/bad\.example""\)"/);
});

test("buildSupportThreadCsv summarizes account context and sources safely", () => {
  const csv = buildSupportThreadCsv({
    thread,
    messages: [
      message({
        id: "message-1",
        role: "assistant",
        text: "I found candidate orders.",
        disposition: "uncertain",
        accountContextSnapshots: [
          {
            kind: "candidate_selection",
            helper: "getOrderStatusForCurrentUser",
            resultCategory: "order_candidates",
            statusFilter: "scheduled",
            orders: [
              {
                orderId: "internal-order-id",
                referenceType: "order_id",
                referenceId: "internal-order-id",
                displayReference: "react_jedi - 14 Apr 2026",
                label: null,
                description: "scheduled - payment pending",
                providerDisplayName: "Provider",
                serviceNames: ["Cleaning"],
                firstSlotStart: "2026-04-14T10:00:00.000Z",
                createdAt: "2026-04-10T10:00:00.000Z",
                serviceStatusCategory: "scheduled",
                paymentStatusCategory: "payment_pending",
                invoiceStatusCategory: null,
                nextStepKey: null,
              },
            ],
          },
        ],
        sources: [
          {
            documentId: "booking-payment-policy",
            documentVersion: "v1",
            chunkId: "chunk-1",
            sectionId: "booking-customer-requirements",
            sectionTitle: "Requirements",
            sourceType: "policy-summary",
            sourceLocale: "en",
            score: 10,
            matchedTerms: ["booking"],
          },
        ],
      }),
    ],
  });

  assert.match(csv, /candidate_selection: filter: scheduled/);
  assert.match(csv, /react_jedi - 14 Apr 2026/);
  assert.match(csv, /booking-payment-policy:booking-customer-requirements/);
  assert.doesNotMatch(csv, /internal-order-id/);
});

test("supportThreadCsvFilename uses locale thread prefix and timestamp", () => {
  assert.equal(
    supportThreadCsvFilename(
      { thread, messages: [] },
      new Date(2026, 4, 6, 6, 42),
    ),
    "support-chat-de-2c4f7f0a-20260506-0642.csv",
  );
});
