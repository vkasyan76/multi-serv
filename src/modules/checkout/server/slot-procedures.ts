// src/modules/checkout/server/slot-procedures.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import type { Booking, Tenant, User } from "@/payload-types";
import { addHours } from "date-fns";
import { assertTermsAccepted } from "@/modules/legal/terms-of-use/assert-terms-accepted";
import { sendDomainEmail } from "@/modules/email/events";
import type { EmailDeliverability } from "@/modules/email/types";
import {
  COMMISSION_RATE_BPS_DEFAULT as COMMISSION_RATE_BPS,
  MAX_SLOTS_PER_BOOKING,
} from "@/constants";

type DocWithId<T> = T & { id: string };

// Cents helper (kept: you still want amounts stored on the order, for later invoicing).
const toCents = (amount: number) => Math.round(amount * 100);

// Helper: normalize user deliverability for email sends.
function toEmailDeliverability(user: User): EmailDeliverability {
  return {
    status: user.emailDeliverabilityStatus ?? undefined,
    reason: user.emailDeliverabilityReason ?? undefined,
    retryAfter: user.emailDeliverabilityRetryAfter ?? undefined,
  };
}

// Helper: build absolute URLs for email CTAs (prefer server APP_URL).
function toAbsolute(path: string) {
  const base =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return new URL(path, base).toString();
}

// Helper: compact list of service names for emails.
function extractServiceNames(slots: Array<DocWithId<Booking>>): string[] {
  const names = slots
    .map((slot) => slot.serviceSnapshot?.serviceName ?? null)
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.trim())
    .filter(Boolean);
  return Array.from(new Set(names));
}

// Helper: compute a single date range across all slots (UTC).
function extractDateRange(slots: Array<DocWithId<Booking>>) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let minStart: string | undefined;
  let maxEnd: string | undefined;

  for (const slot of slots) {
    const startMs = Date.parse(slot.start ?? "");
    const endMsRaw = Date.parse(slot.end ?? slot.start ?? "");
    if (!Number.isFinite(startMs)) continue;

    if (startMs < min) {
      min = startMs;
      minStart = slot.start;
    }

    const endMs = Number.isFinite(endMsRaw) ? endMsRaw : startMs;
    if (endMs > max) {
      max = endMs;
      maxEnd = slot.end ?? slot.start;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { start: minStart, end: maxEnd ?? minStart };
}

export const slotCheckoutRouter = createTRPCRouter({
  /**
   * Stage-1 Slot Checkout:
   * - NO STRIPE
   * - Creates lifecycleMode:"slot" order
   * - Converts bookings booked -> confirmed
   * - Leaves payment for later invoices
   */
  createOrder: baseProcedure
    .input(
      z.object({
        slotIds: z.array(z.string().min(1)).min(1).max(MAX_SLOTS_PER_BOOKING),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const clerkUserId = ctx.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Clerk -> Payload user
      const me = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      });
      const payloadUser = (me.docs?.[0] as DocWithId<User> | undefined) ?? null;
      if (!payloadUser) throw new TRPCError({ code: "FORBIDDEN" });

      // policy / terms gate (still valid in the new model)
      assertTermsAccepted(payloadUser);

      const payloadUserId = payloadUser.id;

      // Load requested bookings (override ACL like your legacy flow)
      const found = await ctx.db.find({
        collection: "bookings",
        where: { id: { in: input.slotIds } },
        limit: input.slotIds.length,
        depth: 0,
        overrideAccess: true,
      });

      const bookings = (found.docs ?? []) as Array<DocWithId<Booking>>;
      if (bookings.length !== input.slotIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some slots not found",
        });
      }

      // Validate:
      // - all are booked
      // - booked by this user
      // - in the future
      // - belong to one tenant
      const now = new Date();
      const tenantIds = new Set<string>();

      for (const b of bookings) {
        if (b.status !== "booked") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Some slots are not reserved",
          });
        }

        const bookedBy =
          typeof b.customer === "string"
            ? b.customer
            : (b.customer?.id ?? null);

        if (!bookedBy || bookedBy !== payloadUserId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not your reservation",
          });
        }

        if (new Date(b.start) <= now) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Past slot in cart",
          });
        }

        const tId = typeof b.tenant === "string" ? b.tenant : b.tenant?.id;
        if (!tId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bad tenant ref",
          });
        tenantIds.add(tId);
      }

      if (tenantIds.size !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All slots in one order must belong to the same provider",
        });
      }
      const [tenantId] = [...tenantIds] as [string];

      // Load tenant (needed for snapshots + hourlyRate fallback)
      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
      })) as DocWithId<Tenant> | null;

      if (!tenant)
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

      // NOTE: For Stage-1 (no payments), you can decide whether to keep this gate.
      // Keeping it matches your current onboarding logic and prevents “unpayable” bookings.
      if (tenant.onboardingStatus !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provider is not ready to take bookings yet.",
        });
      }

      // Customer snapshot completeness (still useful for later invoicing)
      const firstName = (payloadUser.firstName ?? "").trim();
      const lastName = (payloadUser.lastName ?? "").trim();
      const location = (payloadUser.location ?? "").trim();
      const country = (payloadUser.country ?? "").trim();

      if (!firstName || !lastName || !location || !country) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Please complete your profile (name and address) before booking.",
        });
      }

      // Compute amount (for later invoices). Keep same logic as before.
      let total = 0;
      for (const b of bookings) {
        const start = new Date(b.start);
        const end = new Date(b.end);
        const hours = Math.max(
          0,
          (end.getTime() - start.getTime()) / (60 * 60 * 1000),
        );

        const rate =
          b.serviceSnapshot?.hourlyRate != null
            ? Number(b.serviceSnapshot.hourlyRate)
            : Number(tenant.hourlyRate ?? 0);

        total += hours * rate;
      }

      if (!Number.isFinite(total) || total <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid total amount",
        });
      }

      const amountCents = toCents(total);
      const feeCents = Math.max(
        0,
        Math.round((amountCents * COMMISSION_RATE_BPS) / 10000),
      );

      const slotIds = bookings.map((b) => b.id);

      // Create slot-mode order (NO STRIPE FIELDS)
      const order = await ctx.db.create({
        collection: "orders",
        data: {
          lifecycleMode: "slot",
          // In the new model, this is not “paid/pending payment”; it’s a reservation/order record.
          // Keep your existing status enum; "pending" is fine for now.
          status: "pending",

          // service lifecycle starts scheduled
          serviceStatus: "scheduled",
          invoiceStatus: "none",

          user: payloadUserId,
          tenant: tenantId,
          slots: slotIds,

          // Store amount + fee for later (invoice calc consistency).
          amount: amountCents,
          currency: "eur",
          applicationFee: feeCents,

          // Keep a small grace window for abandoned carts / release logic (optional now).
          reservedUntil: addHours(new Date(), 1).toISOString(),

          customerSnapshot: {
            firstName,
            lastName,
            location,
            country,
            email: payloadUser.email ?? undefined,
          },
          vendorSnapshot: {
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            stripeAccountId: tenant.stripeAccountId ?? undefined,
          },
        },
        overrideAccess: true,
        depth: 0,
      });

      // IMPORTANT: since there is NO payment, bookings must become confirmed now.
      // Also set serviceStatus/paymentStatus for Stage-1 tracking.
      // (You already planned: confirmed + serviceStatus=scheduled + paymentStatus=unpaid)
      let updatedCount: number | null = null;

      try {
        const updateRes = await ctx.db.update({
          collection: "bookings",
          where: {
            and: [
              { id: { in: slotIds } },
              { status: { equals: "booked" } },
              { customer: { equals: payloadUserId } },
            ],
          },
          data: {
            status: "confirmed",
            serviceStatus: "scheduled",
            paymentStatus: "unpaid",
          },
          overrideAccess: true,
        });

        // prevent creattion of orphant orders if some slots were not updated:
        updatedCount = Array.isArray(updateRes?.docs)
          ? updateRes.docs.length
          : null;

        if (updatedCount === null) {
          const verify = await ctx.db.find({
            collection: "bookings",
            where: {
              and: [
                { id: { in: slotIds } },
                { status: { equals: "confirmed" } },
                { customer: { equals: payloadUserId } },
              ],
            },
            limit: slotIds.length,
            depth: 0,
            overrideAccess: true,
          });

          updatedCount = verify.docs?.length ?? 0;
        }
      } catch (err) {
        try {
          await ctx.db.update({
            collection: "orders",
            id: order.id,
            data: { status: "canceled" },
            overrideAccess: true,
          });
        } catch {}

        throw err;
      }

      if (updatedCount !== slotIds.length) {
        await ctx.db.update({
          collection: "orders",
          id: order.id,
          data: { status: "canceled" },
          overrideAccess: true,
        });

        throw new TRPCError({
          code: "CONFLICT",
          message: "Some slots changed while checking out. Please try again.",
        });
      }

      // Phase D: order.created emails are sent only on insert, after slots are confirmed.
      const ordersUrl = toAbsolute("/orders");
      const tenantSlug = typeof tenant.slug === "string" ? tenant.slug : "";
      const tenantName = typeof tenant.name === "string" ? tenant.name : "";
      // Include tenant context so email CTAs don't land in the wrong dashboard.
      const dashboardUrl = toAbsolute(
        tenantSlug
          ? `/dashboard?tenant=${encodeURIComponent(tenantSlug)}`
          : "/dashboard",
      );
      const services = extractServiceNames(bookings);
      const dateRange = extractDateRange(bookings);
      const customerName = `${firstName} ${lastName}`.trim();

      // Customer notification: order created (best-effort, non-blocking).
      if (payloadUser.email) {
        try {
          await sendDomainEmail({
            db: ctx.db,
            eventType: "order.created.customer",
            entityType: "order",
            entityId: order.id,
            recipientUserId: payloadUserId,
            toEmail: payloadUser.email,
            deliverability: toEmailDeliverability(payloadUser),
            data: {
              tenantName,
              tenantSlug,
              customerName,
              orderId: order.id,
              ordersUrl,
              services,
              dateRangeStart: dateRange?.start,
              dateRangeEnd: dateRange?.end ?? undefined,
              locale: payloadUser.language ?? "en",
            },
          });
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[email] order.created.customer failed", err);
          }
        }
      }

      // Tenant notification: order created (best-effort, non-blocking).
      const ownerId = typeof tenant.user === "string" ? tenant.user : tenant.user?.id;
      if (ownerId) {
        const tenantUser = (await ctx.db.findByID({
          collection: "users",
          id: ownerId,
          depth: 0,
          overrideAccess: true,
        })) as DocWithId<User> | null;

        if (tenantUser?.email) {
          try {
            await sendDomainEmail({
              db: ctx.db,
              eventType: "order.created.tenant",
              entityType: "order",
              entityId: order.id,
              recipientUserId: ownerId,
              toEmail: tenantUser.email,
              deliverability: toEmailDeliverability(tenantUser),
              data: {
                tenantName,
                customerName,
                orderId: order.id,
                dashboardUrl,
                services,
                dateRangeStart: dateRange?.start,
                dateRangeEnd: dateRange?.end ?? undefined,
                locale: tenantUser.language ?? "en",
              },
            });
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              console.error("[email] order.created.tenant failed", err);
            }
          }
        }
      }

      return { ok: true, orderId: order.id };
    }),
});
