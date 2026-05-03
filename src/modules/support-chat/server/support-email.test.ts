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

function fakeDb(input: {
  user: Record<string, unknown>;
  tenants?: Array<Record<string, unknown>>;
}) {
  return {
    find: async (args: { collection: string }) => {
      if (args.collection === "users") return { docs: [input.user] };
      if (args.collection === "tenants") return { docs: input.tenants ?? [] };
      return { docs: [] };
    },
  } as unknown as Payload;
}

test("support email sends to configured inbox with registered user reply-to", async () => {
  const sent: SendEmailArgs[] = [];

  const result = await sendSupportEmailHandoff({
    db: fakeDb({
      user: {
        id: "payload-user-1",
        email: "USER@example.COM ",
        firstName: "Valentyn",
        lastName: "Kasyan",
        username: "valentyn",
        roles: ["user"],
        language: "en",
        country: "Germany",
        coordinates: {
          city: "Frankfurt am Main",
          region: "Hessen",
          postalCode: "60311",
        },
      },
    }),
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
  assert.equal(sent[0]?.subject, "Support request from Valentyn Kasyan");
  assert.match(sent[0]?.text ?? "", /Payload user ID: payload-user-1/);
  assert.match(sent[0]?.text ?? "", /First name: Valentyn/);
  assert.match(sent[0]?.text ?? "", /City: Frankfurt am Main/);
  assert.match(sent[0]?.html ?? "", /<h3>User profile<\/h3>/);
  assert.match(sent[0]?.text ?? "", /Current URL: http:\/\/localhost:3000\/en\/orders/);
  assert.ok(
    (sent[0]?.text ?? "").indexOf("Message:") <
      (sent[0]?.text ?? "").indexOf("User profile:"),
  );
  assert.ok(
    (sent[0]?.html ?? "").indexOf("<h3>Message</h3>") <
      (sent[0]?.html ?? "").indexOf("<h3>User profile</h3>"),
  );
});

test("support email rejects missing registered account email", async () => {
  const result = await sendSupportEmailHandoff({
    db: fakeDb({ user: { id: "payload-user-1", email: "" } }),
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
    db: fakeDb({ user: { id: "payload-user-1", email: "user@example.com" } }),
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

test("support email subject falls back to username when full name is missing", async () => {
  const sent: SendEmailArgs[] = [];

  await sendSupportEmailHandoff({
    db: fakeDb({
      user: {
        id: "payload-user-1",
        email: "user@example.com",
        username: "react_jedi",
      },
    }),
    clerkUserId: "user_123",
    message: "Please help me with this support request.",
    locale: "en",
    sendEmailImpl: async (args) => {
      sent.push(args);
      return { status: "sent" };
    },
  });

  assert.equal(sent[0]?.subject, "Support request from react_jedi");
  assert.match(sent[0]?.text ?? "", /^Support request from react_jedi/);
});

test("support email does not fail when selected order token is invalid", async () => {
  const sent: SendEmailArgs[] = [];

  const result = await sendSupportEmailHandoff({
    db: fakeDb({ user: { id: "payload-user-1", email: "user@example.com" } }),
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
  assert.doesNotMatch(sent[0]?.text ?? "", /Selected order:/);
});

test("support email includes curated tenant profile rows for vendor users", async () => {
  const sent: SendEmailArgs[] = [];

  await sendSupportEmailHandoff({
    db: fakeDb({
      user: { id: "payload-user-1", email: "user@example.com" },
      tenants: [
        {
          id: "tenant-1",
          name: "valentisimo",
          slug: "react_jedi",
          country: "DE",
          hourlyRate: 1,
          services: ["on-site", "on-line"],
          categories: [{ name: "Furniture Assembly", slug: "furniture" }],
          subcategories: [
            { name: "Mounting & Disassembly", slug: "mounting" },
          ],
          phone: "+49123456789",
          website: "https://example.com",
          onboardingStatus: "completed",
          stripeDetailsSubmitted: true,
          chargesEnabled: true,
          payoutsEnabled: false,
          vatRegistered: true,
          vatIdValid: true,
          stripeRequirements: { currently_due: ["external_account"] },
          stripeAccountId: "acct_secret",
          vatId: "DE123456789",
        },
      ],
    }),
    clerkUserId: "user_123",
    message: "Please help me with my provider profile.",
    locale: "en",
    sendEmailImpl: async (args) => {
      sent.push(args);
      return { status: "sent" };
    },
  });

  const text = sent[0]?.text ?? "";
  const html = sent[0]?.html ?? "";
  assert.match(text, /Service provider profile: valentisimo/);
  assert.match(text, /Tenant slug: react_jedi/);
  assert.match(text, /Hourly rate: EUR 1/);
  assert.match(text, /Services: on-site, on-line/);
  assert.match(text, /Categories: Furniture Assembly/);
  assert.match(text, /Payouts enabled: No/);
  assert.match(html, /<h3>Service provider profile: valentisimo<\/h3>/);
  assert.doesNotMatch(text, /acct_secret/);
  assert.doesNotMatch(text, /external_account/);
  assert.doesNotMatch(text, /DE123456789/);
  assert.doesNotMatch(html, /acct_secret/);
  assert.doesNotMatch(html, /external_account/);
  assert.doesNotMatch(html, /DE123456789/);
});

test("support email rate limiter blocks after five attempts", () => {
  const key = `user:test-rate-limit-${Date.now()}-${Math.random()}`;

  for (let index = 0; index < 5; index += 1) {
    assert.equal(checkSupportEmailRateLimit(key).allowed, true);
  }

  assert.equal(checkSupportEmailRateLimit(key).allowed, false);
});
