import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import type { Payload } from "payload";
import type { SendEmailArgs } from "@/modules/email/types";
import { createSelectedOrderContextToken } from "@/modules/support-chat/server/account-aware/action-tokens";
import { checkSupportEmailRateLimit } from "./support-email-rate-limit";
import { sendSupportEmailHandoff } from "./support-email";

const ORIGINAL_SUPPORT_EMAIL_TO = process.env.SUPPORT_EMAIL_TO;
const ORIGINAL_PAYLOAD_SECRET = process.env.PAYLOAD_SECRET;

beforeEach(() => {
  process.env.SUPPORT_EMAIL_TO = "info@infinisimo.com";
  process.env.PAYLOAD_SECRET = "support-email-test-secret";
});

afterEach(() => {
  if (ORIGINAL_SUPPORT_EMAIL_TO === undefined) {
    delete process.env.SUPPORT_EMAIL_TO;
  } else {
    process.env.SUPPORT_EMAIL_TO = ORIGINAL_SUPPORT_EMAIL_TO;
  }

  if (ORIGINAL_PAYLOAD_SECRET === undefined) {
    delete process.env.PAYLOAD_SECRET;
  } else {
    process.env.PAYLOAD_SECRET = ORIGINAL_PAYLOAD_SECRET;
  }
});

function fakeDb(user: { id?: string; email?: string | null }) {
  return {
    find: async () => ({ docs: [user] }),
  } as unknown as Payload;
}

test("support email sends to configured inbox with registered user reply-to", async () => {
  const sent: SendEmailArgs[] = [];

  const result = await sendSupportEmailHandoff({
    db: fakeDb({ id: "payload-user-1", email: "USER@example.COM " }),
    clerkUserId: "user_123",
    message: "Please help me with this support request.",
    locale: "en",
    threadId: "11111111-1111-4111-8111-111111111111",
    currentUrl: "http://localhost:3000/en/orders",
    sendEmailImpl: async (args) => {
      sent.push(args);
      return { status: "sent", providerMessageId: "email_123" };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    result: { status: "sent", providerMessageId: "email_123" },
  });
  assert.equal(sent[0]?.to, "info@infinisimo.com");
  assert.equal(sent[0]?.replyTo, "user@example.com");
  assert.match(sent[0]?.text ?? "", /Payload user ID: payload-user-1/);
  assert.match(sent[0]?.text ?? "", /Current URL: http:\/\/localhost:3000\/en\/orders/);
});

test("support email rejects missing registered account email", async () => {
  const result = await sendSupportEmailHandoff({
    db: fakeDb({ id: "payload-user-1", email: "" }),
    clerkUserId: "user_123",
    message: "Please help me with this support request.",
    locale: "en",
    sendEmailImpl: async () => {
      throw new Error("sender should not be called");
    },
  });

  assert.deepEqual(result, { ok: false, reason: "missing_user_email" });
});

test("support email includes verified selected order metadata only when token verifies", async () => {
  const sent: SendEmailArgs[] = [];
  const token = createSelectedOrderContextToken({
    reference: "100000000000000000000001",
    threadId: "11111111-1111-4111-8111-111111111111",
    displayLabel: "react_jedi - 14 Apr 2026",
  });

  await sendSupportEmailHandoff({
    db: fakeDb({ id: "payload-user-1", email: "user@example.com" }),
    clerkUserId: "user_123",
    message: "Please help me with this selected order.",
    locale: "en",
    threadId: "11111111-1111-4111-8111-111111111111",
    selectedOrderContext: { type: "selected_order", token },
    sendEmailImpl: async (args) => {
      sent.push(args);
      return { status: "sent" };
    },
  });

  assert.match(sent[0]?.text ?? "", /Selected order:/);
  assert.match(sent[0]?.text ?? "", /Reference: 100000000000000000000001/);
  assert.match(sent[0]?.text ?? "", /Label: react_jedi - 14 Apr 2026/);
});

test("support email does not fail when selected order token is invalid", async () => {
  const sent: SendEmailArgs[] = [];

  const result = await sendSupportEmailHandoff({
    db: fakeDb({ id: "payload-user-1", email: "user@example.com" }),
    clerkUserId: "user_123",
    message: "Please help me even though the selected context is stale.",
    locale: "en",
    threadId: "11111111-1111-4111-8111-111111111111",
    selectedOrderContext: { type: "selected_order", token: "invalid-token" },
    sendEmailImpl: async (args) => {
      sent.push(args);
      return { status: "sent" };
    },
  });

  assert.equal(result.ok, true);
  assert.match(sent[0]?.text ?? "", /Selected order: not verified/);
});

test("support email rate limiter blocks after five attempts", () => {
  const key = `user:test-rate-limit-${Date.now()}-${Math.random()}`;

  for (let index = 0; index < 5; index += 1) {
    assert.equal(checkSupportEmailRateLimit(key).allowed, true);
  }

  assert.equal(checkSupportEmailRateLimit(key).allowed, false);
});
