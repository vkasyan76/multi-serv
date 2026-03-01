"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TenantOption = {
  id: string;
  name?: string | null;
  slug?: string | null;
};

const ALL_TENANTS_VALUE = "all";

export function TenantCombobox({
  value,
  options,
  loading,
  onChange,
}: {
  value: string;
  options: TenantOption[];
  loading?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (value === ALL_TENANTS_VALUE) return "All tenants";
    const selected = options.find((opt) => opt.id === value);
    return (selected?.name ?? selected?.slug ?? "").trim() || "All tenants";
  }, [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Tenant"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={loading ? "Loading tenants..." : "Search tenants..."}
          />
          <CommandList>
            <CommandEmpty>No tenant found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all tenants"
                onSelect={() => {
                  onChange(ALL_TENANTS_VALUE);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === ALL_TENANTS_VALUE ? "opacity-100" : "opacity-0",
                  )}
                />
                All tenants
              </CommandItem>

              {options.map((opt) => {
                const label = (opt.name ?? opt.slug ?? "").trim() || opt.id;
                const searchValue = `${opt.name ?? ""} ${opt.slug ?? ""}`.trim();

                return (
                  <CommandItem
                    key={opt.id}
                    value={searchValue || label}
                    onSelect={() => {
                      onChange(opt.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
