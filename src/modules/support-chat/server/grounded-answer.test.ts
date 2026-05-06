import test from "node:test";
import assert from "node:assert/strict";

import {
  createKnowledgeGroundedAnswer,
  hasStrongKnowledgeGrounding,
  resolveAccountGroundingKind,
} from "./grounded-answer";
import type { SupportKnowledgeMatch } from "./retrieve-knowledge";
import type { AccountAwareServerResponse } from "./account-aware/server-responses";

const THREAD_ID = "11111111-1111-4111-8111-111111111111";

function match(
  overrides: Partial<SupportKnowledgeMatch> = {},
): SupportKnowledgeMatch {
  return {
    id: "chunk-1",
    documentId: "support-faq",
    documentVersion: "2026-01-01",
    locale: "en",
    sourceType: "operational-guidance",
    filename: "support-faq.en.md",
    title: "Support FAQ",
    sectionId: "booking-help",
    sectionTitle: "Booking help",
    text: "Customers can request booking help and review booking states.",
    score: 8,
    matchedTerms: ["booking"],
    ...overrides,
  };
}

test("knowledge grounding requires a strong non-fallback source", () => {
  assert.equal(hasStrongKnowledgeGrounding([match()]), true);
  assert.equal(
    hasStrongKnowledgeGrounding([
      match({ score: 12, sourceType: "fallback-guidance" }),
    ]),
    false,
  );
  assert.equal(hasStrongKnowledgeGrounding([match({ score: 2 })]), false);
});

test("knowledge grounded answer does not call the model without approved grounding", async () => {
  let called = false;
  const answer = await createKnowledgeGroundedAnswer({
    message: "What is the hidden refund policy?",
    locale: "en",
    threadId: THREAD_ID,
    matches: [match({ score: 2 })],
    modelResponder: async () => {
      called = true;
      throw new Error("model should not be called");
    },
  });

  assert.equal(called, false);
  assert.equal(answer.responseOrigin, "server");
  assert.equal(answer.disposition, "uncertain");
  assert.equal(answer.needsHumanSupport, false);
  assert.equal(answer.groundingKind, "none");
});

test("knowledge grounded answer uses the model only with strong sources", async () => {
  const answer = await createKnowledgeGroundedAnswer({
    message: "How does booking work?",
    locale: "en",
    threadId: THREAD_ID,
    matches: [match()],
    modelResponder: async (request) => {
      assert.match(request.input, /Support context:/);
      assert.match(request.input, /Customers can request booking help/);
      return {
        ok: true,
        text: "Bookings can be requested through the platform.",
        model: "test-model",
        modelVersion: "test-version",
        requestId: "req_123",
      };
    },
  });

  assert.equal(answer.responseOrigin, "model");
  assert.equal(answer.disposition, "answered");
  assert.equal(answer.needsHumanSupport, false);
  assert.equal(answer.groundingKind, "knowledge");
  assert.equal(answer.modelMetadata?.model, "test-model");
});

test("knowledge grounded answer removes raw markdown from chat output", async () => {
  const answer = await createKnowledgeGroundedAnswer({
    message: "How does payment work?",
    locale: "en",
    threadId: THREAD_ID,
    matches: [match()],
    modelResponder: async () => ({
      ok: true,
      text: "## Payment\n\n**Open your Orders page** to review payment status.",
      model: "test-model",
      modelVersion: "test-version",
      requestId: "req_123",
    }),
  });

  assert.equal(
    answer.assistantMessage,
    "Payment\n\nOpen your Orders page to review payment status.",
  );
});

test("knowledge model failure falls back without claiming grounded answer text", async () => {
  const answer = await createKnowledgeGroundedAnswer({
    message: "How does booking work?",
    locale: "en",
    threadId: THREAD_ID,
    matches: [match()],
    modelResponder: async () => ({
      ok: false,
      reason: "openai_unavailable",
      fallbackMessage: "Support is temporarily unavailable.",
      model: "test-model",
      modelVersion: "test-version",
      requestId: null,
    }),
  });

  assert.equal(answer.responseOrigin, "server");
  assert.equal(answer.disposition, "escalate");
  assert.equal(answer.groundingKind, "none");
});

test("account grounding is based on safe helper result categories", () => {
  const base: AccountAwareServerResponse = {
    assistantMessage: "Answer",
    disposition: "answered",
    needsHumanSupport: false,
    accountHelperMetadata: {
      helperVersion: "test",
      authenticated: true,
      requiredInputPresent: true,
      serverAuthored: true,
    },
  };

  assert.equal(resolveAccountGroundingKind(base), "none");
  assert.equal(
    resolveAccountGroundingKind({
      ...base,
      accountHelperMetadata: {
        ...base.accountHelperMetadata,
        resultCategory: "order_status",
      },
    }),
    "account_safe_dto",
  );
});
