"use client";

import { useEffect } from "react";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchSuggestion } from "@/modules/search/types";
import { useGlobalSearchController } from "@/modules/search/ui/use-global-search-controller";

type Props = {
  className?: string;
  onActiveChange?: (active: boolean) => void;
};

export function MobileGlobalSearch({
  className,
  onActiveChange,
}: Props) {
  const t = useTranslations("common");

  const {
    query,
    setQuery,
    setOpen,
    activeIndex,
    setActiveIndex,
    suggestions,
    topSuggestion,
    activeSuggestion,
    isLoading,
    shouldShowResults,
    handleNavigate,
    moveActive,
  } = useGlobalSearchController({ limit: 6 });

  useEffect(() => {
    onActiveChange?.(shouldShowResults);
  }, [onActiveChange, shouldShowResults]);

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
    <div className={cn("border-b border-black/10", className)}>
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
        <Input
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
                if (!shouldShowResults) return;

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
          aria-expanded={shouldShowResults}
          aria-controls="mobile-global-search-list"
          autoComplete="off"
          className="h-14 rounded-none border-0 pl-11 shadow-none focus-visible:ring-0"
        />
      </div>

      {shouldShowResults ? (
        <div className="border-t border-black/10 bg-[#F8F8F5] px-2 py-2">
          <Command shouldFilter={false} className="bg-transparent">
            <CommandList
              id="mobile-global-search-list"
              className="max-h-[320px]"
            >
              {isLoading ? (
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
        </div>
      ) : null}
    </div>
  );
}
