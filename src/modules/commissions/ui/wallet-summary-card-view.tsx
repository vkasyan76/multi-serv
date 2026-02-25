"use client";

import {
  type AppLang,
  formatCurrency,
} from "@/modules/profile/location-utils";
import type { WalletFilters } from "./wallet-types";
import {
  FULL_HISTORY_LABEL,
  formatPeriodLabel,
  getWalletStatusLabel,
} from "./wallet-filter-utils";

type WalletSummaryCardViewProps = {
  appLang: AppLang;
  filters: WalletFilters;
  isLoading: boolean;
  isError: boolean;
  data?: {
    currency: string;
    grossReceivedCents: number;
    platformFeesCents: number;
    dueFromCustomersCents: number;
  };
};

// Pure view used by both tenant and admin wrappers.
export function WalletSummaryCardView({
  appLang,
  filters,
  isLoading,
  isError,
  data,
}: WalletSummaryCardViewProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        Loading wallet summary...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        Failed to load wallet summary.
      </div>
    );
  }

  const currency = data?.currency ?? "eur";
  const grossReceivedCents = data?.grossReceivedCents ?? 0;
  const platformFeesCents = data?.platformFeesCents ?? 0;
  const dueFromCustomersCents = data?.dueFromCustomersCents ?? 0;

  const totalInvoicedCents = grossReceivedCents + dueFromCustomersCents;
  const periodLabel = formatPeriodLabel(filters.period, appLang);
  const statusLabel =
    filters.status === "all" ? "" : getWalletStatusLabel(filters.status);
  const summaryLabel = [periodLabel || FULL_HISTORY_LABEL, statusLabel]
    .filter(Boolean)
    .join(" \u2022 ");

  return (
    <div className="rounded-lg border bg-white p-5 space-y-4">
      <div className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-sm font-medium text-foreground">
        {summaryLabel}
      </div>
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
