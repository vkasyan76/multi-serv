// src/app/(app)/api/stripe/route.ts
import type { Stripe } from "stripe";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { stripe } from "@/lib/stripe";
import { parseSlotIdsCsv } from "@/modules/checkout/server/types";
import type { Order } from "@/payload-types";

export const runtime = "nodejs"; // ensure Node runtime for raw body access

const devLog = (...args: unknown[]) => {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.STRIPE_WEBHOOK_LOGS === "1"
  ) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

/**
 * Small helper to read the Payment Intent id from a Checkout Session
 * (Stripe returns it as a string OR as an expanded object).
 */

type WebhookOrder = Pick<Order, "id" | "status">;

const paymentIntentIdOf = (s: Stripe.Checkout.Session): string | null => {
  if (typeof s.payment_intent === "string") return s.payment_intent;
  if (s.payment_intent) return (s.payment_intent as Stripe.PaymentIntent).id;
  return null;
};

export async function POST(req: Request) {
  // Payload instance – used to read/update your collections atomically
  const payload = await getPayload({ config });

  // ---------- 1) Verify the incoming Stripe event ----------
  // We must verify the signature to ensure this POST really comes from Stripe.
  let event: Stripe.Event;
  try {
    // Stripe sends a signature header we verify against our webhook secret
    const sig = req.headers.get("stripe-signature") as string;

    // IMPORTANT: we must give Stripe the *raw* request body bytes (not parsed JSON)  already set export const runtime = "nodejs", you can simplify
    const rawBody = await req.text();

    // Create a trusted Event object or throw if the signature is invalid
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    devLog("[webhook] received:", event.type);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("❌ Webhook verify failed:", msg);
    // Respond 400 so Stripe knows this delivery failed (they will retry)
    return NextResponse.json(
      { message: `Webhook Error: ${msg}` },
      { status: 400 }
    );
  }

  // ---------- 2) Handle only the events we care about ----------
  try {
    switch (event.type) {
      /**
       * Fired after the user completed the hosted checkout flow and Stripe successfully
       * created/confirmed the Payment Intent. This is our “happy path”.
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Metadata we attached when creating the Checkout Session:
        // - orderId: our pending order document id
        // - userId: the Payload user who’s paying
        // - slotIdsCsv: which bookings are being purchased (comma-separated)
        const orderId = (session.metadata?.orderId ?? null) as string | null;
        const userId = (session.metadata?.userId ?? null) as string | null;
        const slotIds = parseSlotIdsCsv(session.metadata?.slotIdsCsv);

        // If anything critical is missing, we quietly “ack” the webhook (no hard failure)
        if (!orderId || !userId || slotIds.length === 0) {
          devLog("[webhook] session.completed missing metadata", {
            orderId,
            userId,
            slotIdsCsv: session.metadata?.slotIdsCsv,
          });

          return NextResponse.json({ ok: true }, { status: 200 });
        }

        // Idempotency guard: if we already processed this order, do nothing.
        // (Stripe may retry webhooks; we must be resilient.)
        const order = (await payload.findByID({
          collection: "orders",
          id: orderId,
          depth: 0,
          overrideAccess: true,
        })) as WebhookOrder | null;
        if (!order) return NextResponse.json({ ok: true }, { status: 200 });
        if (order.status && order.status !== "pending") {
          return NextResponse.json({ ok: true }, { status: 200 });
        }

        // Optional: capture Payment Intent id for later reconciliation
        const piId = paymentIntentIdOf(session);

        // 2.1) Confirm the bookings: booked → confirmed
        // We only touch bookings that are still “booked” by this same user.
        await payload.update({
          collection: "bookings",
          where: {
            and: [
              { id: { in: slotIds } },
              { status: { equals: "booked" } },
              { customer: { equals: userId } },
            ],
          },
          data: { status: "confirmed" },
          overrideAccess: true,
        });

        // 2.2) Mark the order paid and persist Stripe ids for auditing
        await payload.update({
          collection: "orders",
          id: orderId,
          data: {
            status: "paid",
            paymentIntentId: piId ?? undefined,
            checkoutSessionId: session.id,
            // Optionally: override amount/currency from Stripe here if you want strict reconciliation
            // amount: session.amount_total ?? (order as any).amount,
            // currency: session.currency ?? (order as any).currency,
          },
          overrideAccess: true,
        });

        break;
      }

      /**
       * Fired when a Checkout Session expires (user abandoned / payment not completed).
       * We roll back the pending order and release the reserved bookings.
       */
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;

        const orderId = (session.metadata?.orderId ?? null) as string | null;
        const userId = (session.metadata?.userId ?? null) as string | null;
        const slotIds = parseSlotIdsCsv(session.metadata?.slotIdsCsv);

        if (!orderId || !userId || slotIds.length === 0) {
          return NextResponse.json({ ok: true }, { status: 200 });
        }

        // Only cancel if the order is still “pending”
        const order = (await payload.findByID({
          collection: "orders",
          id: orderId,
          depth: 0,
          overrideAccess: true,
        })) as WebhookOrder | null;
        if (!order) return NextResponse.json({ ok: true }, { status: 200 });
        if (order.status && order.status !== "pending") {
          return NextResponse.json({ ok: true }, { status: 200 });
        }

        // 2.1) Cancel the order
        await payload.update({
          collection: "orders",
          id: orderId,
          data: { status: "canceled" },
          overrideAccess: true,
        });

        // 2.2) Release the bookings back to “available” so others can buy them
        await payload.update({
          collection: "bookings",
          where: {
            and: [
              { id: { in: slotIds } },
              { status: { equals: "booked" } },
              { customer: { equals: userId } },
            ],
          },
          data: { status: "available", customer: null },
          overrideAccess: true,
        });

        break;
      }

      /**
       * Optional safety net: payment intent failed before Checkout emitted “expired”.
       * We usually rely on the “expired” event and do nothing here.
       */
      case "payment_intent.payment_failed": {
        break;
      }

      /**
       * Keep your local tenant flag (stripeDetailsSubmitted) in sync with Stripe
       * so you can block unverified vendors from selling.
       */
      case "account.updated": {
        const acct = event.data.object as Stripe.Account;
        await payload.update({
          collection: "tenants",
          where: { stripeAccountId: { equals: acct.id } },
          data: { stripeDetailsSubmitted: acct.details_submitted },
          overrideAccess: true,
        });
        break;
      }

      // Ignore everything else
      default:
        break;
    }

    // Always 200 OK on successful handling (even if we no-op on unknown events)
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // Any unexpected error → 500 (Stripe will retry)
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { message: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
