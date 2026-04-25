"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { NumericFormat, NumberFormatValues } from "react-number-format";

import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { getCurrencyInputConfig } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

interface Props {
  maxPrice?: string | null;
  onMaxPriceChange: (value: string) => void;
  commitMode?: "immediate" | "blur";
  inputClassName?: string;
}

export const PriceFilter = ({
  maxPrice,
  onMaxPriceChange,
  commitMode = "immediate",
  inputClassName,
}: Props) => {
  const routeLocale = useLocale();
  // Route locale is authoritative; normalize defensively so region variants
  // still map into the supported app-language set.
  const appLang = normalizeToSupported(routeLocale);
  const [draftValue, setDraftValue] = useState(maxPrice ?? "");
  const skipCommitOnBlurRef = useRef(false);

  useEffect(() => {
    if (commitMode === "blur") {
      setDraftValue(maxPrice ?? "");
    }
  }, [commitMode, maxPrice]);

  const {
    decimalSeparator,
    thousandSeparator,
    prefix,
    suffix,
    placeholder,
  } = useMemo(() => getCurrencyInputConfig(appLang), [appLang]);

  const commitDraftValue = (rawValue = draftValue) => {
    const parsed =
      rawValue === "" || Number.isNaN(Number(rawValue))
        ? ""
        : Number(rawValue).toString();

    if (parsed !== (maxPrice ?? "")) {
      onMaxPriceChange(parsed);
    }

    if (parsed !== rawValue) {
      setDraftValue(parsed);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <NumericFormat
          className={cn("w-full rounded border px-2 py-2", inputClassName)}
          inputMode="decimal"
          thousandSeparator={thousandSeparator}
          decimalSeparator={decimalSeparator}
          allowedDecimalSeparators={[decimalSeparator, ".", ","]}
          decimalScale={2}
          fixedDecimalScale
          allowNegative={false}
          allowLeadingZeros={false}
          prefix={prefix}
          suffix={suffix}
          placeholder={placeholder}
          value={commitMode === "blur" ? draftValue : maxPrice ?? ""}
          valueIsNumericString
          onValueChange={(values: NumberFormatValues) => {
            if (commitMode === "blur") {
              setDraftValue(values.value);
              return;
            }

            if (values.floatValue === undefined || values.floatValue === null) {
              onMaxPriceChange("");
            } else {
              onMaxPriceChange(values.floatValue.toString());
            }
          }}
          onBlur={
            commitMode === "blur"
              ? () => {
                  if (skipCommitOnBlurRef.current) {
                    skipCommitOnBlurRef.current = false;
                    return;
                  }

                  commitDraftValue();
                }
              : undefined
          }
          onKeyDown={
            commitMode === "blur"
              ? (event) => {
                  if (event.key === "Enter") {
                    skipCommitOnBlurRef.current = true;
                    commitDraftValue();
                    event.currentTarget.blur();
                  }

                  if (event.key === "Escape") {
                    skipCommitOnBlurRef.current = true;
                    setDraftValue(maxPrice ?? "");
                    event.currentTarget.blur();
                  }
                }
              : undefined
          }
        />
      </div>
    </div>
  );
};
