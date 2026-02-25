import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Where } from "payload";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import type { TRPCContext } from "@/trpc/init";
import { resolvePayloadUserId } from "@/modules/orders/server/identity";
import { buildStatementNumber, getBerlinMonthRange } from "./statement-utils";
import {
  WALLET_CURRENCY,
  WALLET_PAGE_SIZE,
  WALLET_TRANSACTIONS_LIMIT_DEFAULT,
  WALLET_TRANSACTIONS_LIMIT_MAX,
} from "@/constants";

type PayloadTenant = { id: string; slug?: string | null; name?: string | null };
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
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
};
type UserTenantEntry = { tenant?: string | { id?: string } | null };
type WalletStatus = "all" | "paid" | "payment_due" | "platform_fee";

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

function validateWalletRange(startIso?: string, endIso?: string) {
  if (startIso && endIso && startIso >= endIso) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid date range.",
    });
  }
}

function withTenantScope(whereAnd: Where[], tenantId?: string) {
  if (!tenantId) return;
  whereAnd.push({ tenant: { equals: tenantId } });
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

async function findAllPages<T>(
  ctx: TRPCContext,
  args: {
    collection: "invoices" | "commission_events";
    where: Where;
    sort?: string;
  },
) {
  let page = 1;
  let totalPages = 1;
  const docs: T[] = [];

  do {
    const res = await ctx.db.find({
      collection: args.collection,
      where: args.where,
      limit: WALLET_PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
      ...(args.sort ? { sort: args.sort } : {}),
    });

    docs.push(...((res.docs ?? []) as T[]));
    totalPages = res.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return docs;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function findInvoiceIdsByIssuedAtRange(
  ctx: TRPCContext,
  tenantId?: string,
  startIso?: string,
  endIso?: string,
) {
  const whereAnd: Where[] = [
    { status: { equals: "paid" } },
    { currency: { equals: WALLET_CURRENCY } },
  ];
  withTenantScope(whereAnd, tenantId);
  const where: Where = { and: whereAnd };
  if (startIso)
    (where.and as Where[]).push({ issuedAt: { greater_than_equal: startIso } });
  if (endIso)
    (where.and as Where[]).push({ issuedAt: { less_than: endIso } });

  const ids: string[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await ctx.db.find({
      collection: "invoices",
      where,
      limit: WALLET_PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
    });
    const docs = (res.docs ?? []) as InvoiceDoc[];
    for (const doc of docs) {
      if (doc.id) ids.push(doc.id);
    }
    totalPages = res.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return ids;
}

async function sumFeesByInvoiceIds(
  ctx: TRPCContext,
  tenantId: string | undefined,
  invoiceIds: string[],
) {
  if (!invoiceIds.length) return 0;
  let sum = 0;

  for (const chunk of chunkArray(invoiceIds, 200)) {
    sum += await sumAllPages<CommissionEventDoc>(ctx, {
      collection: "commission_events",
      where: {
        and: [
          { currency: { equals: WALLET_CURRENCY } },
          { invoice: { in: chunk } },
          ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
        ],
      },
      getValue: (doc) => doc.feeCents,
    });
  }

  return sum;
}

async function findFeeDocsByInvoiceIds(
  ctx: TRPCContext,
  tenantId: string | undefined,
  invoiceIds: string[],
) {
  const docs: CommissionEventDoc[] = [];
  if (!invoiceIds.length) return docs;

  for (const chunk of chunkArray(invoiceIds, 200)) {
    let page = 1;
    let totalPages = 1;

    do {
      const res = await ctx.db.find({
        collection: "commission_events",
        where: {
          and: [
            { currency: { equals: WALLET_CURRENCY } },
            { invoice: { in: chunk } },
            ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
          ],
        },
        limit: WALLET_PAGE_SIZE,
        page,
        depth: 0,
        overrideAccess: true,
        sort: "-collectedAt",
      });

      docs.push(...((res.docs ?? []) as CommissionEventDoc[]));
      totalPages = res.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
  }

  return docs;
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

async function ensureTenantExists(ctx: TRPCContext, tenantId: string) {
  const tenant = (await ctx.db.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as PayloadTenant | null;
  if (!tenant?.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
  }
  return tenant;
}

async function getTenantMetaMap(ctx: TRPCContext, tenantIds: string[]) {
  const map = new Map<string, { name: string; slug: string }>();
  if (!tenantIds.length) return map;

  for (const chunk of chunkArray(Array.from(new Set(tenantIds)), 200)) {
    const tenantsRes = await ctx.db.find({
      collection: "tenants",
      where: { id: { in: chunk } },
      limit: chunk.length,
      depth: 0,
      overrideAccess: true,
    });
    const docs = (tenantsRes.docs ?? []) as PayloadTenant[];
    for (const tenant of docs) {
      if (!tenant.id) continue;
      const fallback = tenant.id.slice(-6);
      map.set(tenant.id, {
        name: (tenant.name ?? "").trim() || (tenant.slug ?? fallback),
        slug: (tenant.slug ?? "").trim() || fallback,
      });
    }
  }

  return map;
}

// Shared summary builder for tenant + admin endpoints to keep wallet semantics aligned.
async function buildWalletSummary(
  ctx: TRPCContext,
  args: {
    tenantId?: string;
    startIso?: string;
    endIso?: string;
    status: WalletStatus;
  },
) {
  validateWalletRange(args.startIso, args.endIso);

  const includePaid = args.status === "all" || args.status === "paid";
  const includeDue = args.status === "all" || args.status === "payment_due";
  const includeFees =
    args.status === "all" || args.status === "platform_fee";
  const hasDateFilter = Boolean(args.startIso || args.endIso);

  const grossWhereAnd: Where[] = [
    { status: { equals: "paid" } },
    { currency: { equals: WALLET_CURRENCY } },
  ];
  const dueWhereAnd: Where[] = [
    { status: { in: ["issued", "overdue"] } },
    { currency: { equals: WALLET_CURRENCY } },
  ];
  const feeWhereAnd: Where[] = [{ currency: { equals: WALLET_CURRENCY } }];
  withTenantScope(grossWhereAnd, args.tenantId);
  withTenantScope(dueWhereAnd, args.tenantId);
  withTenantScope(feeWhereAnd, args.tenantId);
  if (args.startIso) {
    grossWhereAnd.push({ issuedAt: { greater_than_equal: args.startIso } });
    dueWhereAnd.push({ issuedAt: { greater_than_equal: args.startIso } });
  }
  if (args.endIso) {
    grossWhereAnd.push({ issuedAt: { less_than: args.endIso } });
    dueWhereAnd.push({ issuedAt: { less_than: args.endIso } });
  }

  const grossReceivedCents = includePaid
    ? await sumAllPages<InvoiceDoc>(ctx, {
        collection: "invoices",
        where: { and: grossWhereAnd },
        getValue: (doc) => doc.amountTotalCents,
      })
    : 0;

  const platformFeesCents = includeFees
    ? hasDateFilter
      ? await sumFeesByInvoiceIds(
          ctx,
          args.tenantId,
          await findInvoiceIdsByIssuedAtRange(
            ctx,
            args.tenantId,
            args.startIso,
            args.endIso,
          ),
        )
      : await sumAllPages<CommissionEventDoc>(ctx, {
          collection: "commission_events",
          where: { and: feeWhereAnd },
          getValue: (doc) => doc.feeCents,
        })
    : 0;

  const dueFromCustomersCents = includeDue
    ? await sumAllPages<InvoiceDoc>(ctx, {
        collection: "invoices",
        where: { and: dueWhereAnd },
        getValue: (doc) => doc.amountTotalCents,
      })
    : 0;

  return {
    currency: WALLET_CURRENCY,
    grossReceivedCents,
    platformFeesCents,
    netCents: grossReceivedCents - platformFeesCents,
    dueFromCustomersCents,
  };
}

// Shared transactions builder for tenant + admin endpoints (same invoice/fee derivation rules).
async function buildWalletTransactions(
  ctx: TRPCContext,
  args: {
    tenantId?: string;
    startIso?: string;
    endIso?: string;
    status: WalletStatus;
    limit: number;
  },
) {
  validateWalletRange(args.startIso, args.endIso);

  const includePaid = args.status === "all" || args.status === "paid";
  const includeDue = args.status === "all" || args.status === "payment_due";
  const includeFees = args.status === "all" || args.status === "platform_fee";
  const hasDateFilter = Boolean(args.startIso || args.endIso);

  const paidInvoiceAnd: Where[] = [
    { status: { equals: "paid" } },
    { currency: { equals: WALLET_CURRENCY } },
  ];
  const outstandingAnd: Where[] = [
    { status: { in: ["issued", "overdue"] } },
    { currency: { equals: WALLET_CURRENCY } },
  ];
  const feeAnd: Where[] = [{ currency: { equals: WALLET_CURRENCY } }];
  withTenantScope(paidInvoiceAnd, args.tenantId);
  withTenantScope(outstandingAnd, args.tenantId);
  withTenantScope(feeAnd, args.tenantId);
  if (args.startIso) {
    paidInvoiceAnd.push({ issuedAt: { greater_than_equal: args.startIso } });
    outstandingAnd.push({ issuedAt: { greater_than_equal: args.startIso } });
  }
  if (args.endIso) {
    paidInvoiceAnd.push({ issuedAt: { less_than: args.endIso } });
    outstandingAnd.push({ issuedAt: { less_than: args.endIso } });
  }

  const buffer = args.limit * 2;
  const paidInvoices =
    !includePaid
      ? []
      : (
          await ctx.db.find({
            collection: "invoices",
            where: { and: paidInvoiceAnd },
            limit: buffer,
            depth: 0,
            overrideAccess: true,
            sort: "-issuedAt",
          })
        ).docs ?? [];

  const outstandingInvoices =
    !includeDue
      ? []
      : (
          await ctx.db.find({
            collection: "invoices",
            where: { and: outstandingAnd },
            limit: buffer,
            depth: 0,
            overrideAccess: true,
            sort: "-issuedAt",
          })
        ).docs ?? [];

  const invoiceCandidates: InvoiceDoc[] =
    includePaid || includeDue
      ? [...(paidInvoices as InvoiceDoc[]), ...(outstandingInvoices as InvoiceDoc[])]
      : [];

  if (includeFees && hasDateFilter && invoiceCandidates.length === 0) {
    const dateRangeAnd: Where[] = [{ currency: { equals: WALLET_CURRENCY } }];
    withTenantScope(dateRangeAnd, args.tenantId);
    if (args.startIso) {
      dateRangeAnd.push({ issuedAt: { greater_than_equal: args.startIso } });
    }
    if (args.endIso) {
      dateRangeAnd.push({ issuedAt: { less_than: args.endIso } });
    }

    const invoiceRangeRes = await ctx.db.find({
      collection: "invoices",
      where: { and: dateRangeAnd },
      limit: buffer,
      depth: 0,
      overrideAccess: true,
      sort: "-issuedAt",
    });
    invoiceCandidates.push(...((invoiceRangeRes.docs ?? []) as InvoiceDoc[]));
  }

  const invoiceRanges = new Map<
    string,
    {
      serviceStart?: string;
      serviceEnd?: string;
      invoiceDate?: string;
      tenantId?: string;
    }
  >();

  const payments = (paidInvoices as InvoiceDoc[])
    .map((inv) => {
      if (!inv.paidAt) return null;
      const range = getServiceRange(inv.lineItems);
      const invoiceDate = inv.issuedAt ?? inv.createdAt ?? undefined;
      const tenantId = relId(inv.tenant) ?? args.tenantId;
      invoiceRanges.set(inv.id, { ...range, invoiceDate, tenantId: tenantId ?? undefined });
      return {
        id: `inv_${inv.id}`,
        type: "payment_received",
        occurredAt: inv.paidAt,
        description: "Paid",
        amountCents: Number(inv.amountTotalCents ?? 0),
        currency: WALLET_CURRENCY,
        invoiceId: inv.id,
        paymentIntentId: inv.stripePaymentIntentId ?? undefined,
        ...range,
        invoiceDate,
        tenantId: tenantId ?? undefined,
      } satisfies WalletTx;
    })
    .filter(Boolean) as WalletTx[];

  const outstanding = (outstandingInvoices as InvoiceDoc[])
    .map((inv) => {
      const issuedAt = inv.issuedAt ?? inv.createdAt;
      if (!issuedAt) return null;
      const range = getServiceRange(inv.lineItems);
      const invoiceDate = inv.issuedAt ?? inv.createdAt ?? undefined;
      const tenantId = relId(inv.tenant) ?? args.tenantId;
      invoiceRanges.set(inv.id, { ...range, invoiceDate, tenantId: tenantId ?? undefined });
      return {
        id: `inv_${inv.id}`,
        type: "payment_outstanding",
        occurredAt: issuedAt,
        description: "Payment due",
        amountCents: Number(inv.amountTotalCents ?? 0),
        currency: WALLET_CURRENCY,
        invoiceId: inv.id,
        ...range,
        invoiceDate,
        tenantId: tenantId ?? undefined,
      } satisfies WalletTx;
    })
    .filter(Boolean) as WalletTx[];

  for (const inv of invoiceCandidates) {
    if (invoiceRanges.has(inv.id)) continue;
    const range = getServiceRange(inv.lineItems);
    const invoiceDate = inv.issuedAt ?? inv.createdAt ?? undefined;
    const tenantId = relId(inv.tenant) ?? args.tenantId;
    invoiceRanges.set(inv.id, { ...range, invoiceDate, tenantId: tenantId ?? undefined });
  }

  let feeDocs: CommissionEventDoc[] = [];
  if (includeFees) {
    if (hasDateFilter) {
      const invoiceIds = Array.from(new Set(invoiceCandidates.map((inv) => inv.id)));
      if (invoiceIds.length) {
        feeDocs =
          ((await ctx.db.find({
            collection: "commission_events",
            where: {
              and: [
                { currency: { equals: WALLET_CURRENCY } },
                { invoice: { in: invoiceIds } },
                ...(args.tenantId ? [{ tenant: { equals: args.tenantId } }] : []),
              ],
            },
            limit: buffer,
            depth: 0,
            overrideAccess: true,
            sort: "-collectedAt",
          })).docs as CommissionEventDoc[]) ?? [];
      }
    } else {
      feeDocs =
        ((await ctx.db.find({
          collection: "commission_events",
          where: { and: feeAnd },
          limit: buffer,
          depth: 0,
          overrideAccess: true,
          sort: "-collectedAt",
        })).docs as CommissionEventDoc[]) ?? [];
    }
  }

  const missingInvoiceIds = Array.from(
    new Set(
      feeDocs
        .map((ev) => relId(ev.invoice))
        .filter((id): id is string => Boolean(id && !invoiceRanges.has(id))),
    ),
  );

  if (missingInvoiceIds.length) {
    for (const chunk of chunkArray(missingInvoiceIds, 200)) {
      const missingAnd: Where[] = [{ id: { in: chunk } }];
      withTenantScope(missingAnd, args.tenantId);

      const invoiceRes = await ctx.db.find({
        collection: "invoices",
        where: { and: missingAnd },
        limit: chunk.length,
        depth: 0,
        overrideAccess: true,
      });
      const docs = (invoiceRes.docs ?? []) as InvoiceDoc[];
      for (const inv of docs) {
        if (invoiceRanges.has(inv.id)) continue;
        const range = getServiceRange(inv.lineItems);
        const invoiceDate = inv.issuedAt ?? inv.createdAt ?? undefined;
        const tenantId = relId(inv.tenant) ?? args.tenantId;
        invoiceRanges.set(inv.id, {
          ...range,
          invoiceDate,
          tenantId: tenantId ?? undefined,
        });
      }
    }
  }

  const fees = (feeDocs as CommissionEventDoc[])
    .map((ev) => {
      const invoiceId = relId(ev.invoice);
      if (!ev.collectedAt || !invoiceId) return null;
      const range = invoiceRanges.get(invoiceId);
      return {
        id: `fee_${ev.paymentIntentId ?? ev.id}`,
        type: "platform_fee",
        occurredAt: ev.collectedAt,
        description: "Fee",
        amountCents: -Number(ev.feeCents ?? 0),
        currency: WALLET_CURRENCY,
        invoiceId,
        paymentIntentId: ev.paymentIntentId ?? undefined,
        ...(range ?? {}),
        invoiceDate: range?.invoiceDate,
        tenantId: relId(ev.tenant) ?? range?.tenantId ?? args.tenantId,
      } satisfies WalletTx;
    })
    .filter(Boolean) as WalletTx[];

  return [...payments, ...outstanding, ...fees]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .slice(0, args.limit);
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

      // Read all matching events page-by-page so statements are not truncated.
      const docs = await findAllPages<CommissionEventDoc>(ctx, {
        collection: "commission_events",
        where: {
          and: [
            { tenant: { equals: input.tenantId } },
            { currency: { equals: currency } },
            { collectedAt: { greater_than_equal: periodStartIso } },
            { collectedAt: { less_than: periodEndIso } },
          ],
        },
        sort: "collectedAt",
      });
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
    .input(
      z.object({
        slug: z.string().min(1),
        start: z.string().optional(),
        end: z.string().optional(),
        status: z
          .enum(["all", "paid", "payment_due", "platform_fee"])
          .default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId } = await resolveTenantForUserBySlug(ctx, input.slug);
      return buildWalletSummary(ctx, {
        tenantId,
        startIso: parseIso(input.start),
        endIso: parseIso(input.end),
        status: input.status,
      });
    }),

  // Wallet feed derived from invoices + commission events; end-exclusive filters.
  walletTransactions: baseProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        start: z.string().optional(),
        end: z.string().optional(),
        status: z
          .enum(["all", "paid", "payment_due", "platform_fee"])
          .default("all"),
        limit: z
          .number()
          .min(1)
          .max(WALLET_TRANSACTIONS_LIMIT_MAX)
          .default(WALLET_TRANSACTIONS_LIMIT_DEFAULT),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId } = await resolveTenantForUserBySlug(ctx, input.slug);
      return buildWalletTransactions(ctx, {
        tenantId,
        startIso: parseIso(input.start),
        endIso: parseIso(input.end),
        status: input.status,
        limit: input.limit,
      });
    }),

  adminTenantOptions: baseProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      await requireSuperAdmin(ctx);
      // Return the full tenant list for selector UX; fetching is paged internally.
      const options: Array<{ id: string; name: string; slug: string }> = [];
      let page = 1;
      let totalPages = 1;

      do {
        const res = await ctx.db.find({
          collection: "tenants",
          where: {},
          limit: WALLET_PAGE_SIZE,
          page,
          depth: 0,
          overrideAccess: true,
          sort: "name",
        });
        const docs = (res.docs ?? []) as PayloadTenant[];
        for (const tenant of docs) {
          if (!tenant.id) continue;
          const fallback = tenant.id.slice(-6);
          options.push({
            id: tenant.id,
            name: (tenant.name ?? "").trim() || (tenant.slug ?? fallback),
            slug: (tenant.slug ?? "").trim() || fallback,
          });
        }

        totalPages = res.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);

      return options;
    }),

  adminWalletSummary: baseProcedure
    .input(
      z.object({
        tenantId: z.string().min(1).optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        status: z
          .enum(["all", "paid", "payment_due", "platform_fee"])
          .default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      if (input.tenantId) {
        await ensureTenantExists(ctx, input.tenantId);
      }

      return buildWalletSummary(ctx, {
        tenantId: input.tenantId,
        startIso: parseIso(input.start),
        endIso: parseIso(input.end),
        status: input.status,
      });
    }),

  adminWalletTransactions: baseProcedure
    .input(
      z.object({
        tenantId: z.string().min(1).optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        status: z
          .enum(["all", "paid", "payment_due", "platform_fee"])
          .default("all"),
        limit: z
          .number()
          .min(1)
          .max(WALLET_TRANSACTIONS_LIMIT_MAX)
          .default(WALLET_TRANSACTIONS_LIMIT_DEFAULT),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireSuperAdmin(ctx);
      if (input.tenantId) {
        await ensureTenantExists(ctx, input.tenantId);
      }

      const rows = await buildWalletTransactions(ctx, {
        tenantId: input.tenantId,
        startIso: parseIso(input.start),
        endIso: parseIso(input.end),
        status: input.status,
        limit: input.limit,
      });

      // Admin table requires tenant attribution on every row.
      const missingTenantRow = rows.find((row) => !row.tenantId);
      if (missingTenantRow) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Wallet transaction row missing tenantId.",
        });
      }

      const tenantIds = Array.from(
        new Set(
          rows
            .map((row) => row.tenantId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const metaMap = await getTenantMetaMap(ctx, tenantIds);

      return {
        rows: rows.map((row) => {
          const meta = row.tenantId ? metaMap.get(row.tenantId) : undefined;
          return {
            ...row,
            tenantName: row.tenantName ?? meta?.name,
            tenantSlug: row.tenantSlug ?? meta?.slug,
          };
        }),
        // Cursor shape is reserved for Phase 5 pagination without API redesign.
        nextCursor: null as string | null,
      };
    }),

  // Full wallet export derived from invoices + commission events.
  walletTransactionsExport: baseProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        start: z.string().optional(),
        end: z.string().optional(),
        status: z
          .enum(["all", "paid", "payment_due", "platform_fee"])
          .default("all"),
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

      const includePaid = input.status === "all" || input.status === "paid";
      const includeDue =
        input.status === "all" || input.status === "payment_due";
      const includeFees =
        input.status === "all" || input.status === "platform_fee";
      const hasDateFilter = Boolean(startIso || endIso);

      const paidInvoiceWhere: Where = {
        and: [
          { tenant: { equals: tenantId } },
          { status: { equals: "paid" } },
          { currency: { equals: WALLET_CURRENCY } },
        ],
      };
      if (startIso)
        (paidInvoiceWhere.and as Where[]).push({
          issuedAt: { greater_than_equal: startIso },
        });
      if (endIso)
        (paidInvoiceWhere.and as Where[]).push({
          issuedAt: { less_than: endIso },
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

      const paidInvoices = includePaid
        ? await findAllPages<InvoiceDoc>(ctx, {
            collection: "invoices",
            where: paidInvoiceWhere,
            sort: "-issuedAt",
          })
        : [];

      const outstandingInvoices = includeDue
        ? await findAllPages<InvoiceDoc>(ctx, {
            collection: "invoices",
            where: outstandingInvoiceWhere,
            sort: "-issuedAt",
          })
        : [];

      const invoiceCandidates: InvoiceDoc[] = includePaid || includeDue
        ? [...paidInvoices, ...outstandingInvoices]
        : [];

      if (includeFees && hasDateFilter && invoiceCandidates.length === 0) {
        const invoiceRangeRes = await findAllPages<InvoiceDoc>(ctx, {
          collection: "invoices",
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { currency: { equals: WALLET_CURRENCY } },
              ...(startIso
                ? [{ issuedAt: { greater_than_equal: startIso } }]
                : []),
              ...(endIso ? [{ issuedAt: { less_than: endIso } }] : []),
            ],
          },
          sort: "-issuedAt",
        });
        invoiceCandidates.push(...invoiceRangeRes);
      }

      const invoiceRanges = new Map<
        string,
        { serviceStart?: string; serviceEnd?: string; invoiceDate?: string }
      >();

      const payments = (paidInvoices as InvoiceDoc[])
        .map((inv) => {
          if (!inv.paidAt) return null;
          const range = getServiceRange(inv.lineItems);
          const invoiceDate = inv.issuedAt ?? inv.createdAt ?? undefined;
          invoiceRanges.set(inv.id, { ...range, invoiceDate });
          return {
            id: `inv_${inv.id}`,
            type: "payment_received",
            occurredAt: inv.paidAt,
            description: "Paid",
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
            description: "Payment due",
            amountCents: Number(inv.amountTotalCents ?? 0),
            currency: WALLET_CURRENCY,
            invoiceId: inv.id,
            ...range,
            invoiceDate,
          } satisfies WalletTx;
        })
        .filter(Boolean) as WalletTx[];

      for (const inv of invoiceCandidates) {
        if (invoiceRanges.has(inv.id)) continue;
        const range = getServiceRange(inv.lineItems);
        const invoiceDate = inv.issuedAt ?? inv.createdAt ?? undefined;
        invoiceRanges.set(inv.id, { ...range, invoiceDate });
      }

      let feeDocs: CommissionEventDoc[] = [];
      if (includeFees) {
        if (hasDateFilter) {
          const invoiceIds = Array.from(
            new Set(invoiceCandidates.map((inv) => inv.id)),
          );
          feeDocs = await findFeeDocsByInvoiceIds(ctx, tenantId, invoiceIds);
        } else {
          feeDocs = await findAllPages<CommissionEventDoc>(ctx, {
            collection: "commission_events",
            where: feeWhere,
            sort: "-collectedAt",
          });
        }
      }

      const missingInvoiceIds = Array.from(
        new Set(
          feeDocs
            .map((ev) => relId(ev.invoice))
            .filter((id): id is string => Boolean(id && !invoiceRanges.has(id))),
        ),
      );

      if (missingInvoiceIds.length) {
        for (const chunk of chunkArray(missingInvoiceIds, 200)) {
          const invoiceRes = await ctx.db.find({
            collection: "invoices",
            where: {
              and: [
                { tenant: { equals: tenantId } },
                { id: { in: chunk } },
              ],
            },
            limit: chunk.length,
            depth: 0,
            overrideAccess: true,
          });
          const docs = (invoiceRes.docs ?? []) as InvoiceDoc[];
          for (const inv of docs) {
            if (invoiceRanges.has(inv.id)) continue;
            const range = getServiceRange(inv.lineItems);
            const invoiceDate = inv.issuedAt ?? inv.createdAt ?? undefined;
            invoiceRanges.set(inv.id, { ...range, invoiceDate });
          }
        }
      }

      const fees = (feeDocs as CommissionEventDoc[])
        .map((ev) => {
          const invoiceId = relId(ev.invoice);
          if (!ev.collectedAt || !invoiceId) return null;
          const range = invoiceRanges.get(invoiceId);
          return {
            id: `fee_${ev.paymentIntentId ?? ev.id}`,
            type: "platform_fee",
            occurredAt: ev.collectedAt,
            description: "Fee",
            amountCents: -Number(ev.feeCents ?? 0),
            currency: WALLET_CURRENCY,
            invoiceId,
            paymentIntentId: ev.paymentIntentId ?? undefined,
            ...(range ?? {}),
            invoiceDate: range?.invoiceDate,
          } satisfies WalletTx;
        })
        .filter(Boolean) as WalletTx[];

      return [...payments, ...outstanding, ...fees].sort((a, b) =>
        a.occurredAt < b.occurredAt ? 1 : -1,
      );
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

      const invoiceDate = invoice.issuedAt ?? invoice.createdAt ?? undefined;
      const paymentRow: WalletTx | null = invoice.paidAt
        ? {
            id: `inv_${invoice.id}`,
            type: "payment_received",
            occurredAt: invoice.paidAt,
            description: "Paid",
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
              description: "Payment due",
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
            description: "Fee",
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
