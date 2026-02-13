"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import {
  type AppLang,
  formatCurrency,
  mapAppLangToLocale,
} from "@/modules/profile/location-utils";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type WalletTransactionsTableProps = {
  slug: string;
  appLang: AppLang;
};

type SortKey = "date" | "invoice_date" | "description" | "amount";
type SortDir = "asc" | "desc";

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

export function WalletTransactionsTable({
  slug,
  appLang,
}: WalletTransactionsTableProps) {
  const trpc = useTRPC();
  const [limit, setLimit] = useState(50);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "date",
    dir: "desc",
  });

  const txQ = useQuery(
    trpc.commissions.walletTransactions.queryOptions({
      slug,
      limit,
      type: "all",
    }),
  );

  const rows = txQ.data ?? [];

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

  const canLoadMore = rows.length >= limit;

  if (txQ.isLoading) {
    return (
      <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        Loading transactions...
      </div>
    );
  }

  if (txQ.isError) {
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
      <h3 className="text-base font-semibold">Transactions</h3>
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
                  <SortIcon
                    active={sort.key === "invoice_date"}
                    dir={sort.dir}
                  />
                </Button>
              </th>
              <th className="py-2 pr-3 font-medium sticky top-0 z-20 bg-white">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-0"
                  onClick={() => toggleSort("description")}
                >
                  Description
                  <SortIcon
                    active={sort.key === "description"}
                    dir={sort.dir}
                  />
                </Button>
              </th>
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
              // Prefer service range from invoice line items; fall back to event time.
              const dateLabel = row.serviceStart
                ? formatDateRange(row.serviceStart, row.serviceEnd, appLang)
                : formatBerlinDateTime(row.occurredAt, appLang);
              const invoiceDateLabel = row.invoiceDate
                ? formatBerlinDate(row.invoiceDate, appLang)
                : formatBerlinDate(row.occurredAt, appLang);

              return (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                    {invoiceDateLabel}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={isFee ? "text-muted-foreground" : ""}>
                      {row.description}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={isFee ? "text-muted-foreground" : ""}>
                      {sign}
                      {amount}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                    {dateLabel}
                  </td>
                  <td className="py-2">
                    {row.type === "platform_fee" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/invoices/${row.invoiceId}`}>
                          View invoice
                        </Link>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLimit((prev) => prev + 50)}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
