// src/modules/payments/server/procedures.ts
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import type { PaymentProfile, Tenant } from "@/payload-types";
import { getTenantOrigin } from "@/lib/utils";

type PayloadDb = {
  find: (args: {
    collection: "users" | "payment_profiles";
    where?: Record<string, unknown>;
    limit?: number;
    depth?: number;
    overrideAccess?: boolean;
    sort?: string;
  }) => Promise<{ docs?: unknown[] }>;

  findByID: (args: {
    collection: "tenants";
    id: string;
    depth?: number;
    overrideAccess?: boolean;
  }) => Promise<unknown | null>;

  create: (args: {
    collection: "payment_profiles";
    data: Record<string, unknown>;
    depth?: number;
    overrideAccess?: boolean;
  }) => Promise<unknown>;

  update: (args: {
    collection: "payment_profiles";
    id: string;
    data: Record<string, unknown>;
    depth?: number;
    overrideAccess?: boolean;
  }) => Promise<unknown>;
};

function dbFrom(ctx: { db: unknown }): PayloadDb {
  return ctx.db as PayloadDb;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function resolvePayloadUserId(
  ctx: { db: unknown },
  clerkUserId: string
): Promise<string> {
  const db = dbFrom(ctx);

  const me = await db.find({
    collection: "users",
    where: { clerkUserId: { equals: clerkUserId } },
    limit: 1,
    depth: 0,
  });

  const doc = me.docs?.[0] as { id?: string } | undefined;
  const payloadUserId = doc?.id;

  if (!payloadUserId) throw new TRPCError({ code: "FORBIDDEN" });
  return payloadUserId;
}

async function loadTenantStripeAccountId(
  ctx: { db: unknown },
  tenantId: string
): Promise<string> {
  const db = dbFrom(ctx);

  const tenant = (await db.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as Tenant | null;

  if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

  // You DO have this field and it is required in Tenants.ts
  const stripeAccountId = tenant.stripeAccountId;

  // Guard anyway (even though schema says required)
  if (!stripeAccountId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED", // ✅ valid tRPC code (NOT "FAILED_PRECONDITION")
      message: "Tenant has no connected Stripe account",
    });
  }

  return stripeAccountId;
}

async function findProfileByUserTenantKey(
  ctx: { db: unknown },
  userTenantKey: string
): Promise<PaymentProfile | null> {
  const db = dbFrom(ctx);

  const res = await db.find({
    collection: "payment_profiles",
    where: { userTenantKey: { equals: userTenantKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const doc = res.docs?.[0] as PaymentProfile | undefined;
  return doc ?? null;
}

async function ensureProfile(
  ctx: { db: unknown },
  payloadUserId: string,
  tenantId: string
): Promise<PaymentProfile> {
  const db = dbFrom(ctx);
  const userTenantKey = `${payloadUserId}:${tenantId}`;

  const existing = await findProfileByUserTenantKey(ctx, userTenantKey);
  if (existing) return existing;

  const stripeAccountId = await loadTenantStripeAccountId(ctx, tenantId);

  const created = (await db.create({
    collection: "payment_profiles",
    data: {
      user: payloadUserId,
      tenant: tenantId,
      userTenantKey,
      status: "missing",
      stripeAccountId,
    },
    overrideAccess: true,
    depth: 0,
  })) as PaymentProfile;

  return created;
}

// instead of hard failing, you continue with a new customer and you already persist the new stripeCustomerId right after.
async function ensureStripeCustomerInConnectedAccount(
  connectedAccountId: string,
  existingCustomerId: string | null | undefined
): Promise<string> {
  if (existingCustomerId) {
    try {
      await stripe.customers.retrieve(
        existingCustomerId,
        {},
        { stripeAccount: connectedAccountId }
      );
      return existingCustomerId;
    } catch {
      // Customer missing / invalid in this connected account → create a new one
    }
  }

  const customer = await stripe.customers.create(
    {},
    { stripeAccount: connectedAccountId }
  );

  return customer.id;
}

function profileSummary(doc: PaymentProfile) {
  return {
    status: doc.status,
    cardBrand: doc.cardBrand ?? null,
    cardLast4: doc.cardLast4 ?? null,
    setupCompletedAt: doc.setupCompletedAt ?? null,
  };
}

export const paymentsRouter = createTRPCRouter({
  /**
   * 1) getOrCreateProfileForTenant
   */
  getOrCreateProfileForTenant: baseProcedure
    .input(z.object({ tenantId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);

      const userTenantKey = `${payloadUserId}:${input.tenantId}`;
      const existing = await findProfileByUserTenantKey(ctx, userTenantKey);

      // no DB record created here
      if (!existing) {
        return {
          status: "missing",
          cardBrand: null,
          cardLast4: null,
          setupCompletedAt: null,
        };
      }

      return profileSummary(existing);
    }),

  // 1.1. createSetupSession

  createSetupSession: baseProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        returnTo: z
          .string()
          .min(1)
          .refine((v) => v.startsWith("/"), "returnTo must be a relative path"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
      const profile = await ensureProfile(ctx, payloadUserId, input.tenantId);

      const connectedAccountId =
        profile.stripeAccountId ??
        (await loadTenantStripeAccountId(ctx, input.tenantId));

      const customerId = await ensureStripeCustomerInConnectedAccount(
        connectedAccountId,
        profile.stripeCustomerId ?? null
      );

      // Persist customer id if it was missing/changed
      if (profile.stripeCustomerId !== customerId) {
        const db = dbFrom(ctx);
        await db.update({
          collection: "payment_profiles",
          id: profile.id,
          data: { stripeCustomerId: customerId },
          overrideAccess: true,
          depth: 0,
        });
      }

      // ✅ Build redirect URLs using the tenant origin (supports subdomain routing)
      const db = dbFrom(ctx);
      const tenant = (await db.findByID({
        collection: "tenants",
        id: input.tenantId,
        depth: 0,
        overrideAccess: true,
      })) as Tenant | null;

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

      let origin: string;
      try {
        origin = getTenantOrigin(tenant.slug ?? null);
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            e instanceof Error ? e.message : "Could not build tenant origin",
        });
      }

      const sep = input.returnTo.includes("?") ? "&" : "?";
      const successUrl = `${origin}${input.returnTo}${sep}pm_setup=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}${input.returnTo}${sep}pm_setup=cancel`;

      const session = await stripe.checkout.sessions.create(
        {
          mode: "setup",
          payment_method_types: ["card"],
          customer: customerId,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            tenantId: input.tenantId,
            userId: payloadUserId,
            paymentProfileId: profile.id,
          },
        },
        { stripeAccount: connectedAccountId }
      );

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe session has no url",
        });
      }

      return { url: session.url };
    }),

  // 1.2. Finalized SetupFromSession

  finalizeSetupFromSession: baseProcedure
    .input(
      z.object({ tenantId: z.string().min(1), sessionId: z.string().min(1) })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
      const profile = await ensureProfile(ctx, payloadUserId, input.tenantId);

      const connectedAccountId =
        profile.stripeAccountId ??
        (await loadTenantStripeAccountId(ctx, input.tenantId));

      const session = await stripe.checkout.sessions.retrieve(
        input.sessionId,
        { expand: ["setup_intent", "setup_intent.payment_method"] },
        { stripeAccount: connectedAccountId }
      );

      if (session.mode !== "setup") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Not a setup session.",
        });
      }

      // Minimal integrity checks (avoid someone finalizing the wrong session)
      if (
        session.metadata?.tenantId &&
        session.metadata.tenantId !== input.tenantId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Session tenant mismatch.",
        });
      }
      if (
        session.metadata?.paymentProfileId &&
        session.metadata.paymentProfileId !== profile.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Session profile mismatch.",
        });
      }

      const sessionCustomerId =
        typeof session.customer === "string"
          ? session.customer
          : (session.customer?.id ?? null);

      if (!profile.stripeCustomerId && sessionCustomerId) {
        const db = dbFrom(ctx);
        await db.update({
          collection: "payment_profiles",
          id: profile.id,
          data: { stripeCustomerId: sessionCustomerId },
          overrideAccess: true,
          depth: 0,
        });
      } else if (
        profile.stripeCustomerId &&
        sessionCustomerId &&
        profile.stripeCustomerId !== sessionCustomerId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Session customer mismatch.",
        });
      }

      const setupIntentRef = session.setup_intent;
      if (!setupIntentRef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing setup_intent",
        });
      }

      const setupIntent: Stripe.SetupIntent =
        typeof setupIntentRef === "string"
          ? await stripe.setupIntents.retrieve(
              setupIntentRef,
              { expand: ["payment_method"] },
              { stripeAccount: connectedAccountId }
            )
          : setupIntentRef;

      const pmRef = setupIntent.payment_method;
      if (!pmRef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing payment_method",
        });
      }

      const pm: Stripe.PaymentMethod =
        typeof pmRef === "string"
          ? await stripe.paymentMethods.retrieve(
              pmRef,
              {},
              { stripeAccount: connectedAccountId }
            )
          : pmRef;

      if (pm.type !== "card" || !pm.card) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment method is not a card",
        });
      }

      const brand = pm.card.brand ?? null;
      const last4 = pm.card.last4 ?? null;
      const expMonth = pm.card.exp_month ?? null;
      const expYear = pm.card.exp_year ?? null;

      // Best-effort: make it default for invoices on that connected customer
      try {
        const customerId =
          profile.stripeCustomerId ?? sessionCustomerId ?? undefined;
        if (customerId) {
          await stripe.customers.update(
            customerId,
            { invoice_settings: { default_payment_method: pm.id } },
            { stripeAccount: connectedAccountId }
          );
        }
      } catch {
        // ignore
      }

      const db = dbFrom(ctx);
      const updated = (await db.update({
        collection: "payment_profiles",
        id: profile.id,
        data: {
          defaultPaymentMethodId: pm.id,
          cardBrand: brand,
          cardLast4: last4,
          cardExpMonth: expMonth,
          cardExpYear: expYear,
          status: "active",
          setupCompletedAt: nowIso(),
        },
        overrideAccess: true,
        depth: 0,
      })) as PaymentProfile;

      return profileSummary(updated);
    }),
});
