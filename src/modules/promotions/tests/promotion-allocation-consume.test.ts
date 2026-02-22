import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { getPayload } from "payload";
import { consumePromotionAllocationIfReserved } from "../server/allocation-consume.ts";
import { buildPromotionCounterKey } from "../server/counter-key.ts";

loadEnv({ path: ".env.local" });
loadEnv();
process.env.PAYLOAD_SECRET ??= "test-payload-secret";

type TestPayload = Awaited<ReturnType<typeof getPayload>>;
let payloadPromise: Promise<TestPayload> | null = null;
const createdPromotionIds = new Set<string>();
const createdAllocationIds = new Set<string>();

async function getTestPayload(): Promise<TestPayload> {
  if (!payloadPromise) {
    payloadPromise = (async () => {
      const { default: config } = await import("../../../payload.config.ts");
      return getPayload({ config });
    })();
  }
  return payloadPromise;
}

after(async () => {
  if (!payloadPromise) return;
  const payload = await payloadPromise;
  try {
    for (const allocationId of createdAllocationIds) {
      try {
        await payload.delete({
          collection: "promotion_allocations",
          id: allocationId,
          overrideAccess: true,
        });
      } catch {
        // Ignore already-cleaned records.
      }
    }

    for (const promotionId of createdPromotionIds) {
      try {
        await payload.delete({
          collection: "promotions",
          id: promotionId,
          overrideAccess: true,
        });
      } catch {
        // Ignore already-cleaned records.
      }
    }
  } finally {
    createdAllocationIds.clear();
    createdPromotionIds.clear();
    if (typeof payload.db.destroy === "function") {
      await payload.db.destroy();
    }
  }
});

test("consumePromotionAllocationIfReserved consumes once and is idempotent on retry", async () => {
  const payload = await getTestPayload();

  const promo = await payload.create({
    collection: "promotions",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `test-allocation-consume-${randomUUID()}`,
      active: true,
      type: "first_n",
      scope: "global",
      priority: 100,
      rateBps: 100,
      currency: "eur",
      firstNLimit: 1,
      firstNScope: "global",
    },
  });
  const promotionId = String(promo.id);
  createdPromotionIds.add(promotionId);

  const allocation = await payload.create({
    collection: "promotion_allocations",
    overrideAccess: true,
    depth: 0,
    data: {
      promotion: promotionId,
      counterKey: buildPromotionCounterKey({
        promotionId,
        firstNScope: "global",
      }),
      reservationKey: `test-reservation:${randomUUID()}`,
      status: "reserved",
      reservedAt: new Date().toISOString(),
      appliedRateBps: 100,
      appliedRuleId: `promo:${promotionId}`,
    },
  });
  const allocationId = String(allocation.id);
  createdAllocationIds.add(allocationId);

  const first = await consumePromotionAllocationIfReserved({
    payload,
    // Relationship ids are ObjectId-like in this project; reuse allocation id format.
    invoiceId: allocationId,
    invoicePromotionAllocationId: allocationId,
    stripeCheckoutSessionId: `cs_test_${randomUUID()}`,
    stripePaymentIntentId: `pi_test_${randomUUID()}`,
    consumedAt: new Date().toISOString(),
  });

  assert.equal(first.allocationId, allocationId);

  const afterFirst = await payload.findByID({
    collection: "promotion_allocations",
    id: allocationId,
    depth: 0,
    overrideAccess: true,
  });
  assert.equal(afterFirst.status, "consumed");
  const firstPi = afterFirst.stripePaymentIntentId ?? null;
  assert.equal(typeof firstPi, "string");

  const second = await consumePromotionAllocationIfReserved({
    payload,
    invoiceId: allocationId,
    invoicePromotionAllocationId: allocationId,
    stripeCheckoutSessionId: `cs_test_${randomUUID()}`,
    stripePaymentIntentId: `pi_test_${randomUUID()}`,
    consumedAt: new Date().toISOString(),
  });

  assert.equal(second.allocationId, allocationId);
  if (second.updatedCount != null) {
    assert.equal(second.updatedCount, 0);
  }

  const afterSecond = await payload.findByID({
    collection: "promotion_allocations",
    id: allocationId,
    depth: 0,
    overrideAccess: true,
  });
  assert.equal(afterSecond.status, "consumed");
  assert.equal(afterSecond.stripePaymentIntentId ?? null, firstPi);
});
