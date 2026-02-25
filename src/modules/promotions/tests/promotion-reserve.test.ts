import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { getPayload } from "payload";
import { reserveFirstNPromotion } from "../../checkout/server/promotion-reserve.ts";
import { buildPromotionCounterKey } from "../server/counter-key.ts";
import type { TRPCContext } from "../../../trpc/init.ts";

// Local test bootstrap: prefer .env.local, then fall back to .env.
loadEnv({ path: ".env.local" });
loadEnv();
process.env.PAYLOAD_SECRET ??= "test-payload-secret";

type TestPayload = Awaited<ReturnType<typeof getPayload>>;
let payloadPromise: Promise<TestPayload> | null = null;
const createdPromotionIds = new Set<string>();

async function getTestPayload(): Promise<TestPayload> {
  if (!payloadPromise) {
    payloadPromise = (async () => {
      const { default: config } = await import("../../../payload.config.ts");
      return getPayload({ config });
    })();
  }
  return payloadPromise;
}

function makeTestContext(payload: TestPayload): TRPCContext {
  return { db: payload } as unknown as TRPCContext;
}

after(async () => {
  if (!payloadPromise) return;
  const payload = await payloadPromise;
  try {
    for (const promotionId of createdPromotionIds) {
      const allocations = await payload.find({
        collection: "promotion_allocations",
        where: { promotion: { equals: promotionId } },
        overrideAccess: true,
        depth: 0,
        limit: 500,
      });

      for (const doc of allocations.docs) {
        await payload.delete({
          collection: "promotion_allocations",
          id: String(doc.id),
          overrideAccess: true,
        });
      }

      const counters = await payload.find({
        collection: "promotion_counters",
        where: { promotion: { equals: promotionId } },
        overrideAccess: true,
        depth: 0,
        limit: 500,
      });

      for (const doc of counters.docs) {
        await payload.delete({
          collection: "promotion_counters",
          id: String(doc.id),
          overrideAccess: true,
        });
      }

      try {
        await payload.delete({
          collection: "promotions",
          id: promotionId,
          overrideAccess: true,
        });
      } catch {
        // Ignore already-removed test records.
      }
    }
  } finally {
    createdPromotionIds.clear();
    if (typeof payload.db.destroy === "function") {
      await payload.db.destroy();
    }
  }
});

test("reserveFirstNPromotion: limit=1 allows exactly one winner under race", async () => {
  const payload = await getTestPayload();

  const promo = await payload.create({
    collection: "promotions",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `test-first-n-race-${randomUUID()}`,
      active: true,
      type: "first_n",
      scope: "global",
      priority: 100,
      rateBps: 0,
      currency: "eur",
      firstNLimit: 1,
      firstNScope: "global",
    },
  });
  createdPromotionIds.add(String(promo.id));

  const ctx = makeTestContext(payload);
  const ruleId = `promo:${promo.id}`;

  const [a, b] = await Promise.all([
    reserveFirstNPromotion(ctx, {
      promotionId: String(promo.id),
      reservationKey: randomUUID(),
      firstNScope: "global",
      limit: 1,
      appliedRateBps: 0,
      appliedRuleId: ruleId,
    }),
    reserveFirstNPromotion(ctx, {
      promotionId: String(promo.id),
      reservationKey: randomUUID(),
      firstNScope: "global",
      limit: 1,
      appliedRateBps: 0,
      appliedRuleId: ruleId,
    }),
  ]);

  const successes = [a, b].filter((r) => r.ok).length;
  const limitReached = [a, b].filter(
    (r) => !r.ok && r.reason === "limit_reached",
  ).length;

  assert.equal(successes, 1);
  assert.equal(limitReached, 1);

  const counterKey = buildPromotionCounterKey({
    promotionId: String(promo.id),
    firstNScope: "global",
  });

  const counters = await payload.find({
    collection: "promotion_counters",
    where: { counterKey: { equals: counterKey } },
    overrideAccess: true,
    depth: 0,
    limit: 1,
  });
  assert.equal((counters.docs?.[0] as { used?: number } | undefined)?.used ?? 0, 1);

  const allocations = await payload.find({
    collection: "promotion_allocations",
    where: { promotion: { equals: String(promo.id) } },
    overrideAccess: true,
    depth: 0,
    limit: 10,
  });
  assert.equal(allocations.docs.length, 1);
});

test("reserveFirstNPromotion: rollback leaves used unchanged if allocation insert fails", async () => {
  const payload = await getTestPayload();

  const promo = await payload.create({
    collection: "promotions",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `test-first-n-rollback-${randomUUID()}`,
      active: true,
      type: "first_n",
      scope: "global",
      priority: 100,
      rateBps: 0,
      currency: "eur",
      firstNLimit: 1,
      firstNScope: "global",
    },
  });
  createdPromotionIds.add(String(promo.id));

  type CreateArgs = Parameters<typeof payload.create>[0];
  type CreateResult = ReturnType<typeof payload.create>;
  const mutablePayload = payload as unknown as {
    create: (args: CreateArgs) => CreateResult;
  };
  const originalCreate = mutablePayload.create.bind(mutablePayload);
  mutablePayload.create = (async (args: CreateArgs) => {
    if (args.collection === "promotion_allocations") {
      throw new Error("injected-allocation-failure");
    }
    return originalCreate(args);
  }) as (args: CreateArgs) => CreateResult;

  try {
    const result = await reserveFirstNPromotion(
      makeTestContext(payload),
      {
        promotionId: String(promo.id),
        reservationKey: randomUUID(),
        firstNScope: "global",
        limit: 1,
        appliedRateBps: 0,
        appliedRuleId: `promo:${promo.id}`,
      },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "error");
  } finally {
    mutablePayload.create = originalCreate;
  }

  const counterKey = buildPromotionCounterKey({
    promotionId: String(promo.id),
    firstNScope: "global",
  });

  const counters = await payload.find({
    collection: "promotion_counters",
    where: { counterKey: { equals: counterKey } },
    overrideAccess: true,
    depth: 0,
    limit: 1,
  });
  assert.equal((counters.docs?.[0] as { used?: number } | undefined)?.used ?? 0, 0);

  const allocations = await payload.find({
    collection: "promotion_allocations",
    where: { promotion: { equals: String(promo.id) } },
    overrideAccess: true,
    depth: 0,
    limit: 10,
  });
  assert.equal(allocations.docs.length, 0);
});
