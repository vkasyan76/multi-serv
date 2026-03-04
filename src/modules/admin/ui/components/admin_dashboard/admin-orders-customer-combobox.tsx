"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

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
import { useTRPC } from "@/trpc/client";

type CustomerOption = {
  key: string;
  label: string;
  email?: string | null;
  queryValue: string;
};

type Props = {
  tenantId?: string;
  value?: string;
  displayValue?: string;
  onChange: (next?: { value?: string; label?: string }) => void;
};

const ALL_CUSTOMERS_LABEL = "All customers";

export function AdminOrdersCustomerCombobox({
  tenantId,
  value,
  displayValue,
  onChange,
}: Props) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const canSuggest = open && trimmedQuery.length >= 2;
  // Avoid constructing a typed tRPC query with invalid empty input when suggestions are disabled.
  const suggestionsQuery = canSuggest
    ? (trpc.orders.adminCustomerOptions.queryOptions({
        tenantId,
        query: trimmedQuery,
      }) as unknown as UseQueryOptions<CustomerOption[]>)
    : ({
        queryKey: ["orders.adminCustomerOptions", tenantId ?? "", ""],
        queryFn: async () => [] as CustomerOption[],
        enabled: false,
      } satisfies UseQueryOptions<CustomerOption[]>);
  const suggestionsQ = useQuery(suggestionsQuery);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const suggestions = (suggestionsQ.data ?? []) as CustomerOption[];

  const selectedLabel = useMemo(() => {
    if (!value) return ALL_CUSTOMERS_LABEL;
    if (displayValue?.trim()) return displayValue.trim();
    const option = suggestions.find((item) => item.queryValue === value);
    if (option) return option.label;
    return value;
  }, [displayValue, suggestions, value]);

  const applyTypedQuery = () => {
    if (!trimmedQuery) return;
    onChange({ value: trimmedQuery, label: trimmedQuery });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Customer"
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
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmedQuery) {
                e.preventDefault();
                // Keep keyboard apply behavior after removing the explicit Search button.
                applyTypedQuery();
              }
            }}
            placeholder="Search customers..."
          />
          <CommandList>
            <CommandEmpty>
              {trimmedQuery.length < 2
                ? "Type at least 2 characters."
                : "No customer found."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all customers"
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0",
                  )}
                />
                All customers
              </CommandItem>

              {trimmedQuery ? (
                <CommandItem
                  value={`use ${trimmedQuery}`}
                  onSelect={applyTypedQuery}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  {`Use "${trimmedQuery}"`}
                </CommandItem>
              ) : null}

              {suggestions.map((option) => (
                <CommandItem
                  key={option.key}
                  value={`${option.label} ${option.email ?? ""}`.trim()}
                  onSelect={() => {
                    // Keep the human label separate from the applied query token.
                    onChange({ value: option.queryValue, label: option.label });
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.queryValue ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="truncate">{option.label}</div>
                    {option.email ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {option.email}
                      </div>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
