// status checks (booked → pay → confirmed),
// amount calculation from duration * rate,
// platform fee via application_fee_amount,
// saving checkoutSessionId back to the order,
// success/cancel URL logic with generateTenantUrl.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { stripe } from "@/lib/stripe";
import type { Booking, Tenant, User } from "@/payload-types";
import { CheckoutMetadata } from "./types";
import { addHours } from "date-fns";

// If you already have this helper in your project, keep the import.
// Otherwise, success/cancel can use NEXT_PUBLIC_APP_URL as a fallback.
import { generateTenantUrl } from "@/lib/utils";

// platform fee: keep simple % for now
const PLATFORM_FEE_PERCENT = 10;

// cents helper
const toCents = (amount: number) => Math.round(amount * 100);

type DocWithId<T> = T & { id: string };

export const checkoutRouter = createTRPCRouter({
  ping: baseProcedure.query(() => "pong"), // ← TEMPORARY

  /**
   * Client calls this from the cart drawer.
   * Input: the Booking (slot) ids that the current user already “booked”.
   * Output: a Stripe Checkout Session URL.
   */
  createSession: baseProcedure
    .input(
      z.object({
        slotIds: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clerkUserId = ctx.userId;
      if (!clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Clerk → Payload user
      const me = await ctx.db.find({
        collection: "users",
        where: { clerkUserId: { equals: clerkUserId } },
        limit: 1,
        depth: 0,
      });
      const payloadUser = (me.docs?.[0] as DocWithId<User> | undefined) ?? null;
      if (!payloadUser) throw new TRPCError({ code: "FORBIDDEN" });
      const payloadUserId = payloadUser.id;

      // Load requested bookings
      const found = await ctx.db.find({
        collection: "bookings",
        where: { id: { in: input.slotIds } },
        limit: input.slotIds.length,
        depth: 0,
      });

      const bookings = (found.docs ?? []) as Array<DocWithId<Booking>>;
      // Sanity: all found?
      if (bookings.length !== input.slotIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some slots not found",
        });
      }

      // All belong to the same tenant, are booked by this user, and are in the future
      const now = new Date();
      const tenantIds = new Set<string>();
      for (const b of bookings) {
        // status/booker checks
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

        // time check
        if (new Date(b.start) <= now) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Past slot in cart",
          });
        }

        // tenant id
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
          message: "All slots in one checkout must belong to the same provider",
        });
      }
      const [tenantId] = [...tenantIds] as [string];

      // Load tenant (for hourlyRate + stripeAccountId + slug)
      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 0,
      })) as DocWithId<Tenant> | null;

      if (!tenant)
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

      if (!tenant.stripeAccountId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provider missing Stripe account",
        });
      }

      // (Optionally) guard selling to only verified vendors
      if (tenant.stripeDetailsSubmitted !== true) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provider is not ready to take payments yet",
        });
      }

      // Compute amount from duration and rate
      // You enforce 60-min slots; keep generic just in case.
      let total = 0;
      for (const b of bookings) {
        const start = new Date(b.start);
        const end = new Date(b.end);
        const hours = Math.max(
          0,
          (end.getTime() - start.getTime()) / (60 * 60 * 1000)
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
        Math.round((amountCents * PLATFORM_FEE_PERCENT) / 100)
      );

      // Create "pending" order
      const order = await ctx.db.create({
        collection: "orders",
        data: {
          status: "pending",
          user: payloadUserId,
          tenant: tenantId,
          slots: bookings.map((b) => b.id),
          amount: amountCents,
          currency: "eur",
          applicationFee: feeCents,
          destination: tenant.stripeAccountId,
          // small UX grace: time window during which we consider the reservation active
          reservedUntil: addHours(new Date(), 1).toISOString(),
        },
        overrideAccess: true,
        depth: 0,
      });

      // Build URLs (prefer your helper if present)
      let successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      let cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel`;
      try {
        // generateTenantUrl(slug) → https://<slug>.<root-domain>
        let slug = tenant.slug;
        if (!slug) {
          // fallback from snapshot (when you have it)
          const s = bookings[0]?.serviceSnapshot?.tenantSlug;
          if (s) slug = s;
        }
        if (slug) {
          const domain = generateTenantUrl(slug);
          successUrl = `${domain}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
          cancelUrl = `${domain}/checkout/cancel`;
        }
      } catch {
        // fall back silently to NEXT_PUBLIC_APP_URL
      }

      // Create Stripe Checkout Session on the PLATFORM
      // Money routes to the vendor via transfer_data; your fee via application_fee_amount
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: payloadUser.email ?? undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: [
          {
            quantity: 1,
            price_data: {
              unit_amount: amountCents,
              currency: "eur",
              product_data: {
                name: `${tenant.name ?? "Service"} – ${bookings.length} slot${bookings.length > 1 ? "s" : ""}`,
                description: `Booking for ${tenant.name ?? "provider"}`,
              },
            },
          },
        ],
        payment_intent_data: {
          application_fee_amount: feeCents,
          transfer_data: { destination: tenant.stripeAccountId as string },
        },
        metadata: {
          orderId: order.id,
          userId: payloadUserId,
          tenantId,
          slotIdsCsv: bookings.map((b) => b.id).join(","),
        } as CheckoutMetadata,
        invoice_creation: { enabled: true },
      });

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }

      // Save session id to the order
      await ctx.db.update({
        collection: "orders",
        id: order.id,
        data: { checkoutSessionId: session.id },
        overrideAccess: true,
      });

      return { url: session.url };
    }),

  /**
   * Small helper for the success page to poll until the webhook finalizes the order.
   */
  getOrderBySessionId: baseProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.db.find({
        collection: "orders",
        where: { checkoutSessionId: { equals: input.sessionId } },
        limit: 1,
        depth: 1,
      });
      return res.docs?.[0] ?? null;
    }),
});
