import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeSupportConversationMemory } from "@/modules/support-chat/lib/conversation-memory";
import { parseSupportIntentTriageResult } from "./intent-triage";

test("parseSupportIntentTriageResult accepts valid strict JSON", () => {
  assert.deepEqual(
    parseSupportIntentTriageResult(
      '{"intent":"account_candidate_lookup","topic":"cancellation","confidence":"high"}',
    ),
    {
      intent: "account_candidate_lookup",
      topic: "cancellation",
      confidence: "high",
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
      confidence: "low",
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

test("parseSupportIntentTriageResult ignores extra helper fields", () => {
  assert.deepEqual(
    parseSupportIntentTriageResult(
      '{"intent":"account_candidate_lookup","topic":"cancellation","confidence":"high","helper":"canCancelOrderForCurrentUser"}',
    ),
    {
      intent: "account_candidate_lookup",
      topic: "cancellation",
      confidence: "high",
    },
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
