import { caller } from "@/trpc/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { Badge } from "@/components/ui/badge";
import { DownloadPdfButton } from "@/modules/invoices/ui/DownloadPdfButton";
import { InvoiceTopBar } from "@/modules/invoices/ui/InvoiceTopBar";
import { resolveInvoiceLineItemLabels } from "@/modules/invoices/server/invoice-line-item-labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  countryNameFromCode,
  formatDateForLocale,
  formatNumberForLocale,
  getLocaleAndCurrency,
} from "@/lib/i18n/locale";
import { normalizeToSupported } from "@/lib/i18n/app-lang";

export const dynamic = "force-dynamic";

const statusClass: Record<string, string> = {
  paid: "bg-emerald-200 text-emerald-900",
  issued: "bg-amber-200 text-amber-900",
  overdue: "bg-amber-200 text-amber-900",
  draft: "bg-slate-200 text-slate-900",
  void: "bg-slate-200 text-slate-900",
};

const Page = async ({
  params,
}: {
  params: Promise<{ lang: string; invoiceId: string }>;
}) => {
  const { lang, invoiceId } = await params;
  if (!invoiceId) notFound();

  const appLang = normalizeToSupported(lang);
  const tFinance = await getTranslations({
    locale: appLang,
    namespace: "finance",
  });

  let invoice: Awaited<ReturnType<typeof caller.invoices.getById>> | null =
    null;

  try {
    invoice = await caller.invoices.getById({ invoiceId });
  } catch {
    notFound();
  }

  if (!invoice) notFound();

  const payload = await getPayload({ config });
  const tenantId =
    typeof invoice.tenant === "string"
      ? invoice.tenant
      : (invoice.tenant?.id ?? null);
  const tenant = tenantId
    ? await payload.findByID({
        collection: "tenants",
        id: tenantId,
        depth: 2,
        overrideAccess: true,
      })
    : null;
  const tenantName =
    typeof tenant?.name === "string" && tenant.name.trim()
      ? tenant.name.trim()
      : (tenant?.slug ??
        invoice.sellerLegalName ??
        tFinance("invoice.sections.service_provider"));
  const tenantSlug =
    typeof tenant?.slug === "string" && tenant.slug.trim()
      ? tenant.slug.trim()
      : null;
  const tenantAvatarUrl =
    typeof tenant?.image === "object" && tenant?.image?.url
      ? tenant.image.url
      : null;
  const tenantUser =
    typeof tenant?.user === "object" && tenant?.user ? tenant.user : null;
  const providerFullName = [tenantUser?.firstName, tenantUser?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const providerName =
    providerFullName ||
    invoice.sellerLegalName ||
    tFinance("invoice.sections.service_provider");
  const { locale } = getLocaleAndCurrency(appLang);
  const currency = (invoice.currency ?? "eur").toUpperCase();
  const sellerCountry =
    countryNameFromCode(invoice.sellerCountryISO, appLang) ??
    invoice.sellerCountryISO ??
    "";
  const buyerCountry =
    countryNameFromCode(invoice.buyerCountryISO, appLang) ??
    invoice.buyerCountryISO ??
    "";
  const resolvedLineItemLabels = await resolveInvoiceLineItemLabels({
    payload,
    lineItems: (invoice.lineItems ?? []).map((li) => ({
      slotId: li.slotId,
      title: li.title,
    })),
    appLang,
  });

  const subtotalMajor = Number(invoice.amountSubtotalCents ?? 0) / 100;
  const vatMajor = Number(invoice.vatAmountCents ?? 0) / 100;
  const totalMajor = Number(invoice.amountTotalCents ?? 0) / 100;
  const vatRate = Number(invoice.vatRateBps ?? 0) / 100;
  const emptyValue = tFinance("invoice.fallbacks.empty_value");

  const formatSlotDateTime = (start?: string | null, end?: string | null) => {
    if (!start) return "";
    const startDate = new Date(start);
    const startLabel = formatDateForLocale(
      startDate,
      { year: "numeric", month: "short", day: "numeric" },
      appLang,
    );
    const timeFmt = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const statusLabel = (() => {
    switch (invoice.status) {
      case "paid":
        return tFinance("invoice.status.paid");
      case "issued":
        return tFinance("invoice.status.issued");
      case "overdue":
        return tFinance("invoice.status.overdue");
      case "draft":
        return tFinance("invoice.status.draft");
      case "void":
        return tFinance("invoice.status.void");
      default:
        return tFinance("invoice.status.unknown");
    }
  })();

  return (
    <div className="min-h-screen bg-white">
      <InvoiceTopBar
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        tenantAvatarUrl={tenantAvatarUrl}
      />
      <header className="border-b bg-[#F4F4F0] py-8">
        <div className="mx-auto flex max-w-(--breakpoint-xl) items-center justify-between px-4 lg:px-12">
          <div>
            <h1 className="text-[28px] font-medium">
              {tFinance("invoice.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{invoice.id}</p>
          </div>
          <Badge
            variant="secondary"
            className={`border-0 ${statusClass[String(invoice.status ?? "")] ?? "bg-slate-200 text-slate-900"}`}
          >
            {statusLabel}
          </Badge>
        </div>
      </header>

      <section className="mx-auto max-w-(--breakpoint-xl) space-y-8 px-4 py-10 lg:px-12">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div>
            <h2 className="text-sm uppercase text-muted-foreground">
              {tFinance("invoice.sections.service_provider")}
            </h2>
            <div className="mt-2 text-sm">
              <div className="font-medium">{providerName}</div>
              <div>{invoice.sellerAddressLine1}</div>
              <div>
                {invoice.sellerPostal} {invoice.sellerCity}
              </div>
              <div>{sellerCountry}</div>
              {invoice.sellerEmail ? <div>{invoice.sellerEmail}</div> : null}
              {invoice.sellerVatId ? (
                <div>
                  {tFinance("invoice.fields.vat_id")}: {invoice.sellerVatId}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <h2 className="text-sm uppercase text-muted-foreground">
              {tFinance("invoice.sections.client")}
            </h2>
            <div className="mt-2 text-sm">
              <div className="font-medium">{invoice.buyerName}</div>
              <div>{invoice.buyerAddressLine1}</div>
              <div>
                {invoice.buyerPostal} {invoice.buyerCity}
              </div>
              <div>{buyerCountry}</div>
              {invoice.buyerEmail ? <div>{invoice.buyerEmail}</div> : null}
            </div>
          </div>

          <div>
            <h2 className="text-sm uppercase text-muted-foreground">
              {tFinance("invoice.sections.details")}
            </h2>
            <div className="mt-2 space-y-1 text-sm">
              <div>
                {tFinance("invoice.fields.issued")}:{" "}
                {invoice.issuedAt
                  ? formatDateForLocale(invoice.issuedAt, {}, appLang)
                  : emptyValue}
              </div>
              <div>
                {tFinance("invoice.fields.paid")}:{" "}
                {invoice.paidAt
                  ? formatDateForLocale(invoice.paidAt, {}, appLang)
                  : emptyValue}
              </div>
              <div>
                {tFinance("invoice.fields.currency")}: {currency}
              </div>
              <div>
                {tFinance("invoice.fields.vat")}:{" "}
                {formatNumberForLocale(
                  vatRate,
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                  appLang,
                )}
                %
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tFinance("invoice.table.service")}</TableHead>
                <TableHead className="text-right">
                  {tFinance("invoice.table.hours")}
                </TableHead>
                <TableHead className="text-right">
                  {tFinance("invoice.table.hourly_rate")}
                </TableHead>
                <TableHead className="text-right">
                  {tFinance("invoice.table.amount")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoice.lineItems ?? []).map((li, idx) => (
                <TableRow key={`${li.slotId}-${idx}`}>
                  <TableCell>
                    <div className="font-medium">
                      {resolvedLineItemLabels[idx]?.trim()
                        ? resolvedLineItemLabels[idx]
                        : tFinance("invoice.fallbacks.service")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatSlotDateTime(li.start, li.end)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{li.qty}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      Number(li.unitAmountCents ?? 0) / 100,
                      currency,
                      appLang,
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      Number(li.amountCents ?? 0) / 100,
                      currency,
                      appLang,
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col items-end gap-2 text-sm">
          <div className="flex w-full max-w-sm justify-between">
            <span>{tFinance("invoice.totals.subtotal")}</span>
            <span>{formatCurrency(subtotalMajor, currency, appLang)}</span>
          </div>
          <div className="flex w-full max-w-sm justify-between">
            <span>{tFinance("invoice.fields.vat")}</span>
            <span>{formatCurrency(vatMajor, currency, appLang)}</span>
          </div>
          <div className="flex w-full max-w-sm justify-between text-base font-medium">
            <span>{tFinance("invoice.totals.total")}</span>
            <span>{formatCurrency(totalMajor, currency, appLang)}</span>
          </div>
          <div className="pt-4">
            <DownloadPdfButton invoiceId={invoiceId} appLang={appLang} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Page;
