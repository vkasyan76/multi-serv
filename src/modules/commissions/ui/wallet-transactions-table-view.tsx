"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type AppLang,
  formatCurrency,
  mapAppLangToLocale,
} from "@/modules/profile/location-utils";
import type { WalletTransactionRow } from "./wallet-types";

type SortKey = "date" | "invoice_date" | "description" | "amount" | "tenant";
type SortDir = "asc" | "desc";

type WalletTransactionsTableViewProps = {
  appLang: AppLang;
  rows: WalletTransactionRow[];
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
  onRowsChange?: (rows: WalletTransactionRow[]) => void;
  onStateChange?: (state: { isLoading: boolean; isError: boolean }) => void;
  showTenantColumns?: boolean;
  showPromotionColumns?: boolean;
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 h-4 w-4 opacity-70" />
  ) : (
    <ArrowDown className="ml-1 h-4 w-4 opacity-70" />
  );
}

function formatBerlinDateTime(iso: string, appLang: AppLang) {
  const locale = mapAppLangToLocale(appLang);
  return new Date(iso).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });
}

function formatBerlinDate(iso: string, appLang: AppLang) {
  const locale = mapAppLangToLocale(appLang);
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

function formatDateRange(
  startIso: string | undefined,
  endIso: string | undefined,
  appLang: AppLang,
) {
  if (!startIso) return "";
  const startLabel = formatBerlinDateTime(startIso, appLang);
  const endLabel = endIso ? formatBerlinDateTime(endIso, appLang) : startLabel;
  return `${startLabel} -> ${endLabel}`;
}

export function WalletTransactionsTableView({
  appLang,
  rows,
  isLoading,
  isError,
  isFetching,
  canLoadMore,
  onLoadMore,
  onRowsChange,
  onStateChange,
  showTenantColumns = false,
  showPromotionColumns = false,
}: WalletTransactionsTableViewProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "date",
    dir: "desc",
  });

  const sortedRows = useMemo(() => {
    const list = [...rows];

    list.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";

      if (sort.key === "date") {
        av = new Date(a.serviceStart ?? a.occurredAt).getTime();
        bv = new Date(b.serviceStart ?? b.occurredAt).getTime();
      } else if (sort.key === "invoice_date") {
        av = new Date(a.invoiceDate ?? a.occurredAt).getTime();
        bv = new Date(b.invoiceDate ?? b.occurredAt).getTime();
      } else if (sort.key === "amount") {
        av = a.amountCents;
        bv = b.amountCents;
      } else if (sort.key === "tenant") {
        av = a.tenantName ?? a.tenantSlug ?? a.tenantId ?? "";
        bv = b.tenantName ?? b.tenantSlug ?? b.tenantId ?? "";
      } else {
        av = a.description;
        bv = b.description;
      }

      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, {
          sensitivity: "base",
        });
      }

      if (cmp === 0) {
        cmp = a.id.localeCompare(b.id);
      }

      return sort.dir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [rows, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  useEffect(() => {
    if (!onRowsChange || isLoading || isError) return;
    onRowsChange(sortedRows);
  }, [onRowsChange, sortedRows, isError, isLoading]);

  useEffect(() => {
    if (!onStateChange) return;
    onStateChange({ isLoading, isError });
  }, [onStateChange, isError, isLoading]);

  if (isLoading && rows.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        Loading transactions...
      </div>
    );
  }

  if (isError && rows.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        Failed to load transactions.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        No transactions yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Transactions</h3>
        {isFetching && (
          <span className="text-xs text-muted-foreground">Updating...</span>
        )}
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-foreground">
            <tr className="border-b">
              <th className="py-2 pr-3 font-medium sticky top-0 z-20 bg-white">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-0"
                  onClick={() => toggleSort("invoice_date")}
                >
                  Invoice Date
                  <SortIcon active={sort.key === "invoice_date"} dir={sort.dir} />
                </Button>
              </th>
              <th className="py-2 pr-3 font-medium sticky top-0 z-20 bg-white">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-0"
                  onClick={() => toggleSort("description")}
                >
                  Status
                  <SortIcon active={sort.key === "description"} dir={sort.dir} />
                </Button>
              </th>
              {showTenantColumns && (
                <th className="py-2 pr-3 font-medium sticky top-0 z-20 bg-white">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-0"
                    onClick={() => toggleSort("tenant")}
                  >
                    Tenant
                    <SortIcon active={sort.key === "tenant"} dir={sort.dir} />
                  </Button>
                </th>
              )}
              <th className="py-2 pr-3 font-medium sticky top-0 z-20 bg-white">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-0"
                  onClick={() => toggleSort("amount")}
                >
                  Amount
                  <SortIcon active={sort.key === "amount"} dir={sort.dir} />
                </Button>
              </th>
              {showPromotionColumns && (
                <th className="py-2 pr-3 font-medium sticky top-0 z-20 bg-white">
                  Fee %
                </th>
              )}
              {showPromotionColumns && (
                <th className="py-2 pr-3 font-medium sticky top-0 z-20 bg-white">
                  Promo
                </th>
              )}
              <th className="py-2 pr-3 font-medium sticky top-0 z-20 bg-white">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-0"
                  onClick={() => toggleSort("date")}
                >
                  Order Date
                  <SortIcon active={sort.key === "date"} dir={sort.dir} />
                </Button>
              </th>
              <th className="py-2 font-medium sticky top-0 z-20 bg-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const sign = row.amountCents >= 0 ? "+" : "-";
              const amount = formatCurrency(
                Math.abs(row.amountCents) / 100,
                row.currency,
                appLang,
              );
              const isFee = row.type === "platform_fee";
              const dateLabel = row.serviceStart
                ? formatDateRange(row.serviceStart, row.serviceEnd, appLang)
                : formatBerlinDateTime(row.occurredAt, appLang);
              const invoiceDateLabel = row.invoiceDate
                ? formatBerlinDate(row.invoiceDate, appLang)
                : formatBerlinDate(row.occurredAt, appLang);
              const feePercentLabel =
                typeof row.appliedFeeRateBps === "number"
                  ? `${(row.appliedFeeRateBps / 100).toFixed(row.appliedFeeRateBps % 100 === 0 ? 0 : 2)}%`
                  : "--";
              const promoLabel = row.promotionId
                ? (row.promotionName?.trim() ||
                  `promo:${row.promotionId.slice(-6)}`)
                : "None";
              const statusLabel =
                row.type === "payment_received" && row.occurredAt
                  ? `Paid ${formatBerlinDate(row.occurredAt, appLang)}`
                  : row.type === "payment_outstanding"
                    ? "Payment due"
                    : row.type === "platform_fee" && row.occurredAt
                      ? `Fee ${formatBerlinDate(row.occurredAt, appLang)}`
                      : row.type === "platform_fee"
                        ? "Fee"
                        : row.description;

              return (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                    {invoiceDateLabel}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={isFee ? "text-muted-foreground" : ""}>
                      {statusLabel}
                    </span>
                  </td>
                  {showTenantColumns && (
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <div className="font-medium">
                        {row.tenantName ?? "Unknown tenant"}
                      </div>
                      {(() => {
                        const fallback = row.tenantSlug
                          ? `/${row.tenantSlug}`
                          : row.tenantId ?? "";
                        const normalizedName = (
                          row.tenantName ?? ""
                        ).trim().toLowerCase();
                        const normalizedFallback = fallback
                          .replace(/^\//, "")
                          .trim()
                          .toLowerCase();
                        // Hide the second line when slug/id does not add new info.
                        if (!fallback || normalizedName === normalizedFallback) {
                          return null;
                        }
                        return (
                          <div className="text-xs text-muted-foreground">
                            {fallback}
                          </div>
                        );
                      })()}
                    </td>
                  )}
                  <td className="py-2 pr-3">
                    <span className={isFee ? "text-muted-foreground" : ""}>
                      {sign}
                      {amount}
                    </span>
                  </td>
                  {showPromotionColumns && (
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {feePercentLabel}
                    </td>
                  )}
                  {showPromotionColumns && (
                    <td
                      className={
                        row.promotionId
                          ? "py-2 pr-3 whitespace-nowrap"
                          : "py-2 pr-3 text-muted-foreground whitespace-nowrap"
                      }
                      title={
                        row.promotionId
                          ? [
                              `id: ${row.promotionId}`,
                              row.promotionType
                                ? `type: ${row.promotionType}`
                                : "",
                              row.appliedRuleId
                                ? `rule: ${row.appliedRuleId}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" | ")
                          : undefined
                      }
                    >
                      {promoLabel}
                    </td>
                  )}
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                    {dateLabel}
                  </td>
                  <td className="py-2">
                    {row.type === "platform_fee" ? (
                      <span className="text-muted-foreground">--</span>
                    ) : (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/invoices/${row.invoiceId}`}>View invoice</Link>
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canLoadMore && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
