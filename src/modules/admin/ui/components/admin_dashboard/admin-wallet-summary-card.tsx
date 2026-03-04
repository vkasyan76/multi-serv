"use client";

import { useQuery } from "@tanstack/react-query";

import type { WalletFilters } from "@/modules/commissions/ui/wallet-types";
import { deriveInvoiceRangeIso } from "@/modules/commissions/ui/wallet-filter-utils";
import { WalletSummaryCardView } from "@/modules/commissions/ui/wallet-summary-card-view";
import { type AppLang } from "@/modules/profile/location-utils";
import { useTRPC } from "@/trpc/client";

type AdminWalletSummaryCardProps = {
  tenantId?: string;
  appLang: AppLang;
  filters: WalletFilters;
};

export function AdminWalletSummaryCard({
  tenantId,
  appLang,
  filters,
}: AdminWalletSummaryCardProps) {
  const trpc = useTRPC();
  const { startIso, endIso } = deriveInvoiceRangeIso(filters.period);
  const summaryQ = useQuery(
    trpc.commissions.adminWalletSummary.queryOptions({
      tenantId,
      status: filters.status,
      start: startIso,
      end: endIso,
    }),
  );

  return (
    <WalletSummaryCardView
      appLang={appLang}
      filters={filters}
      isLoading={summaryQ.isLoading}
      isError={summaryQ.isError}
      data={summaryQ.data}
    />
  );
}
