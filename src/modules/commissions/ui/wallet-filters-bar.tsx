"use client";

import { CalendarIcon, Download, FilterX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TenantCombobox } from "@/components/ui/tenant-combobox";
import {
  formatDateForLocale,
  mapAppLangToLocale,
} from "@/lib/i18n/locale";
import { type AppLang } from "@/lib/i18n/app-lang";
import { cn } from "@/lib/utils";
import type {
  PeriodMode,
  WalletFilters,
  WalletStatusFilter,
  WalletTenantOption,
} from "./wallet-types";
import { WALLET_STATUS_ORDER } from "./wallet-filter-utils";

type WalletFiltersBarProps = {
  filters: WalletFilters;
  appLang: AppLang;
  onChange: (next: WalletFilters) => void;
  onClear?: () => void;
  // Optional admin extension: tenant scope selector.
  tenantScope?: {
    value: string;
    options: WalletTenantOption[];
    loading?: boolean;
    onChange: (next: string) => void;
    variant?: "select" | "combobox";
  };
  // Optional because admin Phase 2 has no CSV export yet.
  download?: {
    onClick: () => void;
    enabled: boolean;
  };
};

export function WalletFiltersBar({
  filters,
  appLang,
  onChange,
  onClear,
  tenantScope,
  download,
}: WalletFiltersBarProps) {
  const tFinance = useTranslations("finance");
  const locale = mapAppLangToLocale(appLang);
  const berlinYear = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      year: "numeric",
    }).format(new Date()),
  );
  const berlinMonth = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      month: "numeric",
    }).format(new Date()),
  );

  const yearOptions = Array.from({ length: 7 }, (_, index) => {
    return berlinYear - 5 + index;
  });

  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const monthValue = index + 1;
    const label = monthFormatter.format(new Date(2024, index, 1));
    return { value: monthValue, label };
  });

  const range: DateRange | undefined =
    filters.period.mode === "range" && (filters.period.start || filters.period.end)
      ? { from: filters.period.start, to: filters.period.end }
      : undefined;
  const periodOptions: Array<{ value: PeriodMode; label: string }> = [
    { value: "all", label: tFinance("wallet.filters.options.full_history") },
    { value: "year", label: tFinance("wallet.filters.options.year") },
    { value: "month", label: tFinance("wallet.filters.options.month") },
    { value: "range", label: tFinance("wallet.filters.options.custom_range") },
  ];

  const getStatusLabel = (status: WalletStatusFilter) => {
    switch (status) {
      case "all":
        return tFinance("wallet.status.all");
      case "paid":
        return tFinance("wallet.status.paid");
      case "payment_due":
        return tFinance("wallet.status.payment_due");
      case "platform_fee":
        return tFinance("wallet.status.fees");
    }
  };

  const dateLabel = range?.from
    ? range.to
      ? `${formatDateForLocale(range.from, { timeZone: "Europe/Berlin" }, appLang)} - ${formatDateForLocale(range.to, { timeZone: "Europe/Berlin" }, appLang)}`
      : formatDateForLocale(range.from, { timeZone: "Europe/Berlin" }, appLang)
    : tFinance("wallet.filters.placeholders.pick_date_range");

  return (
    <div className="rounded-lg border bg-white p-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          {tFinance("wallet.filters.labels.period")}
        </span>
        <Select
          value={filters.period.mode}
          onValueChange={(value) => {
            const mode = value as PeriodMode;
            if (mode === "all") {
              onChange({ ...filters, period: { mode } });
              return;
            }
            if (mode === "year") {
              onChange({
                ...filters,
                period: {
                  mode,
                  year: filters.period.year ?? berlinYear,
                },
              });
              return;
            }
            if (mode === "month") {
              onChange({
                ...filters,
                period: {
                  mode,
                  year: filters.period.year ?? berlinYear,
                  month: filters.period.month ?? berlinMonth,
                },
              });
              return;
            }
            onChange({
              ...filters,
              period: {
                mode: "range",
                start: filters.period.start,
                end: filters.period.end,
              },
            });
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue
              placeholder={tFinance("wallet.filters.placeholders.select_period")}
            />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filters.period.mode === "year" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {tFinance("wallet.filters.labels.year")}
          </span>
          <Select
            value={String(filters.period.year ?? berlinYear)}
            onValueChange={(value) =>
              onChange({
                ...filters,
                period: {
                  mode: "year",
                  year: Number(value),
                },
              })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={tFinance("wallet.filters.labels.year")} />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filters.period.mode === "month" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {tFinance("wallet.filters.labels.month")}
            </span>
            <Select
              value={String(filters.period.month ?? berlinMonth)}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  period: {
                    mode: "month",
                    month: Number(value),
                    year: filters.period.year ?? berlinYear,
                  },
                })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue
                  placeholder={tFinance("wallet.filters.labels.month")}
                />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={String(option.value)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {tFinance("wallet.filters.labels.year")}
            </span>
            <Select
              value={String(filters.period.year ?? berlinYear)}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  period: {
                    mode: "month",
                    month: filters.period.month ?? berlinMonth,
                    year: Number(value),
                  },
                })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={tFinance("wallet.filters.labels.year")} />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {filters.period.mode === "range" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {tFinance("wallet.filters.labels.invoice_date_range")}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal w-[240px]",
                  !range && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(next) =>
                  onChange({
                    ...filters,
                    period: {
                      mode: "range",
                      start: next?.from,
                      end: next?.to,
                    },
                  })
                }
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          {tFinance("wallet.filters.labels.status")}
        </span>
        <Select
          value={filters.status}
          onValueChange={(value) =>
            onChange({ ...filters, status: value as WalletStatusFilter })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue
              placeholder={tFinance("wallet.filters.placeholders.select_status")}
            />
          </SelectTrigger>
          <SelectContent>
            {WALLET_STATUS_ORDER.map((value) => (
              <SelectItem key={value} value={value}>
                {getStatusLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tenantScope && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {tFinance("wallet.filters.labels.tenant")}
          </span>
          {tenantScope.variant === "combobox" ? (
            // Admin tenant lists can grow large; searchable single-select keeps the same scope semantics.
            <div className="w-[220px]">
              <TenantCombobox
                value={tenantScope.value}
                options={tenantScope.options}
                loading={tenantScope.loading}
                onChange={tenantScope.onChange}
              />
            </div>
          ) : (
            <Select
              value={tenantScope.value}
              onValueChange={tenantScope.onChange}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue
                  placeholder={
                    tenantScope.loading
                      ? tFinance("wallet.filters.placeholders.loading_tenants")
                      : tFinance("wallet.filters.placeholders.all_tenants")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {tFinance("wallet.filters.placeholders.all_tenants")}
                </SelectItem>
                {tenantScope.options.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="flex-1" />

      {onClear && (
        <Button variant="ghost" onClick={onClear}>
          <FilterX className="mr-2 h-4 w-4" />
          {tFinance("wallet.actions.clear_filters")}
        </Button>
      )}

      {download && (
        <Button onClick={download.onClick} disabled={!download.enabled}>
          <Download className="mr-2 h-4 w-4" />
          {tFinance("wallet.actions.download_csv")}
        </Button>
      )}
    </div>
  );
}
