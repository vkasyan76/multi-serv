import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { getPayload } from "payload";
import { TERMS_VERSION } from "@/constants";

loadEnv({ path: ".env.local" });
loadEnv();
process.env.PAYLOAD_SECRET ??= "test-payload-secret";
process.env.RESEND_API_KEY ??= "test-resend-key";

type TestPayload = Awaited<ReturnType<typeof getPayload>>;
type DocWithId<T> = T & { id: string };

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

async function makeBookingCaller(payload: TestPayload, clerkUserId: string) {
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

async function makeSlotCheckoutCaller(
  payload: TestPayload,
  clerkUserId: string,
) {
  const [{ createCallerFactory }, { slotCheckoutRouter }] = await Promise.all([
    import("@/trpc/init"),
    import("@/modules/checkout/server/slot-procedures"),
  ]);

  return createCallerFactory(slotCheckoutRouter)({
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

async function createFixture(payload: TestPayload) {
  const suffix = randomUUID().slice(0, 8);
  const customerClerkId = `clerk-checkout-customer-${suffix}`;

  const customer = await payload.create({
    collection: "users",
    overrideAccess: true,
    depth: 0,
    data: {
      username: `checkout_customer_${suffix}`,
      clerkUserId: customerClerkId,
      email: null,
      roles: ["user"],
      firstName: "Checkout",
      lastName: "Customer",
      location: "Berlin",
      country: "DE",
      language: "en",
      emailDeliverabilityStatus: "hard_suppressed",
      emailDeliverabilityReason: "manual",
      policyAcceptedVersion: TERMS_VERSION,
      policyAcceptedAt: new Date().toISOString(),
    },
  });
  createdUserIds.add(String(customer.id));

  const tenantOwner = await payload.create({
    collection: "users",
    overrideAccess: true,
    depth: 0,
    data: {
      username: `checkout_tenant_owner_${suffix}`,
      clerkUserId: `clerk-checkout-tenant-${suffix}`,
      email: `checkouttenantowner${suffix}@example.com`,
      roles: ["user"],
      firstName: "Checkout",
      lastName: "Tenant",
      location: "Berlin",
      country: "DE",
      language: "en",
      emailDeliverabilityStatus: "hard_suppressed",
      emailDeliverabilityReason: "manual",
      policyAcceptedVersion: TERMS_VERSION,
      policyAcceptedAt: new Date().toISOString(),
    },
  });
  createdUserIds.add(String(tenantOwner.id));

  const tenant = await payload.create({
    collection: "tenants",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `Checkout Tenant ${suffix}`,
      slug: `checkout-tenant-${suffix}`,
      stripeAccountId: `acct_checkout_${suffix}`,
      stripeDetailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingStatus: "completed",
      bio: "Checkout lifecycle tenant",
      hourlyRate: 100,
      country: "DE",
      user: tenantOwner.id,
    },
  });
  createdTenantIds.add(String(tenant.id));

  const service = await payload.create({
    collection: "categories",
    overrideAccess: true,
    depth: 0,
    data: {
      name: `Checkout Service ${suffix}`,
      slug: `checkout-service-${suffix}`,
      workType: "manual",
    },
  });
  createdCategoryIds.add(String(service.id));

  const start = new Date(Date.now() + 72 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const booking = await payload.create({
    collection: "bookings",
    overrideAccess: true,
    depth: 0,
    data: {
      tenant: tenant.id,
      start: start.toISOString(),
      end: end.toISOString(),
      status: "available",
    },
  });
  createdBookingIds.add(String(booking.id));

  return {
    customer,
    tenant,
    service,
    booking: booking as DocWithId<typeof booking>,
    customerClerkId,
  };
}

after(async () => {
  if (!payloadPromise) return;
  const payload = await payloadPromise;

  try {
    for (const orderId of createdOrderIds) {
      const logs = await payload.find({
        collection: "email_event_logs",
        where: { entityId: { equals: orderId } },
        overrideAccess: true,
        depth: 0,
        limit: 100,
      });

      for (const log of logs.docs) {
        await payload.delete({
          collection: "email_event_logs",
          id: String(log.id),
          overrideAccess: true,
        });
      }

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

    for (const categoryId of createdCategoryIds) {
      try {
        await payload.delete({
          collection: "categories",
          id: categoryId,
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
    createdCategoryIds.clear();
    createdUserIds.clear();
    if (typeof payload.db.destroy === "function") {
      await payload.db.destroy();
    }
  }
});

test("slot checkout creates a requested order and keeps promoted slots blocked", async () => {
  const payload = await getTestPayload();
  const fixture = await createFixture(payload);

  const bookingCaller = await makeBookingCaller(
    payload,
    fixture.customerClerkId,
  );
  const slotCheckoutCaller = await makeSlotCheckoutCaller(
    payload,
    fixture.customerClerkId,
  );

  const hold = await bookingCaller.bookSlots({
    items: [
      {
        bookingId: String(fixture.booking.id),
        serviceId: String(fixture.service.id),
      },
    ],
  });

  assert.deepEqual(hold.bookedIds, [String(fixture.booking.id)]);
  assert.equal(hold.unavailableIds.length, 0);
  assert.equal(hold.updated, 1);

  const heldBooking = await payload.findByID({
    collection: "bookings",
    id: String(fixture.booking.id),
    depth: 0,
    overrideAccess: true,
  });

  assert.equal(heldBooking?.status, "booked");
  assert.equal(relId(heldBooking?.customer), String(fixture.customer.id));
  assert.equal(heldBooking?.paymentStatus, "unpaid");

  const result = await slotCheckoutCaller.createOrder({
    slotIds: [String(fixture.booking.id)],
  });
  assert.equal(result.ok, true);
  createdOrderIds.add(String(result.orderId));

  const order = await payload.findByID({
    collection: "orders",
    id: String(result.orderId),
    depth: 0,
    overrideAccess: true,
  });

  assert.equal(order?.lifecycleMode, "slot");
  assert.equal(order?.status, "pending");
  assert.equal(order?.serviceStatus, "requested");
  assert.notEqual(order?.serviceStatus, "scheduled");
  assert.equal(order?.invoiceStatus, "none");
  assert.deepEqual(
    (order?.slots ?? []).map((slot) => relId(slot) ?? String(slot)),
    [String(fixture.booking.id)],
  );

  const promotedBooking = await payload.findByID({
    collection: "bookings",
    id: String(fixture.booking.id),
    depth: 0,
    overrideAccess: true,
  });

  assert.equal(promotedBooking?.status, "confirmed");
  assert.equal(promotedBooking?.serviceStatus, "requested");
  assert.notEqual(promotedBooking?.serviceStatus, "scheduled");
  assert.equal(promotedBooking?.paymentStatus, "unpaid");
  assert.equal(relId(promotedBooking?.customer), String(fixture.customer.id));
});
