import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { getPayload } from "payload";
import { TRPCError } from "@trpc/server";

import type { Booking, Order } from "@/payload-types";

loadEnv({ path: ".env.local" });
loadEnv();
process.env.PAYLOAD_SECRET ??= "test-payload-secret";
process.env.RESEND_API_KEY ??= "test-resend-key";
process.env.SKIP_ORDER_EMAILS ??= "1";

type TestPayload = Awaited<ReturnType<typeof getPayload>>;
type DocWithId<T> = T & { id: string };
type ServiceStatus = NonNullable<Order["serviceStatus"]>;

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

async function makeBookingsCaller(payload: TestPayload, clerkUserId: string) {
  const [{ createCallerFactory }, { bookingRouter }] = await Promise.all([
    import("@/trpc/init"),
    import("@/modules/bookings/server/procedures"),
  ]);

  return createCallerFactory(bookingRouter)({
    db: payload,
    userId: clerkUserId,
    headers: {},
    appLang: "en",
    auth: null,
    authSource: "none",
  } as never);
}

async function makeInvoicesCaller(payload: TestPayload, clerkUserId: string) {
  const [{ createCallerFactory }, { invoicesRouter }] = await Promise.all([
    import("@/trpc/init"),
    import("@/modules/invoices/server/procedures"),
  ]);

  return createCallerFactory(invoicesRouter)({
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

async function createSlotOrderFixture(
  payload: TestPayload,
  overrides?: {
    serviceStatuses?: ServiceStatus[];
    orderServiceStatus?: ServiceStatus;
    startsInPast?: boolean;
  },
) {
  const suffix = randomUUID().slice(0, 8);
  const customer = await createUser(payload, `${suffix}-customer`, "customer");
  const tenantOwner = await createUser(payload, `${suffix}-tenant`, "tenant");

  const tenant = await payload.create({
    collection: "tenants",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `Guard Tenant ${suffix}`,
      slug: `guard-tenant-${suffix}`,
      stripeAccountId: `acct_guard_${suffix}`,
      stripeDetailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingStatus: "completed",
      bio: "Requested lifecycle guard tenant",
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
      name: `Guard Service ${suffix}`,
      slug: `guard-service-${suffix}`,
      workType: "manual",
    },
  });
  createdCategoryIds.add(String(service.id));

  const statuses = overrides?.serviceStatuses ?? ["requested"];
  const baseStart = new Date(
    Date.now() + (overrides?.startsInPast ? -96 : 96) * 60 * 60 * 1000,
  );
  baseStart.setMinutes(0, 0, 0);

  const bookingIds: string[] = [];
  for (const [index, serviceStatus] of statuses.entries()) {
    const start = new Date(baseStart.getTime() + index * 60 * 60 * 1000);
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
        serviceStatus,
        paymentStatus: "unpaid",
        serviceSnapshot: {
          serviceName: `Guard Service ${suffix}`,
          serviceSlug: `guard-service-${suffix}`,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          hourlyRate: tenant.hourlyRate ?? 100,
        },
      },
    });
    bookingIds.push(String(booking.id));
    createdBookingIds.add(String(booking.id));
  }

  const orderServiceStatus =
    overrides?.orderServiceStatus ??
    overrides?.serviceStatuses?.[0] ??
    "requested";
  const order = await payload.create({
    collection: "orders",
    overrideAccess: true,
    depth: 0,
    data: {
      status: "pending",
      serviceStatus: orderServiceStatus,
      invoiceStatus: "none",
      user: customer.user.id,
      tenant: tenant.id,
      slots: bookingIds,
      amount: 10000 * bookingIds.length,
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
    customer,
    tenantOwner,
    bookingIds,
    orderId: String(order.id),
  };
}

async function readOrder(payload: TestPayload, orderId: string) {
  return payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as Promise<DocWithId<Order> | null>;
}

async function readBooking(payload: TestPayload, bookingId: string) {
  return payload.findByID({
    collection: "bookings",
    id: bookingId,
    depth: 0,
    overrideAccess: true,
  }) as Promise<DocWithId<Booking> | null>;
}

after(async () => {
  if (!payloadPromise) return;
  const payload = await payloadPromise;

  try {
    for (const orderId of createdOrderIds) {
      try {
        await payload.delete({
          collection: "email_event_logs",
          where: { entityId: { equals: orderId } },
          overrideAccess: true,
        });
      } catch {}
    }

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
  }
});

test("customer can cancel a requested order and release request state", async () => {
  const payload = await getTestPayload();
  const fixture = await createSlotOrderFixture(payload);
  const caller = await makeOrdersCaller(payload, fixture.customer.clerkUserId);

  const result = await caller.customerCancelSlotOrder({
    orderId: fixture.orderId,
    reason: "Plans changed before confirmation",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "canceled");

  const order = await readOrder(payload, fixture.orderId);
  const booking = await readBooking(payload, fixture.bookingIds[0]!);

  assert.equal(order?.status, "canceled");
  assert.equal(order?.serviceStatus, "requested");
  assert.equal(order?.canceledByRole, "customer");
  assert.equal(order?.cancelReason, "Plans changed before confirmation");
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

test("tenant scheduled-cancel endpoint rejects requested orders", async () => {
  const payload = await getTestPayload();
  const fixture = await createSlotOrderFixture(payload);
  const caller = await makeOrdersCaller(
    payload,
    fixture.tenantOwner.clerkUserId,
  );

  await assert.rejects(
    () =>
      caller.tenantCancelSlotOrder({
        orderId: fixture.orderId,
        reason: "Use decline for requested orders",
      }),
    (error: unknown) => error instanceof TRPCError && error.code === "CONFLICT",
  );

  const order = await readOrder(payload, fixture.orderId);
  const booking = await readBooking(payload, fixture.bookingIds[0]!);
  assert.equal(order?.status, "pending");
  assert.equal(order?.serviceStatus, "requested");
  assert.equal(booking?.status, "confirmed");
  assert.equal(booking?.serviceStatus, "requested");
});

test("requested slots cannot be marked completed", async () => {
  const payload = await getTestPayload();
  const fixture = await createSlotOrderFixture(payload, {
    startsInPast: true,
  });
  const caller = await makeBookingsCaller(
    payload,
    fixture.tenantOwner.clerkUserId,
  );

  await assert.rejects(
    () => caller.vendorMarkCompleted({ bookingId: fixture.bookingIds[0]! }),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "CONFLICT" &&
      String(error.message).includes("serviceStatus=requested"),
  );
});

test("requested orders cannot be invoiced", async () => {
  const payload = await getTestPayload();
  const fixture = await createSlotOrderFixture(payload);
  const caller = await makeInvoicesCaller(
    payload,
    fixture.tenantOwner.clerkUserId,
  );

  await assert.rejects(
    () => caller.issueForOrder({ orderId: fixture.orderId }),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "CONFLICT" &&
      error.message === "Order is not accepted yet.",
  );
});

test("order rollup preserves requested and keeps existing status priority", async () => {
  const payload = await getTestPayload();
  const { recomputeOrdersForBookingId } = await import(
    "../server/order-rollup"
  );
  const fixture = await createSlotOrderFixture(payload, {
    serviceStatuses: ["requested", "scheduled"],
    orderServiceStatus: "scheduled",
  });
  const [firstBookingId, secondBookingId] = fixture.bookingIds;

  assert.ok(firstBookingId);
  assert.ok(secondBookingId);

  await recomputeOrdersForBookingId({ db: payload }, firstBookingId);
  assert.equal(
    (await readOrder(payload, fixture.orderId))?.serviceStatus,
    "requested",
  );

  await payload.update({
    collection: "bookings",
    id: secondBookingId,
    data: { serviceStatus: "disputed" },
    overrideAccess: true,
    depth: 0,
  });
  await payload.update({
    collection: "orders",
    id: fixture.orderId,
    data: { serviceStatus: "disputed" },
    overrideAccess: true,
    depth: 0,
  });
  await recomputeOrdersForBookingId({ db: payload }, firstBookingId);
  assert.equal(
    (await readOrder(payload, fixture.orderId))?.serviceStatus,
    "disputed",
  );

  await Promise.all(
    [
      { id: firstBookingId, serviceStatus: "completed" as const },
      { id: secondBookingId, serviceStatus: "accepted" as const },
    ].map(({ id, serviceStatus }) =>
      payload.update({
        collection: "bookings",
        id,
        data: { serviceStatus },
        overrideAccess: true,
        depth: 0,
      }),
    ),
  );
  await payload.update({
    collection: "orders",
    id: fixture.orderId,
    data: { serviceStatus: "completed" },
    overrideAccess: true,
    depth: 0,
  });
  await recomputeOrdersForBookingId({ db: payload }, firstBookingId);
  assert.equal(
    (await readOrder(payload, fixture.orderId))?.serviceStatus,
    "completed",
  );

  await Promise.all(
    fixture.bookingIds.map((id) =>
      payload.update({
        collection: "bookings",
        id,
        data: { serviceStatus: "accepted" },
        overrideAccess: true,
        depth: 0,
      }),
    ),
  );
  await payload.update({
    collection: "orders",
    id: fixture.orderId,
    data: { serviceStatus: "accepted" },
    overrideAccess: true,
    depth: 0,
  });
  await recomputeOrdersForBookingId({ db: payload }, firstBookingId);
  assert.equal(
    (await readOrder(payload, fixture.orderId))?.serviceStatus,
    "accepted",
  );

  await Promise.all(
    fixture.bookingIds.map((id) =>
      payload.update({
        collection: "bookings",
        id,
        data: { serviceStatus: "scheduled" },
        overrideAccess: true,
        depth: 0,
      }),
    ),
  );
  await recomputeOrdersForBookingId({ db: payload }, firstBookingId);
  assert.equal(
    (await readOrder(payload, fixture.orderId))?.serviceStatus,
    "scheduled",
  );
});
