"use client";

import { CalendarIcon, Download, FilterX } from "lucide-react";
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
import {
  type AppLang,
  formatDateForLocale,
  mapAppLangToLocale,
} from "@/modules/profile/location-utils";
import { cn } from "@/lib/utils";
import type {
  PeriodMode,
  WalletFilters,
  WalletStatusFilter,
} from "./wallet-types";
import {
  FULL_HISTORY_LABEL,
  WALLET_STATUS_LABELS,
} from "./wallet-filter-utils";

type WalletFiltersBarProps = {
  filters: WalletFilters;
  appLang: AppLang;
  onChange: (next: WalletFilters) => void;
  onDownload: () => void;
  canDownload: boolean;
  onClear?: () => void;
};

const PERIOD_LABELS: Record<PeriodMode, string> = {
  all: FULL_HISTORY_LABEL,
  year: "Year",
  month: "Month",
  range: "Custom range",
};

export function WalletFiltersBar({
  filters,
  appLang,
  onChange,
  onDownload,
  canDownload,
  onClear,
}: WalletFiltersBarProps) {
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

  const dateLabel = range?.from
    ? range.to
      ? `${formatDateForLocale(range.from, { timeZone: "Europe/Berlin" }, appLang)} - ${formatDateForLocale(range.to, { timeZone: "Europe/Berlin" }, appLang)}`
      : formatDateForLocale(range.from, { timeZone: "Europe/Berlin" }, appLang)
    : "Pick date range";

  return (
    <div className="rounded-lg border bg-white p-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Period</span>
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
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filters.period.mode === "year" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Year</span>
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
              <SelectValue placeholder="Year" />
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
            <span className="text-xs text-muted-foreground">Month</span>
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
                <SelectValue placeholder="Month" />
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
            <span className="text-xs text-muted-foreground">Year</span>
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
                <SelectValue placeholder="Year" />
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
            Invoice date range
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
        <span className="text-xs text-muted-foreground">Status</span>
        <Select
          value={filters.status}
          onValueChange={(value) =>
            onChange({ ...filters, status: value as WalletStatusFilter })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WALLET_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1" />

      {onClear && (
        <Button variant="ghost" onClick={onClear}>
          <FilterX className="mr-2 h-4 w-4" />
          Clear filters
        </Button>
      )}

      <Button onClick={onDownload} disabled={!canDownload}>
        <Download className="mr-2 h-4 w-4" />
        Download CSV
      </Button>
    </div>
  );
}
