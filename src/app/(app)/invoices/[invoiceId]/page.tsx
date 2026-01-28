import { caller } from "@/trpc/server";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { Badge } from "@/components/ui/badge";
import { DownloadPdfButton } from "./DownloadPdfButton";
import { InvoiceTopBar } from "./InvoiceTopBar";
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
  getAppLangFromHeaders,
  countryNameFromCode,
  formatDateForLocale,
  getLocaleAndCurrency,
} from "@/modules/profile/location-utils";

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
  params: Promise<{ invoiceId: string }>;
}) => {
  const { invoiceId } = await params;
  if (!invoiceId) notFound();

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
      : invoice.tenant?.id ?? null;
  const tenant =
    tenantId
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
      : tenant?.slug ?? invoice.sellerLegalName ?? "Service Provider";
  const tenantSlug =
    typeof tenant?.slug === "string" && tenant.slug.trim()
      ? tenant.slug.trim()
      : null;
  const tenantAvatarUrl =
    typeof tenant?.image === "object" && tenant?.image?.url
      ? tenant.image.url
      : null;
  const tenantUser =
    typeof tenant?.user === "object" && tenant?.user
      ? tenant.user
      : null;
  const providerFullName = [tenantUser?.firstName, tenantUser?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const providerName =
    providerFullName || invoice.sellerLegalName || "Service Provider";
  const appLang = getAppLangFromHeaders(await headers());
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

  const subtotalMajor = Number(invoice.amountSubtotalCents ?? 0) / 100;
  const vatMajor = Number(invoice.vatAmountCents ?? 0) / 100;
  const totalMajor = Number(invoice.amountTotalCents ?? 0) / 100;
  const vatRate = Number(invoice.vatRateBps ?? 0) / 100;

  const formatSlotDateTime = (start?: string | null, end?: string | null) => {
    if (!start) return "";
    const startDate = new Date(start);
    const startLabel = formatDateForLocale(
      startDate,
      { year: "numeric", month: "short", day: "numeric" },
      appLang
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
      appLang
    );
    return `${startLabel}, ${startTime} \u2013 ${endLabel}, ${endTime}`;
  };

  return (
    <div className="min-h-screen bg-white">
      <InvoiceTopBar
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        tenantAvatarUrl={tenantAvatarUrl}
      />
      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-medium">Invoice</h1>
            <p className="text-sm text-muted-foreground">
              {invoice.id}
            </p>
          </div>
          <Badge
            variant="secondary"
            className={`border-0 ${statusClass[String(invoice.status ?? "")] ?? "bg-slate-200 text-slate-900"}`}
          >
            {String(invoice.status ?? "unknown")}
          </Badge>
        </div>
      </header>

      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10 space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div>
            <h2 className="text-sm uppercase text-muted-foreground">
              Service Provider
            </h2>
            <div className="mt-2 text-sm">
              <div className="font-medium">{providerName}</div>
              <div>{invoice.sellerAddressLine1}</div>
              <div>
                {invoice.sellerPostal} {invoice.sellerCity}
              </div>
              <div>{sellerCountry}</div>
              {invoice.sellerEmail ? (
                <div>{invoice.sellerEmail}</div>
              ) : null}
              {invoice.sellerVatId ? (
                <div>VAT ID: {invoice.sellerVatId}</div>
              ) : null}
            </div>
          </div>

          <div>
            <h2 className="text-sm uppercase text-muted-foreground">Client</h2>
            <div className="mt-2 text-sm">
              <div className="font-medium">{invoice.buyerName}</div>
              <div>{invoice.buyerAddressLine1}</div>
              <div>
                {invoice.buyerPostal} {invoice.buyerCity}
              </div>
              <div>{buyerCountry}</div>
              {invoice.buyerEmail ? (
                <div>{invoice.buyerEmail}</div>
              ) : null}
            </div>
          </div>

          <div>
            <h2 className="text-sm uppercase text-muted-foreground">Details</h2>
            <div className="mt-2 text-sm space-y-1">
              <div>
                Issued:{" "}
                {invoice.issuedAt
                  ? formatDateForLocale(invoice.issuedAt, {}, appLang)
                  : "—"}
              </div>
              <div>
                Paid:{" "}
                {invoice.paidAt
                  ? formatDateForLocale(invoice.paidAt, {}, appLang)
                  : "—"}
              </div>
              <div>Currency: {currency}</div>
              <div>VAT: {vatRate.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Hourly Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoice.lineItems ?? []).map((li, idx) => (
                <TableRow key={`${li.slotId}-${idx}`}>
                  <TableCell>
                    <div className="font-medium">{li.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatSlotDateTime(li.start, li.end)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{li.qty}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(li.unitAmountCents ?? 0) / 100, currency, appLang)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(li.amountCents ?? 0) / 100, currency, appLang)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 items-end text-sm">
          <div className="flex justify-between w-full max-w-sm">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotalMajor, currency, appLang)}</span>
          </div>
          <div className="flex justify-between w-full max-w-sm">
            <span>VAT</span>
            <span>{formatCurrency(vatMajor, currency, appLang)}</span>
          </div>
          <div className="flex justify-between w-full max-w-sm font-medium text-base">
            <span>Total</span>
            <span>{formatCurrency(totalMajor, currency, appLang)}</span>
          </div>
          <div className="pt-4">
            <DownloadPdfButton invoiceId={invoiceId} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Page;
