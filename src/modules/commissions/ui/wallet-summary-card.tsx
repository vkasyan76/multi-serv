"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  type AppLang,
  formatCurrency,
} from "@/modules/profile/location-utils";

type WalletSummaryCardProps = {
  slug: string;
  appLang: AppLang;
};

export function WalletSummaryCard({
  slug,
  appLang,
}: WalletSummaryCardProps) {
  const trpc = useTRPC();
  const summaryQ = useQuery(
    trpc.commissions.walletSummary.queryOptions({ slug }),
  );

  if (summaryQ.isLoading) {
    return (
      <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        Loading wallet summary...
      </div>
    );
  }

  if (summaryQ.isError) {
    return (
      <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        Failed to load wallet summary.
      </div>
    );
  }

  const currency = summaryQ.data?.currency ?? "eur";
  const grossReceivedCents = summaryQ.data?.grossReceivedCents ?? 0;
  const platformFeesCents = summaryQ.data?.platformFeesCents ?? 0;
  const dueFromCustomersCents = summaryQ.data?.dueFromCustomersCents ?? 0;

  const totalInvoicedCents = grossReceivedCents + dueFromCustomersCents;

  return (
    <div className="rounded-lg border bg-white p-5 space-y-4">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Payments received</span>
          <span className="text-lg font-semibold">
            {formatCurrency(grossReceivedCents / 100, currency, appLang)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Due from customers</span>
          <span className="text-lg font-semibold">
            {formatCurrency(dueFromCustomersCents / 100, currency, appLang)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium">Total invoiced</span>
          <span className="text-lg font-semibold">
            {formatCurrency(totalInvoicedCents / 100, currency, appLang)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-3">
          <span className="text-muted-foreground">Platform fees</span>
          <span className="text-lg font-semibold">
            {formatCurrency(-platformFeesCents / 100, currency, appLang)}
          </span>
        </div>
      </div>
    </div>
  );
}
