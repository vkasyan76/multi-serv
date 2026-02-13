import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Where } from "payload";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { resolvePayloadUserId } from "@/modules/orders/server/identity";
import { buildStatementNumber, getBerlinMonthRange } from "./statement-utils";
import { WALLET_CURRENCY, WALLET_PAGE_SIZE } from "@/constants";

type PayloadTenant = { id: string; slug?: string | null };
type CommissionEventDoc = {
  id: string;
  tenant?: string | { id?: string } | null;
  invoice?: string | { id?: string } | null;
  currency?: string | null;
  feeCents?: number | null;
  paymentIntentId?: string | null;
  collectedAt?: string | null;
};
type InvoiceDoc = {
  id: string;
  tenant?: string | { id?: string } | null;
  status?: string | null;
  currency?: string | null;
  paidAt?: string | null;
  amountTotalCents?: number | null;
  stripePaymentIntentId?: string | null;
  lineItems?: Array<{ start?: string | null; end?: string | null }> | null;
  issuedAt?: string | null;
  createdAt?: string | null;
};
type WalletTxType = "payment_received" | "platform_fee" | "payment_outstanding";
type WalletTx = {
  id: string;
  type: WalletTxType;
  occurredAt: string;
  description: string;
  amountCents: number;
  currency: "eur";
  invoiceId: string;
  paymentIntentId?: string;
  serviceStart?: string;
  serviceEnd?: string;
  invoiceDate?: string;
};
type UserTenantEntry = { tenant?: string | { id?: string } | null };

function relId(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") return input;
  if (typeof input === "object" && input && "id" in input) {
    const raw = (input as { id?: unknown }).id;
    return typeof raw === "string" ? raw : null;
  }
  return null;
}

function parseIso(value?: string): string | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid date." });
  }
  return new Date(ms).toISOString();
}

// Derive the service date range from invoice line items (for wallet display).
function getServiceRange(
  items?: Array<{ start?: string | null; end?: string | null }> | null,
) {
  const safeItems = items ?? [];
  const starts = safeItems
    .map((item) => (item?.start ? Date.parse(item.start) : NaN))
    .filter((ms) => Number.isFinite(ms));
  if (!starts.length) return {};

  const ends = safeItems
    .map((item) => (item?.end ? Date.parse(item.end) : NaN))
    .filter((ms) => Number.isFinite(ms));

  const minStart = new Date(Math.min(...starts)).toISOString();
  const maxEnd = ends.length
    ? new Date(Math.max(...ends)).toISOString()
    : minStart;

  return { serviceStart: minStart, serviceEnd: maxEnd };
}

async function resolveTenantForUserBySlug(
  ctx: TRPCContext,
  slug: string,
): Promise<{ tenantId: string; tenantSlug: string }> {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  const payloadUserId = await resolvePayloadUserId(ctx, ctx.userId);
  const user = await ctx.db.findByID({
    collection: "users",
    id: payloadUserId,
    depth: 0,
    overrideAccess: true,
  });

  // Resolve tenant by slug, then verify the user is a member.
  const tenantRes = await ctx.db.find({
    collection: "tenants",
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const tenant = tenantRes.docs?.[0] as PayloadTenant | undefined;
  if (!tenant?.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
  }

  const membership = (user as { tenants?: UserTenantEntry[] })?.tenants ?? [];
  const hasAccess = membership.some((t) => relId(t?.tenant) === tenant.id);
  if (!hasAccess) throw new TRPCError({ code: "FORBIDDEN" });

  return { tenantId: tenant.id, tenantSlug: tenant.slug ?? slug };
}

// Paginate to avoid silently undercounting once docs exceed a single page.
async function sumAllPages<T>(
  ctx: TRPCContext,
  args: {
    collection: "invoices" | "commission_events";
    where: Where;
    getValue: (doc: T) => number | null | undefined;
  },
) {
  let page = 1;
  let totalPages = 1;
  let sum = 0;

  do {
    const res = await ctx.db.find({
      collection: args.collection,
      where: args.where,
      limit: WALLET_PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
    });

    const docs = (res.docs ?? []) as T[];
    for (const doc of docs) {
      sum += Number(args.getValue(doc) ?? 0);
    }

    totalPages = res.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return sum;
}

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

  // Wallet summary derived from paid invoices (+) and commission events (-).
  walletSummary: baseProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await resolveTenantForUserBySlug(ctx, input.slug);

      // Wallet summary is derived from paid invoices and commission events.
      const grossReceivedCents = await sumAllPages<InvoiceDoc>(ctx, {
        collection: "invoices",
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { status: { equals: "paid" } },
            { currency: { equals: WALLET_CURRENCY } },
          ],
        },
        getValue: (doc) => doc.amountTotalCents,
      });

      const platformFeesCents = await sumAllPages<CommissionEventDoc>(ctx, {
        collection: "commission_events",
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { currency: { equals: WALLET_CURRENCY } },
          ],
        },
        getValue: (doc) => doc.feeCents,
      });

      const dueFromCustomersCents = await sumAllPages<InvoiceDoc>(ctx, {
        collection: "invoices",
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { status: { in: ["issued", "overdue"] } },
            { currency: { equals: WALLET_CURRENCY } },
          ],
        },
        getValue: (doc) => doc.amountTotalCents,
      });

      return {
        currency: WALLET_CURRENCY,
        grossReceivedCents,
        platformFeesCents,
        netCents: grossReceivedCents - platformFeesCents,
        dueFromCustomersCents,
      };
    }),

  // Wallet feed derived from invoices + commission events; end-exclusive filters.
  walletTransactions: baseProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        start: z.string().optional(),
        end: z.string().optional(),
        type: z
          .enum(["all", "payment_received", "platform_fee", "payment_outstanding"])
          .default("all"),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId } = await resolveTenantForUserBySlug(ctx, input.slug);
      const startIso = parseIso(input.start);
      const endIso = parseIso(input.end);
      if (startIso && endIso && startIso >= endIso) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid date range.",
        });
      }

      const paidInvoiceWhere: Where = {
        and: [
          { tenant: { equals: tenantId } },
          { status: { equals: "paid" } },
          { currency: { equals: WALLET_CURRENCY } },
        ],
      };
      if (startIso)
        (paidInvoiceWhere.and as Where[]).push({
          paidAt: { greater_than_equal: startIso },
        });
      if (endIso)
        (paidInvoiceWhere.and as Where[]).push({
          paidAt: { less_than: endIso },
        });

      const outstandingInvoiceWhere: Where = {
        and: [
          { tenant: { equals: tenantId } },
          { status: { in: ["issued", "overdue"] } },
          { currency: { equals: WALLET_CURRENCY } },
        ],
      };
      if (startIso)
        (outstandingInvoiceWhere.and as Where[]).push({
          issuedAt: { greater_than_equal: startIso },
        });
      if (endIso)
        (outstandingInvoiceWhere.and as Where[]).push({
          issuedAt: { less_than: endIso },
        });

      const feeWhere: Where = {
        and: [
          { tenant: { equals: tenantId } },
          { currency: { equals: WALLET_CURRENCY } },
        ],
      };
      if (startIso) (feeWhere.and as Where[]).push({ collectedAt: { greater_than_equal: startIso } });
      if (endIso) (feeWhere.and as Where[]).push({ collectedAt: { less_than: endIso } });

      const buffer = input.limit * 2;
      const paidInvoices =
        input.type === "platform_fee" || input.type === "payment_outstanding"
          ? []
          : (
              await ctx.db.find({
                collection: "invoices",
                where: paidInvoiceWhere,
                limit: buffer,
                depth: 0,
                overrideAccess: true,
                sort: "-paidAt",
              })
            ).docs ?? [];

      const outstandingInvoices =
        input.type === "platform_fee" || input.type === "payment_received"
          ? []
          : (
              await ctx.db.find({
                collection: "invoices",
                where: outstandingInvoiceWhere,
                limit: buffer,
                depth: 0,
                overrideAccess: true,
                sort: "-issuedAt",
              })
            ).docs ?? [];

      const feeDocs =
        input.type === "payment_received" || input.type === "payment_outstanding"
          ? []
          : (
              await ctx.db.find({
                collection: "commission_events",
                where: feeWhere,
                limit: buffer,
                depth: 0,
                overrideAccess: true,
                sort: "-collectedAt",
              })
            ).docs ?? [];

      const invoiceRanges = new Map<
        string,
        { serviceStart?: string; serviceEnd?: string; invoiceDate?: string }
      >();

      const payments = (paidInvoices as InvoiceDoc[])
        .map((inv) => {
          if (!inv.paidAt) return null;
          const range = getServiceRange(inv.lineItems);
          const invoiceDate = inv.issuedAt ?? inv.paidAt ?? inv.createdAt ?? undefined;
          invoiceRanges.set(inv.id, { ...range, invoiceDate });
          return {
            id: `inv_${inv.id}`,
            type: "payment_received",
            occurredAt: inv.paidAt,
            description: "Payment received",
            amountCents: Number(inv.amountTotalCents ?? 0),
            currency: WALLET_CURRENCY,
            invoiceId: inv.id,
            paymentIntentId: inv.stripePaymentIntentId ?? undefined,
            ...range,
            invoiceDate,
          } satisfies WalletTx;
        })
        .filter(Boolean) as WalletTx[];

      const outstanding = (outstandingInvoices as InvoiceDoc[])
        .map((inv) => {
          const issuedAt = inv.issuedAt ?? inv.createdAt;
          if (!issuedAt) return null;
          const range = getServiceRange(inv.lineItems);
          const invoiceDate = inv.issuedAt ?? inv.createdAt ?? undefined;
          invoiceRanges.set(inv.id, { ...range, invoiceDate });
          return {
            id: `inv_${inv.id}`,
            type: "payment_outstanding",
            occurredAt: issuedAt,
            description: "Payment outstanding",
            amountCents: Number(inv.amountTotalCents ?? 0),
            currency: WALLET_CURRENCY,
            invoiceId: inv.id,
            ...range,
            invoiceDate,
          } satisfies WalletTx;
        })
        .filter(Boolean) as WalletTx[];

      const fees = (feeDocs as CommissionEventDoc[])
        .map((ev) => {
          const invoiceId = relId(ev.invoice);
          if (!ev.collectedAt || !invoiceId) return null;
          const range = invoiceRanges.get(invoiceId);
          return {
            id: `fee_${ev.paymentIntentId ?? ev.id}`,
            type: "platform_fee",
            occurredAt: ev.collectedAt,
            description: "Platform fee",
            amountCents: -Number(ev.feeCents ?? 0),
            currency: WALLET_CURRENCY,
            invoiceId,
            paymentIntentId: ev.paymentIntentId ?? undefined,
            ...(range ?? {}),
            invoiceDate: range?.invoiceDate ?? ev.collectedAt,
          } satisfies WalletTx;
        })
        .filter(Boolean) as WalletTx[];

      return [...payments, ...outstanding, ...fees]
        .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
        .slice(0, input.limit);
    }),

  // Related rows for a given invoice (payment + fee), tenant-scoped by slug.
  walletRelated: baseProcedure
    .input(z.object({ slug: z.string().min(1), invoiceId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await resolveTenantForUserBySlug(ctx, input.slug);

      const invoice = (await ctx.db.findByID({
        collection: "invoices",
        id: input.invoiceId,
        depth: 0,
        overrideAccess: true,
      })) as InvoiceDoc | null;

      if (!invoice || relId(invoice.tenant) !== tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const feesRes = await ctx.db.find({
        collection: "commission_events",
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { invoice: { equals: input.invoiceId } },
          ],
        },
        limit: 10,
        depth: 0,
        overrideAccess: true,
        sort: "-collectedAt",
      });

      const invoiceDate = invoice.issuedAt ?? invoice.paidAt ?? invoice.createdAt ?? undefined;
      const paymentRow: WalletTx | null = invoice.paidAt
        ? {
            id: `inv_${invoice.id}`,
            type: "payment_received",
            occurredAt: invoice.paidAt,
            description: "Payment received",
            amountCents: Number(invoice.amountTotalCents ?? 0),
            currency: WALLET_CURRENCY,
            invoiceId: invoice.id,
            paymentIntentId: invoice.stripePaymentIntentId ?? undefined,
            ...getServiceRange(invoice.lineItems),
            invoiceDate,
          }
        : invoice.status === "issued" || invoice.status === "overdue"
          ? {
              id: `inv_${invoice.id}`,
              type: "payment_outstanding",
              occurredAt: invoice.issuedAt ?? invoice.createdAt ?? new Date().toISOString(),
              description: "Payment outstanding",
              amountCents: Number(invoice.amountTotalCents ?? 0),
              currency: WALLET_CURRENCY,
              invoiceId: invoice.id,
              ...getServiceRange(invoice.lineItems),
              invoiceDate,
            }
          : null;

      const feeRows = (feesRes.docs ?? [])
        .map((ev) => {
          const invoiceId = relId((ev as CommissionEventDoc).invoice);
          const collectedAt = (ev as CommissionEventDoc).collectedAt ?? null;
          if (!invoiceId || !collectedAt) return null;
          return {
            id: `fee_${(ev as CommissionEventDoc).paymentIntentId ?? (ev as CommissionEventDoc).id}`,
            type: "platform_fee",
            occurredAt: collectedAt,
            description: "Platform fee",
            amountCents: -Number((ev as CommissionEventDoc).feeCents ?? 0),
            currency: WALLET_CURRENCY,
            invoiceId,
            paymentIntentId: (ev as CommissionEventDoc).paymentIntentId ?? undefined,
            ...(paymentRow?.invoiceId === invoiceId
              ? {
                  serviceStart: paymentRow.serviceStart,
                  serviceEnd: paymentRow.serviceEnd,
                  invoiceDate: paymentRow.invoiceDate,
                }
              : {}),
          } satisfies WalletTx;
        })
        .filter(Boolean) as WalletTx[];

      return [paymentRow, ...feeRows].filter(Boolean) as WalletTx[];
    }),
});
