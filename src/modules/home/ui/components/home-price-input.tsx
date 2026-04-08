"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

function normalizePriceInput(raw: string) {
  let result = "";
  let sawDot = false;
  let decimals = 0;

  for (const char of raw) {
    if (/[0-9]/.test(char)) {
      if (sawDot) {
        if (decimals >= 2) continue;
        decimals += 1;
      }
      result += char;
      continue;
    }

    if (char === "." && !sawDot) {
      result += result.length === 0 ? "0." : ".";
      sawDot = true;
    }
  }

  return result;
}

export function HomePriceInput({ value, onChange, className }: Props) {
  const tMarketplace = useTranslations("marketplace");
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commitDraftValue = () => {
    const normalized = normalizePriceInput(draftValue);
    const finalized = normalized.endsWith(".")
      ? normalized.slice(0, -1)
      : normalized;

    if (finalized !== value) {
      // Keep the inline homepage input editable without collapsing the orbit
      // on every partial keystroke; commit once the user leaves or confirms.
      onChange(finalized);
    }

    if (finalized !== draftValue) {
      setDraftValue(finalized);
    }
  };

  return (
    <Input
      inputMode="decimal"
      value={draftValue}
      onChange={(event) =>
        setDraftValue(normalizePriceInput(event.target.value))
      }
      onBlur={commitDraftValue}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commitDraftValue();
          event.currentTarget.blur();
        }

        if (event.key === "Escape") {
          setDraftValue(value);
          event.currentTarget.blur();
        }
      }}
      placeholder={tMarketplace("filters.max_hourly_rate_placeholder")}
      className={cn(
        "h-12 w-[170px] rounded-full border-black/10 bg-white px-4 text-sm font-medium shadow-none",
        className,
      )}
    />
  );
}
