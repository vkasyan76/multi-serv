import { getLocaleAndCurrency } from "@/modules/profile/location-utils";
import { NumericFormat, NumberFormatValues } from "react-number-format";

interface Props {
  maxPrice?: string | null;
  onMaxPriceChange: (value: string) => void;
}

export const PriceFilter = ({ maxPrice, onMaxPriceChange }: Props) => {
  const { locale, currency } = getLocaleAndCurrency();

  // Generate dynamic currency symbol for placeholder
  const currencySymbol = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(0)
    .replace("0", "")
    .trim();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <NumericFormat
          className="w-full border rounded px-2 py-2"
          thousandSeparator
          decimalScale={2}
          fixedDecimalScale
          allowNegative={false}
          allowLeadingZeros={false}
          prefix={currency === "EUR" ? "€ " : ""}
          placeholder={`${currencySymbol}0.00`}
          // value={maxPrice ? parseFloat(maxPrice) : undefined}
          // valueIsNumericString={false}
          value={maxPrice ?? ""} // was: parseFloat(...) or undefined
          valueIsNumericString // was: false
          onValueChange={(values: NumberFormatValues) => {
            // Handle empty value case
            if (values.floatValue === undefined || values.floatValue === null) {
              onMaxPriceChange("");
            } else {
              // Pass the numeric value as string to maintain compatibility
              onMaxPriceChange(values.floatValue.toString());
            }
          }}
        />
      </div>
    </div>
  );
};
