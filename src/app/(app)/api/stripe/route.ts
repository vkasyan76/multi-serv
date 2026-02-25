// src/app/(app)/api/stripe/route.ts
import type { Stripe } from "stripe";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { stripe } from "@/lib/stripe";
import { parseSlotIdsCsv } from "@/modules/checkout/server/types";
import { sendDomainEmail } from "@/modules/email/events";
import { consumePromotionAllocationIfReserved } from "@/modules/promotions/server";
import { promotionDecisionLog } from "@/modules/promotions/server/flags";
import type { Order, User } from "@/payload-types";

export const runtime = "nodejs"; // ensure Node runtime for raw body access

const devLog = (...args: unknown[]) => {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.STRIPE_WEBHOOK_LOGS === "1"
  ) {
    console.log(...args);
  }
};

/**
 * Small helper to read the Payment Intent id from a Checkout Session
 * (Stripe returns it as a string OR as an expanded object).
 */

type WebhookOrder = Pick<Order, "id" | "status">;

type WebhookInvoice = {
  id: string;
  status?: string | null;
  paidAt?: string | null;
  order?: string | { id: string } | null;
  tenant?: string | { id: string } | null;
  customer?: string | { id: string } | null;
  promotionAllocationId?: string | { id: string } | null;
  currency?: string | null;
  amountTotalCents?: number | null;
  platformFeeCents?: number | null;
  platformFeeRateBps?: number | null;
  platformFeeRuleId?: string | null;
  buyerEmail?: string | null;
  buyerName?: string | null;
  sellerEmail?: string | null;
  sellerLegalName?: string | null;
};

const paymentIntentIdOf = (s: Stripe.Checkout.Session): string | null => {
  if (typeof s.payment_intent === "string") return s.payment_intent;
  if (s.payment_intent) return (s.payment_intent as Stripe.PaymentIntent).id;
  return null;
};

// Email CTA URLs (prefer server APP_URL).
const toAbsolute = (path: string) => {
  const base =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return new URL(path, base).toString();
};

const toEmailDeliverability = (user: User) => ({
  status: user.emailDeliverabilityStatus ?? undefined,
  reason: user.emailDeliverabilityReason ?? undefined,
  retryAfter: user.emailDeliverabilityRetryAfter ?? undefined,
});

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

        // ✅ Invoice payments (pay-after-acceptance flow)
        const invoiceId = (session.metadata?.invoiceId ?? null) as
          | string
          | null;
        if (invoiceId) {
          const piId = paymentIntentIdOf(session);
          const metadataAllocationId =
            typeof session.metadata?.promotionAllocationId === "string"
              ? session.metadata.promotionAllocationId
              : null;
          let invoice: WebhookInvoice | undefined;

          // Guard: only treat paid sessions as success.
          if (session.payment_status !== "paid") {
            return NextResponse.json({ ok: true }, { status: 200 });
          }

          const byId = await payload.find({
            collection: "invoices",
            where: { id: { equals: invoiceId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          });
          invoice = byId.docs?.[0] as WebhookInvoice | undefined;

          if (!invoice) {
            const bySession = await payload.find({
              collection: "invoices",
              where: { stripeCheckoutSessionId: { equals: session.id } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            invoice = bySession.docs?.[0] as WebhookInvoice | undefined;
          }

          if (!invoice) return NextResponse.json({ ok: true }, { status: 200 });

          const paidNow = invoice.status !== "paid";
          const paidAt = paidNow
            ? new Date().toISOString()
            : invoice.paidAt ?? undefined;
          let updatedInvoice: WebhookInvoice | undefined;

          // Phase 4: record a collected-only commission event (idempotent by PI).
          if (piId) {
            const tenantId =
              typeof invoice.tenant === "string"
                ? invoice.tenant
                : invoice.tenant?.id;
            const feeCents = invoice.platformFeeCents ?? null;
            const rateBps = invoice.platformFeeRateBps ?? null;
            const ruleId = invoice.platformFeeRuleId ?? null;
            const currency = invoice.currency ?? null;

            if (tenantId && feeCents != null && rateBps != null && ruleId && currency) {
              try {
                const existing = await payload.find({
                  collection: "commission_events",
                  where: { paymentIntentId: { equals: piId } },
                  limit: 1,
                  depth: 0,
                  overrideAccess: true,
                });
                if (existing.totalDocs > 0) {
                  devLog("[webhook] commission event already exists", {
                    paymentIntentId: piId,
                  });
                } else {
                await payload.create({
                  collection: "commission_events",
                  data: {
                    tenant: tenantId,
                    invoice: invoice.id,
                    currency,
                    feeCents,
                    rateBps,
                    ruleId,
                    paymentIntentId: piId,
                    collectedAt: new Date(event.created * 1000).toISOString(),
                  },
                  overrideAccess: true,
                });
                }
              } catch (err) {
                const code = (err as { code?: number }).code;
                const message = (err as Error)?.message ?? "";
                // Ignore duplicate inserts on webhook retries.
                if (code !== 11000 && !/duplicate|unique/i.test(message)) {
                  throw err;
                }
              }
            } else {
              devLog("[webhook] missing commission snapshot for invoice", {
                invoiceId: invoice.id,
                tenantId,
                feeCents,
                rateBps,
                ruleId,
                currency,
              });
            }
          }

          if (paidNow) {
            updatedInvoice = (await payload.update({
              collection: "invoices",
              id: invoice.id,
              data: {
                status: "paid",
                stripePaymentIntentId: piId ?? undefined,
                paidAt: paidAt!,
              },
              overrideAccess: true,
            })) as WebhookInvoice;
          }

          const fullInvoice = updatedInvoice
            ? { ...invoice, ...updatedInvoice }
            : invoice;

          const orderId =
            typeof invoice.order === "string"
              ? invoice.order
              : invoice.order?.id;
          if (orderId) {
            await payload.update({
              collection: "orders",
              id: orderId,
              data: {
                invoiceStatus: "paid",
                ...(paidAt ? { paidAt } : {}),
              },
              overrideAccess: true,
            });
          }

          // Phase E: send invoice.paid emails only on the paid transition.
          if (paidNow) {
            const full = fullInvoice;
            const ordersUrl = toAbsolute("/orders");
            const customerEmail = full.buyerEmail ?? undefined;
            const tenantEmail = full.sellerEmail ?? undefined;
            const customerName =
              (full.buyerName ?? "").trim() || undefined;
            const tenantName =
              (full.sellerLegalName ?? "").trim() || undefined;

            try {
              if (customerEmail) {
                await sendDomainEmail({
                  db: payload,
                  eventType: "invoice.paid.customer",
                  entityType: "invoice",
                  entityId: full.id,
                  recipientUserId:
                    typeof full.customer === "string"
                      ? full.customer
                      : full.customer?.id,
                  toEmail: customerEmail,
                  data: {
                    customerName,
                    tenantName,
                    invoiceId: full.id,
                    orderId: orderId ?? undefined,
                    amountTotalCents: full.amountTotalCents ?? 0,
                    currency: full.currency ?? "eur",
                    ordersUrl,
                  },
                });
              }

              if (tenantEmail) {
                // Include tenant context so email CTAs don't land in the wrong dashboard.
                let dashboardUrl = toAbsolute("/dashboard");
                const tenantId =
                  typeof full.tenant === "string"
                    ? full.tenant
                    : full.tenant?.id;
                if (tenantId) {
                  const tenant = await payload.findByID({
                    collection: "tenants",
                    id: tenantId,
                    depth: 0,
                    overrideAccess: true,
                  });
                  const slug =
                    typeof tenant?.slug === "string" ? tenant.slug : "";
                  if (slug) {
                    dashboardUrl = toAbsolute(
                      `/dashboard?tenant=${encodeURIComponent(slug)}`,
                    );
                  }
                }

                await sendDomainEmail({
                  db: payload,
                  eventType: "invoice.paid.tenant",
                  entityType: "invoice",
                  entityId: full.id,
                  // Tenant email uses snapshot address; owner user id may not be available here.
                  toEmail: tenantEmail,
                  data: {
                    tenantName,
                    customerName,
                    invoiceId: full.id,
                    orderId: orderId ?? undefined,
                    amountTotalCents: full.amountTotalCents ?? 0,
                    currency: full.currency ?? "eur",
                    dashboardUrl,
                  },
                });
              }
            } catch (err) {
              if (process.env.NODE_ENV !== "production") {
                console.error("[email] invoice.paid webhook failed", err);
              }
            }
          }

          // Retry-safe consume is only relevant when we have an allocation id source.
          const hasAllocationHint =
            Boolean(
              typeof fullInvoice.promotionAllocationId === "string"
                ? fullInvoice.promotionAllocationId
                : fullInvoice.promotionAllocationId?.id,
            ) || Boolean(metadataAllocationId?.trim());

          if (hasAllocationHint) {
            // Keep consumedAt stable across retries for audit consistency.
            const consumedAt =
              fullInvoice.paidAt ??
              paidAt ??
              new Date(event.created * 1000).toISOString();

            // Consume is idempotent; keep email flow non-blocking on transient consume errors.
            try {
              const consumeResult = await consumePromotionAllocationIfReserved({
                payload,
                invoiceId: fullInvoice.id,
                invoicePromotionAllocationId: fullInvoice.promotionAllocationId,
                fallbackAllocationId: metadataAllocationId,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: piId,
                consumedAt,
              });
              if (consumeResult.allocationId) {
                promotionDecisionLog("allocation_consume_result", {
                  invoiceId: fullInvoice.id,
                  allocationId: consumeResult.allocationId,
                  updatedCount: consumeResult.updatedCount,
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: piId,
                  paidNow,
                });
                // No-op is expected on retries; warn only for first paid transition.
                if (consumeResult.updatedCount === 0 && paidNow) {
                  console.warn(
                    "[webhook] promotion allocation consume no-op on paid transition",
                    {
                      invoiceId: fullInvoice.id,
                      allocationId: consumeResult.allocationId,
                      stripeCheckoutSessionId: session.id,
                    },
                  );
                }
              }
            } catch (err) {
              // Intentionally non-blocking: keep webhook 200 so paid-transition emails are not lost.
              // Recover allocation state via retry-safe consume on later deliveries or ops repair.
              console.error(
                "[webhook] promotion allocation consume failed; continuing",
                {
                  invoiceId: fullInvoice.id,
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: piId,
                  invoicePromotionAllocationId: fullInvoice.promotionAllocationId,
                  fallbackAllocationId: metadataAllocationId,
                  consumedAt,
                  hasPayload: Boolean(payload),
                  error:
                    err instanceof Error
                      ? {
                          name: err.name,
                          message: err.message,
                          stack: err.stack,
                        }
                      : err,
                },
              );
            }
          }

          return NextResponse.json({ ok: true }, { status: 200 });
        }

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
        const { docs } = await payload.find({
          collection: "orders",
          where: { id: { equals: orderId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });

        const order = docs[0] as WebhookOrder | undefined;
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

        // 2) Non-blocking enrichment: try to fetch & store the receipt URL - saved in the order collection
        try {
          // For your flow (destination charges on the PLATFORM), the charge lives on the platform,
          // With direct charges, the header is needed
          // event is already Stripe.Event
          const accountId: string | undefined = event.account ?? undefined; // When you retrieve Stripe objects, include the connected account

          const retrieveParams: Stripe.Checkout.SessionRetrieveParams = {
            expand: ["payment_intent.latest_charge"],
          };

          const requestOptions: Stripe.RequestOptions | undefined = accountId
            ? { stripeAccount: accountId }
            : undefined;

          const expandedSession = await stripe.checkout.sessions.retrieve(
            session.id,
            retrieveParams,
            requestOptions
          );

          const latestCharge =
            typeof expandedSession.payment_intent === "string"
              ? null
              : expandedSession.payment_intent?.latest_charge;

          const receiptUrl =
            latestCharge && typeof latestCharge !== "string"
              ? (latestCharge.receipt_url ?? undefined)
              : undefined;

          if (receiptUrl) {
            await payload.update({
              collection: "orders",
              id: orderId,
              data: { receiptUrl },
              overrideAccess: true,
            });
          }
        } catch (e) {
          // Keep this non-fatal so the webhook still returns 200
          devLog(
            "[webhook] could not enrich receiptUrl:",
            (e as Error)?.message
          );
        }

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

        // Only cancel if the order is still “pending”  - use find instead of findByID otherwise payload.findByID throws when the doc doesn’t exist, so our if (!order) … never runs and the webhook returns 500.
        const { docs } = await payload.find({
          collection: "orders",
          where: { id: { equals: orderId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });

        const order = docs[0] as WebhookOrder | undefined;
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
        // Derive a tiny snapshot we can show in the UI without hitting Stripe every time
        const chargesEnabled = !!acct.charges_enabled;
        const payoutsEnabled = !!acct.payouts_enabled;
        const requirementsDue = (acct.requirements?.currently_due ??
          []) as string[];
        const disabledReason = acct.requirements?.disabled_reason ?? null;

        // Define onboardingStatus
        const onboardingStatus: "completed" | "in_progress" | "restricted" =
          chargesEnabled && payoutsEnabled
            ? "completed"
            : disabledReason
              ? "restricted"
              : "in_progress";

        const tenantRes = await payload.find({
          collection: "tenants",
          where: { stripeAccountId: { equals: acct.id } },
          limit: 1,
          overrideAccess: true,
          depth: 0,
        });
        const tenant = tenantRes.docs[0];
        if (!tenant) break;

        const becameCompleted =
          tenant.onboardingStatus !== "completed" &&
          onboardingStatus === "completed";

        await payload.update({
          collection: "tenants",
          id: tenant.id,
          data: {
            stripeDetailsSubmitted: acct.details_submitted,
            // Stripe snapshot fields
            chargesEnabled,
            payoutsEnabled,
            stripeRequirements: requirementsDue,
            onboardingStatus,
            lastStripeSyncAt: new Date().toISOString(),
          },
          overrideAccess: true,
        });

        // Milestone email: payouts enabled (webhook is the canonical source).
        if (becameCompleted && !tenant.emailNotifiedPayoutsEnabledAt) {
          try {
            const ownerId =
              typeof tenant.user === "string" ? tenant.user : tenant.user?.id;
            if (ownerId) {
              const ownerRes = await payload.find({
                collection: "users",
                where: { id: { equals: ownerId } },
                limit: 1,
                overrideAccess: true,
                depth: 0,
              });
              const owner = ownerRes.docs[0] as User | undefined;
              const toEmail = (owner?.email ?? "").trim();

              if (toEmail) {
                await sendDomainEmail({
                  db: payload,
                  eventType: "payouts.enabled.tenant",
                  entityType: "tenant",
                  entityId: String(tenant.id),
                  recipientUserId: String(ownerId),
                  toEmail,
                  deliverability: owner
                    ? toEmailDeliverability(owner)
                    : undefined,
                  data: {
                    tenantName: tenant.name ?? undefined,
                    ctaUrl: toAbsolute("/profile?tab=payouts"),
                  },
                });

                await payload.update({
                  collection: "tenants",
                  id: tenant.id,
                  data: {
                    emailNotifiedPayoutsEnabledAt: new Date().toISOString(),
                  },
                  overrideAccess: true,
                });
              }
            }
          } catch (err) {
            console.warn("[email] payouts.enabled.tenant failed", err);
          }
        }
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
