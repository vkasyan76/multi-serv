"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { formatCurrency } from "@/lib/i18n/locale";
import { PriceFilter } from "@/modules/tenants/ui/components/price-filter";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function HomePriceInput({ value, onChange, className }: Props) {
  const tMarketplace = useTranslations("marketplace");
  const routeLocale = useLocale();
  const appLang = normalizeToSupported(routeLocale);
  const [open, setOpen] = useState(false);
  const numericValue = Number(value);
  const hasValidValue = value !== "" && Number.isFinite(numericValue);

  const triggerLabel = useMemo(() => {
    if (!hasValidValue) {
      return tMarketplace("filters.max_hourly_rate");
    }

    return tMarketplace("filters.max_hourly_rate_summary", {
      amount: formatCurrency(numericValue, undefined, appLang),
    });
  }, [appLang, hasValidValue, numericValue, tMarketplace]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-full border border-black/10 bg-white px-4 py-0 text-left text-sm leading-none font-medium shadow-none",
            className
          )}
          aria-label={tMarketplace("filters.max_hourly_rate")}
        >
          {/* Match the other homepage filters: show the filter name when empty,
          then switch the collapsed pill to a localized selected-value summary. */}
          <span className="truncate">{triggerLabel}</span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[320px] rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_18px_40px_rgba(0,0,0,0.08)]"
      >
        <div className="space-y-3">
          <PriceFilter
            maxPrice={value}
            onMaxPriceChange={onChange}
            // Homepage keeps delayed apply so orbit results do not jump on every keypress.
            commitMode="blur"
            inputClassName="h-12 rounded-full border-black/10 bg-white px-4 text-sm font-medium shadow-none"
          />

          {hasValidValue ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-auto rounded-full px-3 py-1 text-xs"
                onClick={() => onChange("")}
              >
                {tMarketplace("filters.clear")}
              </Button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
