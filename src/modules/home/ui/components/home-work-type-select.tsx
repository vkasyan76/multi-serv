"use client";

import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type WorkType = "manual" | "consulting" | "digital" | "";

type Props = {
  value: WorkType;
  onChange: (value: WorkType) => void;
  className?: string;
};

export function HomeWorkTypeSelect({ value, onChange, className }: Props) {
  const tMarketplace = useTranslations("marketplace");

  return (
    <div className={cn("w-full min-w-0", className)}>
      <Select
        value={value || "any"}
        onValueChange={(nextValue) =>
          onChange(nextValue === "any" ? "" : (nextValue as WorkType))
        }
      >
        {/* Use the shared homepage pill shell while keeping real Select semantics. */}
        <SelectTrigger size="pill">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="any">
            {tMarketplace("filters.any_type_of_work")}
          </SelectItem>
          <SelectItem value="manual">
            {tMarketplace("work_type.manual")}
          </SelectItem>
          <SelectItem value="consulting">
            {tMarketplace("work_type.consulting")}
          </SelectItem>
          <SelectItem value="digital">
            {tMarketplace("work_type.digital")}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
