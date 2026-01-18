// src/modules/checkout/server/slot-procedures.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import type { Booking, Tenant, User } from "@/payload-types";
import { addHours } from "date-fns";
import { assertTermsAccepted } from "@/modules/legal/terms-of-use/assert-terms-accepted";
import {
  COMMISSION_RATE_BPS_DEFAULT as COMMISSION_RATE_BPS,
  MAX_SLOTS_PER_BOOKING,
} from "@/constants";

type DocWithId<T> = T & { id: string };

// cents helper (kept: you still want amounts stored on the order, for later invoicing)
const toCents = (amount: number) => Math.round(amount * 100);

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
          slots: bookings.map((b) => b.id),

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
      await ctx.db.update({
        collection: "bookings",
        where: {
          and: [
            { id: { in: bookings.map((b) => b.id) } },
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

      return { ok: true, orderId: order.id };
    }),
});
