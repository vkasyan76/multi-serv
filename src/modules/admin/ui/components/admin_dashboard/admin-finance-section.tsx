"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { WalletFiltersBar } from "@/modules/commissions/ui/wallet-filters-bar";
import type { WalletFilters } from "@/modules/commissions/ui/wallet-types";
import {
  type AppLang,
  getInitialLanguage,
  normalizeToSupported,
} from "@/modules/profile/location-utils";
import { useTRPC } from "@/trpc/client";
import { AdminWalletSummaryCard } from "./admin-wallet-summary-card";
import { AdminWalletTransactionsTable } from "./admin-wallet-transactions-table";

export function AdminFinanceSection() {
  const trpc = useTRPC();
  const profileQ = useQuery(trpc.auth.getUserProfile.queryOptions());
  const tenantOptionsQ = useQuery(
    trpc.commissions.adminTenantOptions.queryOptions({}),
  );

  const appLang: AppLang = useMemo(() => {
    const profileLang = profileQ.data?.language;
    if (profileLang) return normalizeToSupported(profileLang);
    return getInitialLanguage();
  }, [profileQ.data?.language]);

  const [walletFilters, setWalletFilters] = useState<WalletFilters>({
    period: { mode: "all" },
    status: "all",
  });
  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
  const tenantId = selectedTenantId === "all" ? undefined : selectedTenantId;

  useEffect(() => {
    // Convenience: if there is only one tenant, pre-select it.
    const options = tenantOptionsQ.data ?? [];
    if (options.length !== 1) return;
    const onlyTenantId = options[0]?.id;
    if (!onlyTenantId) return;

    setSelectedTenantId((prev) => (prev === "all" ? onlyTenantId : prev));
  }, [tenantOptionsQ.data]);

  return (
    <div className="space-y-4">
      <WalletFiltersBar
        filters={walletFilters}
        appLang={appLang}
        onChange={setWalletFilters}
        onClear={
          walletFilters.status !== "all" ||
          walletFilters.period.mode !== "all" ||
          selectedTenantId !== "all"
            ? () => {
                setWalletFilters({
                  period: { mode: "all" },
                  status: "all",
                });
                setSelectedTenantId("all");
              }
            : undefined
        }
        tenantScope={{
          value: selectedTenantId,
          options: tenantOptionsQ.data ?? [],
          loading: tenantOptionsQ.isLoading,
          onChange: setSelectedTenantId,
        }}
      />

      <AdminWalletSummaryCard
        tenantId={tenantId}
        appLang={appLang}
        filters={walletFilters}
      />

      <AdminWalletTransactionsTable
        tenantId={tenantId}
        appLang={appLang}
        filters={walletFilters}
      />
    </div>
  );
}
