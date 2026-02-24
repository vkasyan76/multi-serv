import test from "node:test";
import assert from "node:assert/strict";
import type { Payload } from "payload";
import { getReferralPromoForTenantEmail } from "../server/referral-promo-for-tenant.ts";

type PromotionDoc = {
  id: string;
  type?: "first_n" | "time_window_rate" | null;
  priority?: number | null;
  rateBps?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
};

function makePayloadWithDocs(docs: PromotionDoc[], onFind?: (args: unknown) => void) {
  return {
    find: async (args: unknown) => {
      onFind?.(args);
      return { docs };
    },
  } as unknown as Payload;
}

test("getReferralPromoForTenantEmail normalizes code, respects end-exclusive window, and picks highest priority", async () => {
  const nowIso = "2026-03-01T12:00:00.000Z";
  let capturedFindArgs: unknown = null;

  const payload = makePayloadWithDocs(
    [
      {
        id: "expired-now",
        type: "time_window_rate",
        priority: 999,
        rateBps: 100,
        startsAt: "2026-03-01T00:00:00.000Z",
        endsAt: nowIso, // end-exclusive => not eligible at exactly now
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "winner",
        type: "first_n",
        priority: 200,
        rateBps: 300,
        startsAt: "2026-03-01T00:00:00.000Z",
        endsAt: "2026-03-02T00:00:00.000Z",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "lower",
        type: "time_window_rate",
        priority: 100,
        rateBps: 500,
        startsAt: "2026-03-01T00:00:00.000Z",
        endsAt: "2026-03-02T00:00:00.000Z",
        createdAt: "2026-01-03T00:00:00.000Z",
      },
    ],
    (args) => {
      capturedFindArgs = args;
    },
  );

  const result = await getReferralPromoForTenantEmail({
    payload,
    referralCodeForTenant: "  test   code  ",
    nowIso,
  });

  assert.ok(result);
  assert.equal(result?.id, "winner");
  assert.equal(result?.type, "first_n");
  assert.equal(result?.rateBps, 300);

  const where = (capturedFindArgs as { where?: { and?: Array<Record<string, unknown>> } })
    ?.where;
  const referralClause = where?.and?.find((clause) => "referralCode" in clause) as
    | { referralCode?: { equals?: string } }
    | undefined;
  assert.equal(referralClause?.referralCode?.equals, "TEST-CODE");
});

test("getReferralPromoForTenantEmail tie-breaks by earliest createdAt, then id", async () => {
  const nowIso = "2026-03-01T12:00:00.000Z";

  const payload = makePayloadWithDocs([
    {
      id: "b-id",
      type: "time_window_rate",
      priority: 300,
      rateBps: 100,
      startsAt: "2026-03-01T00:00:00.000Z",
      endsAt: "2026-03-02T00:00:00.000Z",
      createdAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "a-id",
      type: "first_n",
      priority: 300,
      rateBps: 200,
      startsAt: "2026-03-01T00:00:00.000Z",
      endsAt: "2026-03-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);

  const result = await getReferralPromoForTenantEmail({
    payload,
    referralCodeForTenant: "ref2026",
    nowIso,
  });

  assert.ok(result);
  assert.equal(result?.id, "a-id");

  const payloadSameCreatedAt = makePayloadWithDocs([
    {
      id: "b-id",
      type: "time_window_rate",
      priority: 300,
      rateBps: 100,
      startsAt: "2026-03-01T00:00:00.000Z",
      endsAt: "2026-03-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "a-id",
      type: "first_n",
      priority: 300,
      rateBps: 200,
      startsAt: "2026-03-01T00:00:00.000Z",
      endsAt: "2026-03-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);

  const fallbackResult = await getReferralPromoForTenantEmail({
    payload: payloadSameCreatedAt,
    referralCodeForTenant: "ref2026",
    nowIso,
  });

  assert.ok(fallbackResult);
  assert.equal(fallbackResult?.id, "a-id");
});

test("getReferralPromoForTenantEmail returns null when promo fields are invalid", async () => {
  const payload = makePayloadWithDocs([
    {
      id: "invalid-rate",
      type: "time_window_rate",
      priority: 100,
      rateBps: 12.5, // invalid: must be integer bps
      startsAt: "2026-03-01T00:00:00.000Z",
      endsAt: "2026-03-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "invalid-type",
      type: null,
      priority: 200,
      rateBps: 100,
      startsAt: "2026-03-01T00:00:00.000Z",
      endsAt: "2026-03-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:01.000Z",
    },
  ]);

  const result = await getReferralPromoForTenantEmail({
    payload,
    referralCodeForTenant: "ref2026",
    nowIso: "2026-03-01T12:00:00.000Z",
  });

  assert.equal(result, null);
});
