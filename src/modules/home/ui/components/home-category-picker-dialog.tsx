"use client";

import { CheckIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CategoryOption = {
  label: string;
  value: string;
  workType: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  options: CategoryOption[];
  loading?: boolean;
};

const WORK_TYPE_ORDER = {
  manual: 0,
  consulting: 1,
  digital: 2,
} as const;

export function HomeCategoryPickerDialog({
  open,
  onOpenChange,
  value,
  onValueChange,
  options,
  loading = false,
}: Props) {
  const tMarketplace = useTranslations("marketplace");

  const orderedOptions = useMemo(
    () =>
      [...options].sort((a, b) => {
        // workType stays presentation-only in v1. It only influences list order.
        const aOrder =
          a.workType && a.workType in WORK_TYPE_ORDER
            ? WORK_TYPE_ORDER[a.workType as keyof typeof WORK_TYPE_ORDER]
            : Number.MAX_SAFE_INTEGER;
        const bOrder =
          b.workType && b.workType in WORK_TYPE_ORDER
            ? WORK_TYPE_ORDER[b.workType as keyof typeof WORK_TYPE_ORDER]
            : Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.label.localeCompare(b.label);
      }),
    [options]
  );

  const handleSelect = (nextValue: string) => {
    onValueChange(nextValue === "all" ? "" : nextValue);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-xl rounded-[28px] p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-5 text-left">
          <DialogTitle>{tMarketplace("filters.category")}</DialogTitle>
        </DialogHeader>

        <Command className="rounded-none">
          <CommandInput
            placeholder={tMarketplace("home_search.category_search_placeholder")}
            disabled={loading}
          />
          <CommandList className="max-h-[420px]">
            {loading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                {tMarketplace("home_search.category_loading")}
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {tMarketplace("home_search.category_empty")}
                </CommandEmpty>

                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => handleSelect("all")}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                  >
                    <span>{tMarketplace("filters.all_categories")}</span>
                    <CheckIcon
                      className={cn(
                        "size-4 text-primary",
                        value === "" ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup>
                  {orderedOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.workType ?? ""}`}
                      onSelect={() => handleSelect(option.value)}
                      className="flex items-center justify-between rounded-xl px-4 py-3"
                    >
                      <span>{option.label}</span>
                      <CheckIcon
                        className={cn(
                          "size-4 text-primary",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
