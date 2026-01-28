import { caller } from "@/trpc/server";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const appLang = getAppLangFromHeaders(await headers());
  const currency = (invoice.currency ?? "eur").toUpperCase();

  const subtotalMajor = Number(invoice.amountSubtotalCents ?? 0) / 100;
  const vatMajor = Number(invoice.vatAmountCents ?? 0) / 100;
  const totalMajor = Number(invoice.amountTotalCents ?? 0) / 100;
  const vatRate = Number(invoice.vatRateBps ?? 0) / 100;

  return (
    <div className="min-h-screen bg-white">
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
            <h2 className="text-sm uppercase text-muted-foreground">Seller</h2>
            <div className="mt-2 text-sm">
              <div className="font-medium">{invoice.sellerLegalName}</div>
              <div>{invoice.sellerAddressLine1}</div>
              <div>
                {invoice.sellerPostal} {invoice.sellerCity}
              </div>
              <div>{invoice.sellerCountryISO}</div>
              {invoice.sellerVatId ? (
                <div>VAT ID: {invoice.sellerVatId}</div>
              ) : null}
              {invoice.sellerEmail ? (
                <div>{invoice.sellerEmail}</div>
              ) : null}
            </div>
          </div>

          <div>
            <h2 className="text-sm uppercase text-muted-foreground">Buyer</h2>
            <div className="mt-2 text-sm">
              <div className="font-medium">{invoice.buyerName}</div>
              <div>{invoice.buyerAddressLine1}</div>
              <div>
                {invoice.buyerPostal} {invoice.buyerCity}
              </div>
              <div>{invoice.buyerCountryISO}</div>
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
                  ? new Date(invoice.issuedAt).toLocaleDateString()
                  : "—"}
              </div>
              <div>
                Paid:{" "}
                {invoice.paidAt
                  ? new Date(invoice.paidAt).toLocaleDateString()
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
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoice.lineItems ?? []).map((li, idx) => (
                <TableRow key={`${li.slotId}-${idx}`}>
                  <TableCell>{li.title}</TableCell>
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
            <Button variant="outline" disabled>
              Download PDF (coming soon)
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Page;
