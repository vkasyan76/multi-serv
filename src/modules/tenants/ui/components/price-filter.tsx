import { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLocaleAndCurrency } from "@/modules/profile/location-utils";

interface Props {
  minPrice?: string | null;
  maxPrice?: string | null;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
}

export const formatAsCurrency = (
  value: string,
  locale?: string,
  currency?: string
) => {
  if (!value) return "";

  const { locale: userLocale, currency: userCurrency } = getLocaleAndCurrency();
  const targetLocale = locale || userLocale;
  const targetCurrency = currency || userCurrency;

  // Determine the decimal separator for the current locale
  const decimalSeparator = (1.1).toLocaleString(targetLocale).substring(1, 2);

  // Determine the thousands separator by formatting a bigger number
  const thousandSeparator = (1000)
    .toLocaleString(targetLocale)
    .replace(/1|0/g, "");

  // Remove thousands separators from input
  let normalizedValue = value.split(thousandSeparator).join("");

  // Replace locale decimal separator with '.' for parsing
  if (decimalSeparator !== ".") {
    normalizedValue = normalizedValue.replace(decimalSeparator, ".");
  }

  // Remove all chars except digits and dot
  normalizedValue = normalizedValue.replace(/[^0-9.]/g, "");

  // Split on dot to limit decimals to 2 digits max
  const parts = normalizedValue.split(".");
  const formattedValue =
    parts[0] + (parts.length > 1 ? "." + parts[1]?.slice(0, 2) : "");

  if (!formattedValue) return "";

  const numberValue = parseFloat(formattedValue);
  if (isNaN(numberValue)) return "";

  // Format number as currency in user locale
  return new Intl.NumberFormat(targetLocale, {
    style: "currency",
    currency: targetCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numberValue);
};

export const PriceFilter = ({
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
}: Props) => {
  const { locale } = getLocaleAndCurrency();

  const normalizePriceInput = (input: string): string => {
    // Determine the decimal separator for the current locale
    const decimalSeparator = (1.1).toLocaleString(locale).substring(1, 2);

    // Remove all chars except digits and decimal separator
    let numericValue = input.replace(
      new RegExp(`[^0-9${decimalSeparator}]`, "g"),
      ""
    );

    // Normalize decimal separator to dot for consistency
    if (decimalSeparator !== ".") {
      numericValue = numericValue.replace(decimalSeparator, ".");
    }

    return numericValue;
  };

  const handleMinPriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const cleanedValue = normalizePriceInput(e.target.value);
    onMinPriceChange(cleanedValue);
  };

  const handleMaxPriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const cleanedValue = normalizePriceInput(e.target.value);
    onMaxPriceChange(cleanedValue);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <Label className="font-medium text-base">Minimum</Label>
        <Input
          type="text"
          placeholder="€0"
          value={minPrice ? formatAsCurrency(minPrice) : ""}
          onChange={handleMinPriceChange}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-medium text-base">Maximum</Label>
        <Input
          type="text"
          placeholder="∞" // Infinity sign
          value={maxPrice ? formatAsCurrency(maxPrice) : ""}
          onChange={handleMaxPriceChange}
        />
      </div>
    </div>
  );
};
