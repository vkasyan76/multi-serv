"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  WALLET_TRANSACTIONS_LIMIT_DEFAULT,
  WALLET_TRANSACTIONS_LIMIT_MAX,
  WALLET_TRANSACTIONS_LIMIT_STEP,
} from "@/constants";
import { deriveInvoiceRangeIso } from "@/modules/commissions/ui/wallet-filter-utils";
import { WalletTransactionsTableView } from "@/modules/commissions/ui/wallet-transactions-table-view";
import type {
  WalletFilters,
  WalletTransactionRow,
} from "@/modules/commissions/ui/wallet-types";
import { type AppLang } from "@/modules/profile/location-utils";
import { useTRPC } from "@/trpc/client";

type AdminWalletTransactionsTableProps = {
  tenantId?: string;
  appLang: AppLang;
  filters: WalletFilters;
  onRowsChange?: (rows: WalletTransactionRow[]) => void;
  onStateChange?: (state: { isLoading: boolean; isError: boolean }) => void;
};

export function AdminWalletTransactionsTable({
  tenantId,
  appLang,
  filters,
  onRowsChange,
  onStateChange,
}: AdminWalletTransactionsTableProps) {
  const trpc = useTRPC();
  const [limit, setLimit] = useState(WALLET_TRANSACTIONS_LIMIT_DEFAULT);
  const lastRowsRef = useRef<WalletTransactionRow[]>([]);
  const { startIso, endIso } = deriveInvoiceRangeIso(filters.period);
  const filterKey = `${tenantId ?? "all"}-${filters.status}-${startIso ?? ""}-${endIso ?? ""}`;

  const txQ = useQuery(
    trpc.commissions.adminWalletTransactions.queryOptions({
      tenantId,
      limit,
      status: filters.status,
      start: startIso,
      end: endIso,
    }),
  );

  useEffect(() => {
    if (txQ.data?.rows && !txQ.isError) {
      lastRowsRef.current = txQ.data.rows;
    }
  }, [txQ.data?.rows, txQ.isError]);

  const rows = useMemo(() => txQ.data?.rows ?? lastRowsRef.current, [txQ.data?.rows]);

  const canLoadMore =
    rows.length >= limit && limit < WALLET_TRANSACTIONS_LIMIT_MAX;

  useEffect(() => {
    setLimit(WALLET_TRANSACTIONS_LIMIT_DEFAULT);
  }, [filterKey]);

  return (
    <WalletTransactionsTableView
      appLang={appLang}
      rows={rows}
      isLoading={txQ.isLoading}
      isError={txQ.isError}
      isFetching={txQ.isFetching}
      canLoadMore={canLoadMore}
      onLoadMore={() =>
        setLimit((prev) =>
          Math.min(
            prev + WALLET_TRANSACTIONS_LIMIT_STEP,
            WALLET_TRANSACTIONS_LIMIT_MAX,
          ),
        )
      }
      onRowsChange={onRowsChange}
      onStateChange={onStateChange}
      showTenantColumns
      showPromotionColumns
    />
  );
}
