"use client";

import { useState, useCallback } from "react";
import { Star as StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarPickerProps {
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
  getStarAriaLabel: (value: number) => string;
}

export const StarPicker = ({
  value = 0,
  onChange,
  disabled,
  className,
  ariaLabel,
  getStarAriaLabel,
}: StarPickerProps) => {
  const [hoverValue, setHoverValue] = useState(0);
  const active = (n: number) => (hoverValue || value) >= n;

  const select = useCallback(
    (n: number) => {
      if (!disabled) onChange?.(n);
    },
    [disabled, onChange],
  );

  return (
    <div
      className={cn(
        "flex items-center",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      onMouseLeave={() => setHoverValue(0)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n} // ARIA radio semantics: only the selected value is checked
          aria-label={getStarAriaLabel(n)}
          disabled={disabled}
          className={cn(
            "p-0.5 transition",
            !disabled && "cursor-pointer hover:scale-110",
          )}
          onMouseEnter={() => setHoverValue(n)}
          onClick={() => select(n)}
        >
          <StarIcon
            className={cn(
              "size-5",
              active(n)
                ? "text-yellow-400 fill-yellow-400 stroke-yellow-400"
                : "text-gray-300 stroke-gray-400",
            )}
          />
        </button>
      ))}
    </div>
  );
};
