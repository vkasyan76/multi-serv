import { ChangeEvent, KeyboardEvent, useState, useRef, useEffect } from "react";
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
  if (!value || value.trim() === '') return "";

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

  if (!formattedValue || formattedValue === '.') return "";

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
  const { locale, currency } = getLocaleAndCurrency();
  const [isMinFocused, setIsMinFocused] = useState(false);
  const [isMaxFocused, setIsMaxFocused] = useState(false);
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);

  // Generate dynamic currency symbol for placeholder
  const currencySymbol = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0).replace('0', '').trim();

  const normalizePriceInput = (input: string): string => {
    // If input is empty or just whitespace, return empty string
    if (!input || input.trim() === '') {
      return '';
    }

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
    const inputValue = e.target.value;
    
    // If the input is empty, clear the value
    if (!inputValue || inputValue.trim() === '') {
      onMinPriceChange('');
      return;
    }
    
    const cleanedValue = normalizePriceInput(inputValue);
    onMinPriceChange(cleanedValue);
  };

  const handleMaxPriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // If the input is empty, clear the value
    if (!inputValue || inputValue.trim() === '') {
      onMaxPriceChange('');
      return;
    }
    
    const cleanedValue = normalizePriceInput(inputValue);
    onMaxPriceChange(cleanedValue);
  };

  const handleMinBlur = () => {
    setIsMinFocused(false);
    // Format on blur if there's a value
    if (minPrice && minInputRef.current) {
      const formatted = formatAsCurrency(minPrice);
      if (formatted) {
        minInputRef.current.value = formatted;
      }
    }
  };

  const handleMaxBlur = () => {
    setIsMaxFocused(false);
    // Format on blur if there's a value
    if (maxPrice && maxInputRef.current) {
      const formatted = formatAsCurrency(maxPrice);
      if (formatted) {
        maxInputRef.current.value = formatted;
      }
    }
  };

  const handleMinFocus = () => {
    setIsMinFocused(true);
    // Show raw value when focused
    if (minPrice && minInputRef.current) {
      minInputRef.current.value = minPrice;
    }
  };

  const handleMaxFocus = () => {
    setIsMaxFocused(true);
    // Show raw value when focused
    if (maxPrice && maxInputRef.current) {
      maxInputRef.current.value = maxPrice;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <Label className="font-medium text-base">Minimum</Label>
        <Input
          ref={minInputRef}
          type="text"
          placeholder={`${currencySymbol}0`}
          value={isMinFocused ? minPrice || "" : (minPrice ? formatAsCurrency(minPrice) : "")}
          onChange={handleMinPriceChange}
          onFocus={handleMinFocus}
          onBlur={handleMinBlur}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-medium text-base">Maximum</Label>
        <Input
          ref={maxInputRef}
          type="text"
          placeholder="∞" // Infinity sign
          value={isMaxFocused ? maxPrice || "" : (maxPrice ? formatAsCurrency(maxPrice) : "")}
          onChange={handleMaxPriceChange}
          onFocus={handleMaxFocus}
          onBlur={handleMaxBlur}
        />
      </div>
    </div>
  );
};
