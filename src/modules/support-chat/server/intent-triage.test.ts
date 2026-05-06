import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeSupportConversationMemory } from "@/modules/support-chat/lib/conversation-memory";
import { parseSupportIntentTriageResult } from "./intent-triage";

test("parseSupportIntentTriageResult accepts valid strict JSON", () => {
  assert.deepEqual(
    parseSupportIntentTriageResult(
      '{"intent":"account_candidate_lookup","topic":"cancellation","statusFilter":"scheduled","confidence":"high","reason":"User asks about their own scheduled booking."}',
    ),
    {
      intent: "account_candidate_lookup",
      topic: "cancellation",
      statusFilter: "scheduled",
      confidence: "high",
      reason: "User asks about their own scheduled booking.",
    },
  );
});

test("parseSupportIntentTriageResult rejects invalid enum fields", () => {
  assert.equal(
    parseSupportIntentTriageResult(
      '{"intent":"lookup_orders","topic":"cancellation","confidence":"high"}',
    ),
    null,
  );
  assert.equal(
    parseSupportIntentTriageResult(
      '{"intent":"account_candidate_lookup","topic":"orders","confidence":"high"}',
    ),
    null,
  );
  assert.equal(
    parseSupportIntentTriageResult(
      '{"intent":"account_candidate_lookup","topic":"cancellation","confidence":"certain"}',
    ),
    null,
  );
  assert.equal(
    parseSupportIntentTriageResult(
      '{"intent":"account_candidate_lookup","topic":"booking","statusFilter":"tomorrow","confidence":"high"}',
    ),
    null,
  );
});

test("parseSupportIntentTriageResult rejects prose without JSON", () => {
  assert.equal(
    parseSupportIntentTriageResult("This looks like a cancellation question."),
    null,
  );
});

test("parseSupportIntentTriageResult accepts embedded JSON intentionally", () => {
  assert.deepEqual(
    parseSupportIntentTriageResult(
      'Sure: {"intent":"clarify","confidence":"low"}',
    ),
    {
      intent: "clarify",
      topic: undefined,
      statusFilter: undefined,
      confidence: "low",
      reason: undefined,
    },
  );
});

test("parseSupportIntentTriageResult rejects helper names as intents", () => {
  assert.equal(
    parseSupportIntentTriageResult(
      '{"intent":"canCancelOrderForCurrentUser","topic":"cancellation","confidence":"high"}',
    ),
    null,
  );
});

test("parseSupportIntentTriageResult rejects extra helper fields", () => {
  assert.equal(
    parseSupportIntentTriageResult(
      '{"intent":"account_candidate_lookup","topic":"cancellation","confidence":"high","helper":"canCancelOrderForCurrentUser"}',
    ),
    null,
  );
});

test("parseSupportIntentTriageResult rejects arbitrary DB-style fields", () => {
  for (const payload of [
    {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "scheduled",
      confidence: "high",
      orderId: "100000000000000000000001",
    },
    {
      intent: "account_candidate_lookup",
      topic: "payment",
      statusFilter: "paid",
      confidence: "high",
      dbQuery: { collection: "orders" },
    },
    {
      intent: "account_candidate_lookup",
      topic: "booking",
      statusFilter: "scheduled",
      confidence: "high",
      filters: { tenant: "any" },
    },
  ]) {
    assert.equal(parseSupportIntentTriageResult(JSON.stringify(payload)), null);
  }
});

test("parseSupportIntentTriageResult accepts none and not_applicable", () => {
  assert.deepEqual(
    parseSupportIntentTriageResult(
      '{"intent":"not_applicable","confidence":"low","reason":"Not a support request."}',
    ),
    {
      intent: "not_applicable",
      topic: undefined,
      statusFilter: undefined,
      confidence: "low",
      reason: "Not a support request.",
    },
  );
});

test("parseSupportIntentTriageResult rejects long reasons", () => {
  assert.equal(
    parseSupportIntentTriageResult(
      JSON.stringify({
        intent: "general_support",
        confidence: "high",
        reason: "x".repeat(301),
      }),
    ),
    null,
  );
});

test("sanitizeSupportConversationMemory keeps only short safe hints", () => {
  const memory = sanitizeSupportConversationMemory({
    previousUserMessage: ` ${"u".repeat(600)} `,
    previousAssistantMessage: ` ${"a".repeat(1200)} `,
    activeTopic: "booking",
    hasSelectedOrderContext: true,
    lastAssistantAskedForSelection: true,
  });

  assert.equal(memory?.previousUserMessage?.length, 500);
  assert.equal(memory?.previousAssistantMessage?.length, 1000);
  assert.equal(memory?.activeTopic, "booking");
  assert.equal(memory?.hasSelectedOrderContext, true);
  assert.equal(memory?.lastAssistantAskedForSelection, true);
});

test("sanitizeSupportConversationMemory drops empty memory", () => {
  assert.equal(
    sanitizeSupportConversationMemory({
      previousUserMessage: "   ",
      previousAssistantMessage: "\n\t",
      hasSelectedOrderContext: false,
      lastAssistantAskedForSelection: false,
    }),
    undefined,
  );
});
