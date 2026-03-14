import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { auth } from "@clerk/nextjs/server";
import type { Invoice, Tenant } from "@/payload-types";
import {
  DEFAULT_APP_LANG,
  SUPPORTED_APP_LANGS,
  type AppLang,
} from "@/lib/i18n/app-lang";
import {
  countryNameFromCode,
  formatDateForLocale,
  formatNumberForLocale,
  getLocaleAndCurrency,
} from "@/lib/i18n/locale";
import { getAppLangFromHeaders } from "@/modules/profile/location-utils";

export const runtime = "nodejs";

type InvoiceDoc = Invoice & {
  id: string;
  tenant?: string | { id: string } | null;
  customer?: string | { id: string } | null;
};

function relId(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") return input;
  if (typeof input === "object" && input && "id" in input) {
    const raw = (input as { id?: unknown }).id;
    return typeof raw === "string" ? raw : null;
  }
  return null;
}

function formatAmount(amountCents: number, currency: string, appLang: AppLang) {
  const major = amountCents / 100;
  return `${formatNumberForLocale(
    major,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    appLang,
  )} ${currency}`;
}

function readExplicitAppLang(input: string | null): AppLang | null {
  if (!input) return null;
  const short = (input.split(",")[0]?.split(/[-_]/)[0] ?? input)
    .trim()
    .toLowerCase();
  return (SUPPORTED_APP_LANGS as readonly string[]).includes(short)
    ? (short as AppLang)
    : null;
}

async function buildPdf(params: {
  invoice: InvoiceDoc;
  appLang: AppLang;
  tenantName?: string | null;
  providerName?: string | null;
  avatarBuffer?: Buffer | null;
}): Promise<Buffer> {
  const { invoice, appLang, tenantName, providerName, avatarBuffer } = params;
  type PDFDocumentCtor = PDFKit.PDFDocument;
  const mod = await import("pdfkit");
  const tFinance = await getTranslations({
    locale: appLang,
    namespace: "finance",
  });
  const PDFDocument =
    (mod as { default?: PDFDocumentCtor }).default ??
    (mod as unknown as PDFDocumentCtor);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];
      const { locale } = getLocaleAndCurrency(appLang);

      doc.on("data", (c: unknown) => {
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as Uint8Array));
      });
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const currency = (invoice.currency ?? "eur").toUpperCase();
      const vatRate = Number(invoice.vatRateBps ?? 0) / 100;
      const pageWidth = doc.page.width;
      const margin = 48;
      const contentWidth = pageWidth - margin * 2;
      const emptyValue = tFinance("invoice.fallbacks.empty_value");

      const leftColWidth = Math.floor(contentWidth * 0.34);
      const midColWidth = Math.floor(contentWidth * 0.34);
      const rightColWidth = contentWidth - leftColWidth - midColWidth;

      const leftX = margin;
      const midX = margin + leftColWidth;
      const rightX = margin + leftColWidth + midColWidth;

      const headerY = margin;
      let nameX = margin;
      if (avatarBuffer) {
        doc.image(avatarBuffer, margin, headerY, { width: 32, height: 32 });
        nameX = margin + 42;
      }
      if (tenantName) {
        doc.fontSize(14).text(tenantName, nameX, headerY + 6);
      }
      doc.fontSize(22).text(tFinance("invoice.title"), margin, headerY + 42);
      doc
        .fontSize(10)
        .fillColor("#666666")
        .text(invoice.id ?? "", margin, headerY + 70);
      doc.fillColor("#000000");

      const topY = headerY + 96;
      const lineGap = 14;
      const timeFmt = new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      });
      const formatSlotDateTime = (start?: string | null, end?: string | null) => {
        if (!start) return "";
        const startDate = new Date(start);
        const startLabel = formatDateForLocale(
          startDate,
          { year: "numeric", month: "short", day: "numeric" },
          appLang,
        );
        const startTime = timeFmt.format(startDate);
        if (!end) return `${startLabel}, ${startTime}`;
        const endDate = new Date(end);
        const endTime = timeFmt.format(endDate);
        const sameDay =
          startDate.getFullYear() === endDate.getFullYear() &&
          startDate.getMonth() === endDate.getMonth() &&
          startDate.getDate() === endDate.getDate();
        if (sameDay) return `${startLabel}, ${startTime} \u2013 ${endTime}`;
        const endLabel = formatDateForLocale(
          endDate,
          { year: "numeric", month: "short", day: "numeric" },
          appLang,
        );
        return `${startLabel}, ${startTime} \u2013 ${endLabel}, ${endTime}`;
      };

      doc
        .fontSize(11)
        .fillColor("#666666")
        .text(
          tFinance("invoice.sections.service_provider").toLocaleUpperCase(
            locale,
          ),
          leftX,
          topY,
        );
      doc.fillColor("#000000");
      doc.fontSize(10).text(
        providerName ??
          invoice.sellerLegalName ??
          tFinance("invoice.sections.service_provider"),
        leftX,
        topY + 16,
        {
          width: leftColWidth - 8,
        },
      );
      doc.text(invoice.sellerAddressLine1 ?? "", leftX, topY + 16 + lineGap, {
        width: leftColWidth - 8,
      });
      doc.text(
        `${invoice.sellerPostal ?? ""} ${invoice.sellerCity ?? ""}`,
        leftX,
        topY + 16 + lineGap * 2,
        { width: leftColWidth - 8 },
      );
      const sellerCountry =
        countryNameFromCode(invoice.sellerCountryISO, locale) ??
        invoice.sellerCountryISO ??
        "";
      doc.text(sellerCountry, leftX, topY + 16 + lineGap * 3, {
        width: leftColWidth - 8,
      });
      if (invoice.sellerEmail) {
        doc.text(invoice.sellerEmail, leftX, topY + 16 + lineGap * 4, {
          width: leftColWidth - 8,
        });
      }
      if (invoice.sellerVatId) {
        doc.text(
          `${tFinance("invoice.fields.vat_id")}: ${invoice.sellerVatId}`,
          leftX,
          topY + 16 + lineGap * 5,
          { width: leftColWidth - 8 },
        );
      }

      doc
        .fontSize(11)
        .fillColor("#666666")
        .text(
          tFinance("invoice.sections.client").toLocaleUpperCase(locale),
          midX,
          topY,
        );
      doc.fillColor("#000000");
      doc.fontSize(10).text(invoice.buyerName ?? "", midX, topY + 16, {
        width: midColWidth - 8,
      });
      doc.text(invoice.buyerAddressLine1 ?? "", midX, topY + 16 + lineGap, {
        width: midColWidth - 8,
      });
      doc.text(
        `${invoice.buyerPostal ?? ""} ${invoice.buyerCity ?? ""}`,
        midX,
        topY + 16 + lineGap * 2,
        { width: midColWidth - 8 },
      );
      const buyerCountry =
        countryNameFromCode(invoice.buyerCountryISO, locale) ??
        invoice.buyerCountryISO ??
        "";
      doc.text(buyerCountry, midX, topY + 16 + lineGap * 3, {
        width: midColWidth - 8,
      });
      if (invoice.buyerEmail) {
        doc.text(invoice.buyerEmail, midX, topY + 16 + lineGap * 4, {
          width: midColWidth - 8,
        });
      }

      doc
        .fontSize(11)
        .fillColor("#666666")
        .text(
          tFinance("invoice.sections.details").toLocaleUpperCase(locale),
          rightX,
          topY,
        );
      doc.fillColor("#000000");
      doc.fontSize(10).text(
        `${tFinance("invoice.fields.issued")}: ${
          invoice.issuedAt
            ? formatDateForLocale(invoice.issuedAt, {}, appLang)
            : emptyValue
        }`,
        rightX,
        topY + 16,
        { width: rightColWidth - 8 },
      );
      doc.text(
        `${tFinance("invoice.fields.paid")}: ${
          invoice.paidAt
            ? formatDateForLocale(invoice.paidAt, {}, appLang)
            : emptyValue
        }`,
        rightX,
        topY + 16 + lineGap,
        { width: rightColWidth - 8 },
      );
      doc.text(
        `${tFinance("invoice.fields.currency")}: ${currency}`,
        rightX,
        topY + 16 + lineGap * 2,
        { width: rightColWidth - 8 },
      );
      doc.text(
        `${tFinance("invoice.fields.vat")}: ${formatNumberForLocale(
          vatRate,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 },
          appLang,
        )}%`,
        rightX,
        topY + 16 + lineGap * 3,
        { width: rightColWidth - 8 },
      );

      const dividerY = topY + 16 + lineGap * 6;
      doc
        .strokeColor("#E5E7EB")
        .moveTo(margin, dividerY)
        .lineTo(pageWidth - margin, dividerY)
        .stroke();
      doc.strokeColor("#000000");

      const tableTop = dividerY + 18;
      const rowHeight = 30;
      const colItem = margin;
      const colQty = margin + Math.floor(contentWidth * 0.55);
      const colUnit = margin + Math.floor(contentWidth * 0.7);
      const colAmount = margin + Math.floor(contentWidth * 0.85);

      doc.fillColor("#F3F4F6").rect(margin, tableTop, contentWidth, rowHeight).fill();
      doc.fillColor("#000000").fontSize(10);
      doc.text(tFinance("invoice.table.service"), colItem + 6, tableTop + 6, {
        width: colQty - colItem - 8,
      });
      doc.text(tFinance("invoice.table.hours"), colQty, tableTop + 6, {
        width: colUnit - colQty - 6,
        align: "right",
      });
      doc.text(tFinance("invoice.table.hourly_rate"), colUnit, tableTop + 6, {
        width: colAmount - colUnit - 6,
        align: "right",
      });
      doc.text(tFinance("invoice.table.amount"), colAmount, tableTop + 6, {
        width: margin + contentWidth - colAmount - 6,
        align: "right",
      });

      let y = tableTop + rowHeight;
      const lineItems = invoice.lineItems ?? [];
      lineItems.forEach((li) => {
        doc
          .strokeColor("#E5E7EB")
          .moveTo(margin, y)
          .lineTo(pageWidth - margin, y)
          .stroke();
        doc.strokeColor("#000000");

        const qty = Number(li.qty ?? 0);
        const unit = Number(li.unitAmountCents ?? 0);
        const amount = Number(li.amountCents ?? 0);
        doc.text(
          li.title?.trim() ? li.title : tFinance("invoice.fallbacks.service"),
          colItem + 6,
          y + 4,
          {
            width: colQty - colItem - 8,
          },
        );
        doc
          .fillColor("#6B7280")
          .fontSize(8)
          .text(formatSlotDateTime(li.start, li.end), colItem + 6, y + 17, {
            width: colQty - colItem - 8,
          });
        doc.fillColor("#000000").fontSize(10);
        doc.text(String(qty), colQty, y + 8, {
          width: colUnit - colQty - 6,
          align: "right",
        });
        doc.text(formatAmount(unit, currency, appLang), colUnit, y + 8, {
          width: colAmount - colUnit - 6,
          align: "right",
        });
        doc.text(formatAmount(amount, currency, appLang), colAmount, y + 8, {
          width: margin + contentWidth - colAmount - 6,
          align: "right",
        });

        y += rowHeight;
      });

      const totalsTop = y + 16;
      const totalsWidth = Math.floor(contentWidth * 0.35);
      const totalsX = pageWidth - margin - totalsWidth;

      const subtotal = Number(invoice.amountSubtotalCents ?? 0);
      const vat = Number(invoice.vatAmountCents ?? 0);
      const total = Number(invoice.amountTotalCents ?? 0);

      doc.fontSize(10).fillColor("#000000");
      doc.text(tFinance("invoice.totals.subtotal"), totalsX, totalsTop, {
        width: totalsWidth - 80,
      });
      doc.text(formatAmount(subtotal, currency, appLang), totalsX, totalsTop, {
        width: totalsWidth,
        align: "right",
      });

      doc.text(tFinance("invoice.fields.vat"), totalsX, totalsTop + 16, {
        width: totalsWidth - 80,
      });
      doc.text(formatAmount(vat, currency, appLang), totalsX, totalsTop + 16, {
        width: totalsWidth,
        align: "right",
      });

      doc
        .fontSize(12)
        .text(tFinance("invoice.totals.total"), totalsX, totalsTop + 36, {
          width: totalsWidth - 80,
        });
      doc.fontSize(12).text(
        formatAmount(total, currency, appLang),
        totalsX,
        totalsTop + 36,
        {
          width: totalsWidth,
          align: "right",
        },
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await params;
  if (!invoiceId) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const payload = await getPayload({ config });
  const me = await payload.find({
    collection: "users",
    where: { clerkUserId: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const payloadUserId = me.docs?.[0]?.id ?? null;
  if (!payloadUserId) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const invoice = (await payload.findByID({
    collection: "invoices",
    id: invoiceId,
    depth: 0,
    overrideAccess: true,
  })) as InvoiceDoc | null;

  if (!invoice) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const customerId = relId(invoice.customer);
  const tenantId = relId(invoice.tenant);
  let ownerId: string | null = null;

  let tenantName: string | null = null;
  let providerName: string | null = null;
  let avatarUrl: string | null = null;

  if (tenantId) {
    const tenant = (await payload.findByID({
      collection: "tenants",
      id: tenantId,
      depth: 2,
      overrideAccess: true,
    })) as Tenant | null;
    ownerId = relId(tenant?.user ?? null);
    tenantName =
      typeof tenant?.name === "string" && tenant.name.trim()
        ? tenant.name.trim()
        : tenant?.slug ?? null;
    if (typeof tenant?.user === "object" && tenant?.user) {
      const first = (tenant.user.firstName ?? "").trim();
      const last = (tenant.user.lastName ?? "").trim();
      const full = `${first} ${last}`.trim();
      providerName = full || null;
    }
    if (typeof tenant?.image === "object" && tenant?.image?.url) {
      avatarUrl = tenant.image.url;
    }
  }

  if (payloadUserId !== customerId && payloadUserId !== ownerId) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const h = await headers();
    const requestUrl = new URL(req.url);
    const explicitLang = readExplicitAppLang(requestUrl.searchParams.get("lang"));
    const appLang = explicitLang ?? getAppLangFromHeaders(h) ?? DEFAULT_APP_LANG;
    let avatarBuffer: Buffer | null = null;
    if (avatarUrl) {
      const proto = h.get("x-forwarded-proto") ?? "http";
      const host = h.get("x-forwarded-host") ?? h.get("host");
      const absoluteUrl = avatarUrl.startsWith("http")
        ? avatarUrl
        : host
          ? `${proto}://${host}${avatarUrl}`
          : avatarUrl;
      const res = await fetch(absoluteUrl);
      if (res.ok) {
        const arr = await res.arrayBuffer();
        avatarBuffer = Buffer.from(arr);
      }
    }
    const pdf = await buildPdf({
      invoice,
      appLang,
      tenantName,
      providerName,
      avatarBuffer,
    });

    const pdfBody = new Uint8Array(pdf);
    return new NextResponse(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[invoice pdf] failed", err);
    }
    return NextResponse.json(
      { message: "PDF generation failed" },
      { status: 500 },
    );
  }
}
