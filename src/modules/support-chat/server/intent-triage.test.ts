import test from "node:test";
import assert from "node:assert/strict";

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
