import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { getPayload } from "payload";
import { TRPCError } from "@trpc/server";

loadEnv({ path: ".env.local" });
loadEnv();
process.env.PAYLOAD_SECRET ??= "test-payload-secret";
process.env.RESEND_API_KEY ??= "test-resend-key";
process.env.SKIP_ORDER_EMAILS ??= "1";

type TestPayload = Awaited<ReturnType<typeof getPayload>>;
type RawFindOneAndUpdate = (
  filter: Record<string, unknown>,
  update: Record<string, unknown>,
  options: Record<string, unknown>,
) => Promise<unknown>;
let payloadPromise: Promise<TestPayload> | null = null;
let raceTestFailed = false;

const createdUserIds = new Set<string>();
const createdTenantIds = new Set<string>();
const createdBookingIds = new Set<string>();
const createdOrderIds = new Set<string>();

async function getTestPayload(): Promise<TestPayload> {
  if (!payloadPromise) {
    payloadPromise = (async () => {
      const { default: config } = await import("../../../payload.config.ts");
      return getPayload({ config });
    })();
  }
  return payloadPromise;
}

async function makeOrdersCaller(payload: TestPayload, clerkUserId: string) {
  const [{ createCallerFactory }, { ordersRouter }] = await Promise.all([
    import("@/trpc/init"),
    import("../server/procedures"),
  ]);

  const createOrdersCaller = createCallerFactory(ordersRouter);
  return createOrdersCaller({
    db: payload,
    userId: clerkUserId,
    headers: {},
    appLang: "en",
    auth: null,
    authSource: "none",
  } as never);
}

function createBarrier(target: number, timeoutMs = 5000) {
  let count = 0;
  let released = false;
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;

  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const timer = setTimeout(() => {
    if (!released) {
      rejectReady(
        new Error(`cancel-race barrier timed out after ${timeoutMs}ms`),
      );
    }
  }, timeoutMs);

  return async () => {
    count += 1;
    if (count >= target && !released) {
      released = true;
      clearTimeout(timer);
      resolveReady();
    }
    await ready;
  };
}

async function createFixture(payload: TestPayload) {
  const suffix = randomUUID().slice(0, 8);
  const customerClerkId = `clerk-customer-${suffix}`;
  const tenantClerkId = `clerk-tenant-${suffix}`;

  const customer = await payload.create({
    collection: "users",
    overrideAccess: true,
    depth: 0,
    data: {
      username: `customer_${suffix}`,
      clerkUserId: customerClerkId,
      email: `customer_${suffix}@example.test`,
      roles: ["user"],
      firstName: "Test",
      lastName: "Customer",
      location: "Berlin",
      country: "DE",
      language: "en",
    },
  });
  createdUserIds.add(String(customer.id));

  const tenantUser = await payload.create({
    collection: "users",
    overrideAccess: true,
    depth: 0,
    data: {
      username: `tenant_${suffix}`,
      clerkUserId: tenantClerkId,
      email: `tenant_${suffix}@example.test`,
      roles: ["user"],
      firstName: "Test",
      lastName: "Tenant",
      location: "Berlin",
      country: "DE",
      language: "en",
    },
  });
  createdUserIds.add(String(tenantUser.id));

  const tenant = await payload.create({
    collection: "tenants",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `Test Tenant ${suffix}`,
      slug: `test-tenant-${suffix}`,
      stripeAccountId: `acct_${suffix}`,
      stripeDetailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingStatus: "completed",
      bio: "Test tenant",
      hourlyRate: 100,
      country: "DE",
      user: tenantUser.id,
    },
  });
  createdTenantIds.add(String(tenant.id));

  const start = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  // Mirror the slot-order cancelability shape: scheduled service, unpaid slot,
  // and a future confirmed booking owned by the customer.
  const booking = await payload.create({
    collection: "bookings",
    overrideAccess: true,
    depth: 0,
    data: {
      tenant: tenant.id,
      customer: customer.id,
      start: start.toISOString(),
      end: end.toISOString(),
      status: "confirmed",
      serviceStatus: "scheduled",
      paymentStatus: "unpaid",
    },
  });
  createdBookingIds.add(String(booking.id));

  const order = await payload.create({
    collection: "orders",
    overrideAccess: true,
    depth: 0,
    data: {
      status: "pending",
      serviceStatus: "scheduled",
      invoiceStatus: "none",
      user: customer.id,
      tenant: tenant.id,
      slots: [booking.id],
      amount: 10000,
      currency: "eur",
      customerSnapshot: {
        firstName: "Test",
        lastName: "Customer",
        location: "Berlin",
        country: "DE",
      },
      vendorSnapshot: {
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        stripeAccountId: tenant.stripeAccountId ?? undefined,
      },
      lifecycleMode: "slot",
    },
  });
  createdOrderIds.add(String(order.id));

  return {
    orderId: String(order.id),
    bookingId: String(booking.id),
    customerClerkId,
    tenantClerkId,
  };
}

after(async () => {
  if (!payloadPromise) return;
  const payload = await payloadPromise;

  try {
    for (const orderId of createdOrderIds) {
      try {
        await payload.delete({
          collection: "orders",
          id: orderId,
          overrideAccess: true,
        });
      } catch {
        // Ignore already-removed test records.
      }
    }

    for (const bookingId of createdBookingIds) {
      try {
        await payload.delete({
          collection: "bookings",
          id: bookingId,
          overrideAccess: true,
        });
      } catch {
        // Ignore already-removed test records.
      }
    }

    for (const tenantId of createdTenantIds) {
      try {
        await payload.delete({
          collection: "tenants",
          id: tenantId,
          overrideAccess: true,
        });
      } catch {
        // Ignore already-removed test records.
      }
    }

    for (const userId of createdUserIds) {
      try {
        await payload.delete({
          collection: "users",
          id: userId,
          overrideAccess: true,
        });
      } catch {
        // Ignore already-removed test records.
      }
    }
  } finally {
    createdOrderIds.clear();
    createdBookingIds.clear();
    createdTenantIds.clear();
    createdUserIds.clear();
    if (typeof payload.db.destroy === "function") {
      await payload.db.destroy();
    }
    // This dedicated integration test leaves open handles in the Node test
    // runner even after cleanup, so exit with the test result explicitly.
    setImmediate(() => process.exit(raceTestFailed ? 1 : 0));
  }
});

test("slot-order cancel allows exactly one winner under concurrent customer/tenant requests", async () => {
  try {
    const payload = await getTestPayload();
    const fixture = await createFixture(payload);

    const [customerCaller, tenantCaller] = await Promise.all([
      makeOrdersCaller(payload, fixture.customerClerkId),
      makeOrdersCaller(payload, fixture.tenantClerkId),
    ]);

    type UpdateArgs = Parameters<typeof payload.update>[0];
    type UpdateResult = ReturnType<typeof payload.update>;
    type FindOneAndUpdateArgs = Parameters<RawFindOneAndUpdate>;
    const mutablePayload = payload as unknown as {
      update: (args: UpdateArgs) => UpdateResult;
      db?: { collections?: Record<string, unknown> };
      collections?: Record<string, unknown>;
    };
    const originalUpdate = mutablePayload.update.bind(mutablePayload);
    const collections =
      mutablePayload.db?.collections ?? mutablePayload.collections ?? null;
    const ordersModel = collections?.["orders"] as
      | { findOneAndUpdate?: (...args: FindOneAndUpdateArgs) => Promise<unknown> }
      | undefined;
    assert.ok(ordersModel?.findOneAndUpdate);
    const originalFindOneAndUpdate = ordersModel.findOneAndUpdate!.bind(
      ordersModel,
    );

    let claimCalls = 0;
    const waitForBothClaims = createBarrier(2);
    const events: Array<Record<string, unknown>> = [];

    mutablePayload.update = (async (args: UpdateArgs) => {
      if (args.collection === "orders" || args.collection === "bookings") {
        events.push({
          collection: args.collection,
          at: Date.now(),
          where: "where" in args ? args.where : null,
          data: args.data,
        });
      }

      return originalUpdate(args);
    }) as (args: UpdateArgs) => UpdateResult;

    ordersModel.findOneAndUpdate = (async (...args: FindOneAndUpdateArgs) => {
      claimCalls += 1;
      events.push({
        collection: "orders-model",
        at: Date.now(),
        filter: args[0],
        update: args[1],
      });
      await waitForBothClaims();
      return originalFindOneAndUpdate(...args);
    }) as typeof ordersModel.findOneAndUpdate;

    let results: PromiseSettledResult<unknown>[] = [];

    try {
      results = await Promise.allSettled([
        customerCaller.customerCancelSlotOrder({
          orderId: fixture.orderId,
          reason: "customer race test",
        }),
        tenantCaller.tenantCancelSlotOrder({
          orderId: fixture.orderId,
          reason: "tenant race test",
        }),
      ]);
    } finally {
      mutablePayload.update = originalUpdate;
      ordersModel.findOneAndUpdate = originalFindOneAndUpdate;
    }

    assert.equal(claimCalls, 2);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const loserError = rejected[0]?.reason;
    assert.ok(loserError instanceof TRPCError);
    if (loserError.code !== "CONFLICT") {
      console.error("[cancel-race-events]", events);
    }
    assert.equal(loserError.code, "CONFLICT");

    const order = await payload.findByID({
      collection: "orders",
      id: fixture.orderId,
      depth: 0,
      overrideAccess: true,
    });

    const booking = await payload.findByID({
      collection: "bookings",
      id: fixture.bookingId,
      depth: 0,
      overrideAccess: true,
    });

    assert.equal(order?.status, "canceled");
    assert.ok(order?.canceledAt);
    assert.ok(order?.canceledByRole);
    assert.ok(
      order?.canceledByRole === "customer" || order?.canceledByRole === "tenant",
    );

    assert.equal(booking?.status, "available");
    assert.equal(
      typeof booking?.customer === "string"
        ? booking.customer
        : booking?.customer?.id ?? null,
      null,
    );

    if (fulfilled.length !== 1 || rejected.length !== 1) {
      console.error("[cancel-race-events]", events);
    }
  } catch (error) {
    raceTestFailed = true;
    throw error;
  }
});
