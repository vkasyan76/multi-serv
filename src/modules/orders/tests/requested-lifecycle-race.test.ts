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
const createdCategoryIds = new Set<string>();
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

  return createCallerFactory(ordersRouter)({
    db: payload,
    userId: clerkUserId,
    headers: {},
    appLang: "en",
    auth: null,
    authSource: "none",
  } as never);
}

function relId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
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
        new Error(`requested-lifecycle barrier timed out after ${timeoutMs}ms`),
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

async function createUser(payload: TestPayload, suffix: string, label: string) {
  const clerkUserId = `clerk-${label}-${suffix}`;
  const user = await payload.create({
    collection: "users",
    overrideAccess: true,
    depth: 0,
    data: {
      username: `${label}_${suffix}`,
      clerkUserId,
      email: `${label}_${suffix}@example.test`,
      roles: ["user"],
      firstName: label,
      lastName: "User",
      location: "Berlin",
      country: "DE",
      language: "en",
    },
  });

  createdUserIds.add(String(user.id));
  return { user, clerkUserId };
}

async function createRequestedOrderFixture(payload: TestPayload) {
  const suffix = randomUUID().slice(0, 8);
  const customer = await createUser(payload, `${suffix}-customer`, "customer");
  const tenantOwner = await createUser(payload, `${suffix}-tenant`, "tenant");

  const tenant = await payload.create({
    collection: "tenants",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `Requested Race Tenant ${suffix}`,
      slug: `requested-race-tenant-${suffix}`,
      stripeAccountId: `acct_req_race_${suffix}`,
      stripeDetailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingStatus: "completed",
      bio: "Requested race tenant",
      hourlyRate: 100,
      country: "DE",
      user: tenantOwner.user.id,
    },
  });
  createdTenantIds.add(String(tenant.id));

  const service = await payload.create({
    collection: "categories",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `Requested Race Service ${suffix}`,
      slug: `requested-race-service-${suffix}`,
      workType: "manual",
    },
  });
  createdCategoryIds.add(String(service.id));

  const start = new Date(Date.now() + 96 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const booking = await payload.create({
    collection: "bookings",
    overrideAccess: true,
    depth: 0,
    data: {
      tenant: tenant.id,
      customer: customer.user.id,
      start: start.toISOString(),
      end: end.toISOString(),
      status: "confirmed",
      service: service.id,
      serviceStatus: "requested",
      paymentStatus: "unpaid",
      serviceSnapshot: {
        serviceName: `Requested Race Service ${suffix}`,
        serviceSlug: `requested-race-service-${suffix}`,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        hourlyRate: tenant.hourlyRate ?? 100,
      },
    },
  });
  createdBookingIds.add(String(booking.id));

  const order = await payload.create({
    collection: "orders",
    overrideAccess: true,
    depth: 0,
    data: {
      status: "pending",
      serviceStatus: "requested",
      invoiceStatus: "none",
      user: customer.user.id,
      tenant: tenant.id,
      slots: [booking.id],
      amount: 10000,
      currency: "eur",
      customerSnapshot: {
        firstName: "customer",
        lastName: "User",
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
    customerClerkId: customer.clerkUserId,
    tenantClerkId: tenantOwner.clerkUserId,
  };
}

async function runWithOrderClaimBarrier<T>(
  payload: TestPayload,
  run: () => Promise<T>,
) {
  type FindOneAndUpdateArgs = Parameters<RawFindOneAndUpdate>;
  const mutablePayload = payload as unknown as {
    db?: { collections?: Record<string, unknown> };
    collections?: Record<string, unknown>;
  };
  const collections =
    mutablePayload.db?.collections ?? mutablePayload.collections ?? null;
  const ordersModel = collections?.["orders"] as
    | { findOneAndUpdate?: (...args: FindOneAndUpdateArgs) => Promise<unknown> }
    | undefined;
  assert.ok(ordersModel?.findOneAndUpdate);

  const originalFindOneAndUpdate = ordersModel.findOneAndUpdate.bind(
    ordersModel,
  );
  const waitForBothClaims = createBarrier(2);
  let claimCalls = 0;

  ordersModel.findOneAndUpdate = (async (...args: FindOneAndUpdateArgs) => {
    claimCalls += 1;
    await waitForBothClaims();
    return originalFindOneAndUpdate(...args);
  }) as typeof ordersModel.findOneAndUpdate;

  try {
    const result = await run();
    assert.equal(claimCalls, 2);
    return result;
  } finally {
    ordersModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
}

async function assertOneWinner(results: PromiseSettledResult<unknown>[]) {
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0]?.reason instanceof TRPCError);
  assert.equal(rejected[0].reason.code, "CONFLICT");

  return fulfilled[0]?.value as
    | { status?: "canceled"; serviceStatus?: "scheduled" }
    | undefined;
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
      } catch {}
    }
    for (const bookingId of createdBookingIds) {
      try {
        await payload.delete({
          collection: "bookings",
          id: bookingId,
          overrideAccess: true,
        });
      } catch {}
    }
    for (const tenantId of createdTenantIds) {
      try {
        await payload.delete({
          collection: "tenants",
          id: tenantId,
          overrideAccess: true,
        });
      } catch {}
    }
    for (const categoryId of createdCategoryIds) {
      try {
        await payload.delete({
          collection: "categories",
          id: categoryId,
          overrideAccess: true,
        });
      } catch {}
    }
    for (const userId of createdUserIds) {
      try {
        await payload.delete({
          collection: "users",
          id: userId,
          overrideAccess: true,
        });
      } catch {}
    }
  } finally {
    createdOrderIds.clear();
    createdBookingIds.clear();
    createdTenantIds.clear();
    createdCategoryIds.clear();
    createdUserIds.clear();
    if (typeof payload.db.destroy === "function") {
      await payload.db.destroy();
    }
    setImmediate(() => process.exit(raceTestFailed ? 1 : 0));
  }
});

test("customer cancel and tenant confirm race leaves a consistent requested order state", async () => {
  try {
    const payload = await getTestPayload();
    const fixture = await createRequestedOrderFixture(payload);

    const [customerCaller, tenantCaller] = await Promise.all([
      makeOrdersCaller(payload, fixture.customerClerkId),
      makeOrdersCaller(payload, fixture.tenantClerkId),
    ]);

    const results = await runWithOrderClaimBarrier(payload, () =>
      Promise.allSettled([
        customerCaller.customerCancelSlotOrder({
          orderId: fixture.orderId,
          reason: "customer race test",
        }),
        tenantCaller.tenantConfirmSlotOrder({
          orderId: fixture.orderId,
        }),
      ]),
    );
    const winner = await assertOneWinner(results);

    const [order, booking] = await Promise.all([
      payload.findByID({
        collection: "orders",
        id: fixture.orderId,
        depth: 0,
        overrideAccess: true,
      }),
      payload.findByID({
        collection: "bookings",
        id: fixture.bookingId,
        depth: 0,
        overrideAccess: true,
      }),
    ]);

    if (winner?.serviceStatus === "scheduled") {
      assert.equal(order?.status, "pending");
      assert.equal(order?.serviceStatus, "scheduled");
      assert.equal(booking?.status, "confirmed");
      assert.equal(booking?.serviceStatus, "scheduled");
      assert.equal(relId(booking?.customer), relId(order?.user));
    } else {
      assert.equal(order?.status, "canceled");
      assert.equal(order?.serviceStatus, "requested");
      assert.equal(booking?.status, "available");
      assert.equal(booking?.serviceStatus, null);
      assert.equal(relId(booking?.customer), null);
    }
  } catch (error) {
    raceTestFailed = true;
    throw error;
  }
});

test("customer cancel and tenant decline race releases a requested order once", async () => {
  try {
    const payload = await getTestPayload();
    const fixture = await createRequestedOrderFixture(payload);

    const [customerCaller, tenantCaller] = await Promise.all([
      makeOrdersCaller(payload, fixture.customerClerkId),
      makeOrdersCaller(payload, fixture.tenantClerkId),
    ]);

    const results = await runWithOrderClaimBarrier(payload, () =>
      Promise.allSettled([
        customerCaller.customerCancelSlotOrder({
          orderId: fixture.orderId,
          reason: "customer race test",
        }),
        tenantCaller.tenantDeclineSlotOrder({
          orderId: fixture.orderId,
          reason: "tenant race decline",
        }),
      ]),
    );
    await assertOneWinner(results);

    const [order, booking] = await Promise.all([
      payload.findByID({
        collection: "orders",
        id: fixture.orderId,
        depth: 0,
        overrideAccess: true,
      }),
      payload.findByID({
        collection: "bookings",
        id: fixture.bookingId,
        depth: 0,
        overrideAccess: true,
      }),
    ]);

    assert.equal(order?.status, "canceled");
    assert.equal(order?.serviceStatus, "requested");
    assert.equal(booking?.status, "available");
    assert.equal(booking?.serviceStatus, null);
    assert.equal(relId(booking?.customer), null);
  } catch (error) {
    raceTestFailed = true;
    throw error;
  }
});
