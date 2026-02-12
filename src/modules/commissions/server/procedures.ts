import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { resolvePayloadUserId } from "@/modules/orders/server/identity";
import { buildStatementNumber, getBerlinMonthRange } from "./statement-utils";

type PayloadTenant = { id: string; slug?: string | null };
type CommissionEventDoc = {
  id: string;
  feeCents?: number | null;
  paymentIntentId?: string | null;
  collectedAt?: string | null;
};

async function requireSuperAdmin(
  ctx: TRPCContext,
): Promise<{ userId: string }> {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
  const user = await ctx.db.findByID({
    collection: "users",
    id: payloadUserId,
    depth: 0,
    overrideAccess: true,
  });
  if (!user?.roles?.includes("super-admin")) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return { userId: payloadUserId };
}

export const commissionsRouter = createTRPCRouter({
  generateMonthlyStatement: baseProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);

      const { periodStart, periodEnd } = getBerlinMonthRange(
        input.year,
        input.month,
      );
      const periodStartIso = periodStart.toISOString();
      const periodEndIso = periodEnd.toISOString();

      const tenant = (await ctx.db.findByID({
        collection: "tenants",
        id: input.tenantId,
        depth: 0,
        overrideAccess: true,
      })) as PayloadTenant | null;

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      }

      const tenantSlug =
        (tenant.slug ?? "").trim() || input.tenantId.slice(-6);
      const currency = "eur";

      const existing = await ctx.db.find({
        collection: "commission_statements",
        where: {
          and: [
            { tenant: { equals: input.tenantId } },
            { periodStart: { equals: periodStartIso } },
            { currency: { equals: currency } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      const existingDoc = existing.docs?.[0] as { id?: string } | undefined;
      if (existingDoc?.id) {
        return { statementId: existingDoc.id, created: false };
      }

      const events = await ctx.db.find({
        collection: "commission_events",
        where: {
          and: [
            { tenant: { equals: input.tenantId } },
            { currency: { equals: currency } },
            { collectedAt: { greater_than_equal: periodStartIso } },
            { collectedAt: { less_than: periodEndIso } },
          ],
        },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
        sort: "collectedAt",
      });

      const docs = (events.docs ?? []) as CommissionEventDoc[];
      if (docs.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No commission events for this period.",
        });
      }

      const totalsNetCents = docs.reduce(
        (sum, doc) => sum + Number(doc.feeCents ?? 0),
        0,
      );
      const totalsVatCents = 0;
      const totalsGrossCents = totalsNetCents + totalsVatCents;

      const statementNumber = buildStatementNumber(
        input.year,
        input.month,
        tenantSlug,
      );

      const lineItems = docs.map((doc) => ({
        commissionEvent: doc.id,
        feeCents: Number(doc.feeCents ?? 0),
        paymentIntentId: String(doc.paymentIntentId ?? ""),
        collectedAt: doc.collectedAt ?? periodStartIso,
      }));

      const created = await ctx.db.create({
        collection: "commission_statements",
        data: {
          tenant: input.tenantId,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          currency,
          timezone: "Europe/Berlin",
          basis: "collectedAt",
          totalsNetCents,
          totalsVatCents,
          totalsGrossCents,
          lineItems,
          status: "issued",
          statementNumber,
        },
        overrideAccess: true,
      });

      return { statementId: (created as { id?: string })?.id, created: true };
    }),
});
