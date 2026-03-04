"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { WalletFiltersBar } from "@/modules/commissions/ui/wallet-filters-bar";
import {
  adminWalletRowsToCsv,
  buildWalletCsvFilename,
  deriveInvoiceRangeIso,
  downloadCsv,
} from "@/modules/commissions/ui/wallet-filter-utils";
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
  const qc = useQueryClient();
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
  const exportRange = useMemo(
    () => deriveInvoiceRangeIso(walletFilters.period),
    [walletFilters.period],
  );
  const exportScopeLabel = useMemo(() => {
    if (selectedTenantId === "all") return "all-tenants";
    const selected = (tenantOptionsQ.data ?? []).find(
      (opt) => opt.id === selectedTenantId,
    );
    return selected?.name || selected?.slug || selectedTenantId;
  }, [selectedTenantId, tenantOptionsQ.data]);

  const handleWalletDownload = async () => {
    const exportData = await qc.fetchQuery(
      trpc.commissions.adminWalletTransactionsExport.queryOptions({
        tenantId,
        status: walletFilters.status,
        start: exportRange.startIso,
        end: exportRange.endIso,
      }),
    );
    const csv = adminWalletRowsToCsv(exportData.rows, {
      appLang,
      timezone: exportData.timezone,
    });
    const filename = buildWalletCsvFilename({
      period: walletFilters.period,
      status: walletFilters.status,
      appLang,
      scopeLabel: exportScopeLabel,
    });
    downloadCsv(filename, csv);
  };

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
          variant: "combobox",
        }}
        download={{
          onClick: handleWalletDownload,
          enabled: true,
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
