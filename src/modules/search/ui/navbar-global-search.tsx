"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/modules/home/ui/use-debounced-value";
import { navigateSearchResult } from "@/modules/search/lib/navigate-search-result";
import type { SearchSuggestion } from "@/modules/search/types";
import { useTRPC } from "@/trpc/client";

export function NavbarGlobalSearch() {
  const t = useTranslations("common");
  const trpc = useTRPC();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebouncedValue(query, 200);
  const trimmedDebouncedQuery = debouncedQuery.trim();
  const canSearch = trimmedDebouncedQuery.length >= 2;

  const suggestionsQ = useQuery({
    ...trpc.search.suggest.queryOptions({
      query: trimmedDebouncedQuery,
      limit: 6,
    }),
    enabled: canSearch,
    staleTime: 15_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const suggestions = suggestionsQ.data ?? [];
  const topSuggestion = suggestions[0] ?? null;
  const activeSuggestion =
    activeIndex >= 0 ? suggestions[activeIndex] ?? null : null;

  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmedDebouncedQuery]);

  const shouldShowPopover = open && (canSearch || suggestionsQ.isFetching);

  const handleNavigate = (suggestion: SearchSuggestion) => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    navigateSearchResult(router, suggestion.href);
  };

  const moveActive = (direction: 1 | -1) => {
    if (!suggestions.length) return;

    setActiveIndex((current) => {
      if (current < 0) {
        return direction === 1 ? 0 : suggestions.length - 1;
      }

      return (current + direction + suggestions.length) % suggestions.length;
    });
  };

  const getSuggestionTypeLabel = (suggestion: SearchSuggestion) => {
    switch (suggestion.kind) {
      case "tenant":
        return t("nav.global_search_result_tenant");
      case "category":
        return t("nav.global_search_result_category");
      case "subcategory":
        return t("nav.global_search_result_subcategory");
      case "marketplace":
        return "";
    }
  };

  return (
    <Popover
      open={shouldShowPopover}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        // Closing from click-away should clear the highlighted row just like
        // Escape and navigation do.
        if (!nextOpen) {
          setActiveIndex(-1);
        }
      }}
    >
      <PopoverTrigger asChild>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              switch (event.key) {
                case "ArrowDown":
                  event.preventDefault();
                  moveActive(1);
                  break;
                case "ArrowUp":
                  event.preventDefault();
                  moveActive(-1);
                  break;
                case "Escape":
                  setOpen(false);
                  setActiveIndex(-1);
                  break;
                case "Enter":
                  if (!shouldShowPopover) return;

                  if (activeSuggestion) {
                    event.preventDefault();
                    handleNavigate(activeSuggestion);
                    return;
                  }

                  if (topSuggestion?.autoSelect) {
                    event.preventDefault();
                    handleNavigate(topSuggestion);
                  }
                  break;
              }
            }}
            placeholder={t("nav.global_search_placeholder")}
            aria-label={t("nav.global_search_placeholder")}
            aria-expanded={shouldShowPopover}
            aria-controls="navbar-global-search-list"
            autoComplete="off"
            className="h-11 w-full min-w-0 rounded-full border border-black/10 bg-[#F4F4F0] pl-11 pr-4 text-base text-neutral-900 outline-hidden placeholder:text-neutral-500"
          />
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        // Keep typing anchored in the input instead of letting Radix move
        // focus into the popover content on open.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[var(--radix-popover-trigger-width)] rounded-lg border border-black/10 p-2 shadow-lg"
      >
        <Command shouldFilter={false} className="bg-transparent">
          <CommandList id="navbar-global-search-list" className="max-h-[360px]">
            {suggestionsQ.isFetching && suggestions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-neutral-500">
                {t("nav.global_search_searching")}
              </div>
            ) : null}

            {suggestions.length > 0 ? (
              <CommandGroup>
                {suggestions.map((suggestion, index) => {
                  const isActive = index === activeIndex;
                  const isMarketplace = suggestion.kind === "marketplace";
                  const typeLabel = getSuggestionTypeLabel(suggestion);

                  return (
                    <CommandItem
                      key={`${suggestion.kind}:${suggestion.href}`}
                      value={`${suggestion.kind}:${suggestion.href}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onSelect={() => handleNavigate(suggestion)}
                      className={cn(
                        "rounded-md px-3 py-3",
                        isMarketplace && "mt-1 border-t pt-4",
                        isActive && "bg-accent text-accent-foreground"
                      )}
                    >
                      {isMarketplace ? (
                        <span className="truncate">
                          {t("nav.global_search_see_all", {
                            query: suggestion.label,
                          })}
                        </span>
                      ) : (
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {suggestion.label}
                          </span>
                          <span className="truncate text-xs text-neutral-500">
                            {suggestion.parentLabel
                              ? `${typeLabel} - ${suggestion.parentLabel}`
                              : typeLabel}
                          </span>
                        </div>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
