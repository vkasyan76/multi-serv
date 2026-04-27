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

let payloadPromise: Promise<TestPayload> | null = null;
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

async function createRequestedOrderFixture(
  payload: TestPayload,
  overrides?: {
    orderStatus?: "pending" | "canceled";
    serviceStatus?: "requested" | "scheduled";
    canceledByRole?: "customer" | "tenant";
  },
) {
  const suffix = randomUUID().slice(0, 8);
  const customer = await createUser(payload, `${suffix}-customer`, "customer");
  const tenantOwner = await createUser(payload, `${suffix}-tenant`, "tenant");
  const wrongTenantOwner = await createUser(
    payload,
    `${suffix}-other-tenant`,
    "othertenant",
  );

  const tenant = await payload.create({
    collection: "tenants",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `Requested Tenant ${suffix}`,
      slug: `requested-tenant-${suffix}`,
      stripeAccountId: `acct_req_${suffix}`,
      stripeDetailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingStatus: "completed",
      bio: "Requested order tenant",
      hourlyRate: 100,
      country: "DE",
      user: tenantOwner.user.id,
    },
  });
  createdTenantIds.add(String(tenant.id));

  const wrongTenant = await payload.create({
    collection: "tenants",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `Wrong Tenant ${suffix}`,
      slug: `wrong-tenant-${suffix}`,
      stripeAccountId: `acct_wrong_${suffix}`,
      stripeDetailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingStatus: "completed",
      bio: "Wrong requested order tenant",
      hourlyRate: 90,
      country: "DE",
      user: wrongTenantOwner.user.id,
    },
  });
  createdTenantIds.add(String(wrongTenant.id));

  const service = await payload.create({
    collection: "categories",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `Requested Service ${suffix}`,
      slug: `requested-service-${suffix}`,
      workType: "manual",
    },
  });
  createdCategoryIds.add(String(service.id));

  const start = new Date(Date.now() + 96 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const effectiveServiceStatus = overrides?.serviceStatus ?? "requested";
  const effectiveOrderStatus = overrides?.orderStatus ?? "pending";
  const canceledAt =
    effectiveOrderStatus === "canceled" ? new Date().toISOString() : null;

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
      serviceStatus: effectiveServiceStatus,
      paymentStatus: "unpaid",
      serviceSnapshot: {
        serviceName: `Requested Service ${suffix}`,
        serviceSlug: `requested-service-${suffix}`,
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
      status: effectiveOrderStatus,
      serviceStatus: effectiveServiceStatus,
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
      canceledAt: canceledAt ?? undefined,
      canceledByRole:
        effectiveOrderStatus === "canceled"
          ? overrides?.canceledByRole ?? "tenant"
          : undefined,
      cancelReason:
        effectiveOrderStatus === "canceled" ? "already canceled" : undefined,
    },
  });
  createdOrderIds.add(String(order.id));

  return {
    customer,
    tenantOwner,
    wrongTenantOwner,
    tenant,
    wrongTenant,
    service,
    bookingId: String(booking.id),
    orderId: String(order.id),
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
    setImmediate(() => process.exit(process.exitCode ?? 0));
  }
});

test("tenant can confirm own requested order without changing payment or invoice state", async () => {
  const payload = await getTestPayload();
  const fixture = await createRequestedOrderFixture(payload);
  const caller = await makeOrdersCaller(
    payload,
    fixture.tenantOwner.clerkUserId,
  );

  const result = await caller.tenantConfirmSlotOrder({
    orderId: fixture.orderId,
  });

  assert.equal(result.ok, true);
  assert.equal(result.serviceStatus, "scheduled");

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

  assert.equal(order?.status, "pending");
  assert.equal(order?.serviceStatus, "scheduled");
  assert.equal(order?.invoiceStatus, "none");
  assert.equal(booking?.status, "confirmed");
  assert.equal(booking?.serviceStatus, "scheduled");
  assert.equal(booking?.paymentStatus, "unpaid");
  assert.equal(relId(booking?.customer), fixture.customer.user.id);
});

test("wrong tenant cannot confirm a requested order", async () => {
  const payload = await getTestPayload();
  const fixture = await createRequestedOrderFixture(payload);
  const caller = await makeOrdersCaller(
    payload,
    fixture.wrongTenantOwner.clerkUserId,
  );

  await assert.rejects(
    () =>
      caller.tenantConfirmSlotOrder({
        orderId: fixture.orderId,
      }),
    (error: unknown) =>
      error instanceof TRPCError && error.code === "FORBIDDEN",
  );
});

test("tenant confirm rejects canceled and non-requested orders", async () => {
  const payload = await getTestPayload();
  const canceled = await createRequestedOrderFixture(payload, {
    orderStatus: "canceled",
  });
  const scheduled = await createRequestedOrderFixture(payload, {
    serviceStatus: "scheduled",
  });

  const canceledCaller = await makeOrdersCaller(
    payload,
    canceled.tenantOwner.clerkUserId,
  );
  const scheduledCaller = await makeOrdersCaller(
    payload,
    scheduled.tenantOwner.clerkUserId,
  );

  await assert.rejects(
    () => canceledCaller.tenantConfirmSlotOrder({ orderId: canceled.orderId }),
    (error: unknown) =>
      error instanceof TRPCError && error.code === "CONFLICT",
  );
  await assert.rejects(
    () => scheduledCaller.tenantConfirmSlotOrder({ orderId: scheduled.orderId }),
    (error: unknown) =>
      error instanceof TRPCError && error.code === "CONFLICT",
  );
});

test("tenant can decline own requested order and release its slot state", async () => {
  const payload = await getTestPayload();
  const fixture = await createRequestedOrderFixture(payload);
  const caller = await makeOrdersCaller(
    payload,
    fixture.tenantOwner.clerkUserId,
  );

  const result = await caller.tenantDeclineSlotOrder({
    orderId: fixture.orderId,
    reason: "Provider cannot accommodate this request",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "canceled");

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
  assert.equal(order?.serviceStatus, "requested");
  assert.equal(order?.canceledByRole, "tenant");
  assert.equal(order?.cancelReason, "Provider cannot accommodate this request");
  assert.ok(order?.canceledAt);

  assert.equal(booking?.status, "available");
  assert.equal(relId(booking?.customer), null);
  assert.equal(relId(booking?.service), null);
  assert.equal(booking?.serviceStatus ?? null, null);
  assert.equal(booking?.paymentStatus ?? null, null);
  assert.deepEqual(booking?.serviceSnapshot ?? null, {
    serviceName: null,
    serviceSlug: null,
    tenantName: null,
    tenantSlug: null,
    hourlyRate: null,
  });
  assert.equal(booking?.serviceCompletedAt ?? null, null);
  assert.equal(booking?.acceptedAt ?? null, null);
  assert.equal(booking?.disputedAt ?? null, null);
  assert.equal(booking?.disputeReason ?? null, null);
});

test("wrong tenant cannot decline a requested order", async () => {
  const payload = await getTestPayload();
  const fixture = await createRequestedOrderFixture(payload);
  const caller = await makeOrdersCaller(
    payload,
    fixture.wrongTenantOwner.clerkUserId,
  );

  await assert.rejects(
    () =>
      caller.tenantDeclineSlotOrder({
        orderId: fixture.orderId,
        reason: "Wrong tenant attempt",
      }),
    (error: unknown) =>
      error instanceof TRPCError && error.code === "FORBIDDEN",
  );
});

test("tenant decline rejects canceled and non-requested orders", async () => {
  const payload = await getTestPayload();
  const canceled = await createRequestedOrderFixture(payload, {
    orderStatus: "canceled",
  });
  const scheduled = await createRequestedOrderFixture(payload, {
    serviceStatus: "scheduled",
  });

  const canceledCaller = await makeOrdersCaller(
    payload,
    canceled.tenantOwner.clerkUserId,
  );
  const scheduledCaller = await makeOrdersCaller(
    payload,
    scheduled.tenantOwner.clerkUserId,
  );

  await assert.rejects(
    () =>
      canceledCaller.tenantDeclineSlotOrder({
        orderId: canceled.orderId,
        reason: "Already canceled",
      }),
    (error: unknown) =>
      error instanceof TRPCError && error.code === "CONFLICT",
  );
  await assert.rejects(
    () =>
      scheduledCaller.tenantDeclineSlotOrder({
        orderId: scheduled.orderId,
        reason: "Should not decline scheduled",
      }),
    (error: unknown) =>
      error instanceof TRPCError && error.code === "CONFLICT",
  );
});

test("decline only releases the targeted order slots", async () => {
  const payload = await getTestPayload();
  const target = await createRequestedOrderFixture(payload);
  const untouched = await createRequestedOrderFixture(payload);
  const caller = await makeOrdersCaller(
    payload,
    target.tenantOwner.clerkUserId,
  );

  await caller.tenantDeclineSlotOrder({
    orderId: target.orderId,
    reason: "Targeted decline",
  });

  const targetBooking = await payload.findByID({
    collection: "bookings",
    id: target.bookingId,
    depth: 0,
    overrideAccess: true,
  });
  const untouchedBooking = await payload.findByID({
    collection: "bookings",
    id: untouched.bookingId,
    depth: 0,
    overrideAccess: true,
  });
  const untouchedOrder = await payload.findByID({
    collection: "orders",
    id: untouched.orderId,
    depth: 0,
    overrideAccess: true,
  });

  assert.equal(targetBooking?.status, "available");
  assert.equal(untouchedBooking?.status, "confirmed");
  assert.equal(untouchedBooking?.serviceStatus, "requested");
  assert.equal(relId(untouchedBooking?.customer), untouched.customer.user.id);
  assert.equal(untouchedOrder?.status, "pending");
  assert.equal(untouchedOrder?.serviceStatus, "requested");
});
