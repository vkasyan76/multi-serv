"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useDebouncedValue } from "@/modules/home/ui/use-debounced-value";
import { navigateSearchResult } from "@/modules/search/lib/navigate-search-result";
import type { SearchSuggestion } from "@/modules/search/types";
import { useTRPC } from "@/trpc/client";

type Options = {
  limit?: number;
};

export function useGlobalSearchController(options: Options = {}) {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 200);
  const canSearchLive = trimmedQuery.length >= 2;
  const canSearchDebounced = debouncedQuery.length >= 2;
  const isDebouncePending = trimmedQuery !== debouncedQuery;

  const suggestionsQ = useQuery({
    ...trpc.search.suggest.queryOptions({
      query: debouncedQuery,
      limit: options.limit ?? 6,
    }),
    enabled: canSearchDebounced,
    staleTime: 15_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const suggestions =
    !canSearchLive || isDebouncePending ? [] : (suggestionsQ.data ?? []);
  const topSuggestion = suggestions[0] ?? null;
  const activeSuggestion =
    activeIndex >= 0 ? suggestions[activeIndex] ?? null : null;

  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmedQuery]);

  useEffect(() => {
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }, [pathname, searchParamsKey]);

  const shouldShowResults =
    open &&
    canSearchLive &&
    (isDebouncePending || suggestionsQ.isFetching || suggestions.length > 0);

  const isLoading =
    (isDebouncePending || suggestionsQ.isFetching) &&
    suggestions.length === 0;

  const handleNavigate = (suggestion: SearchSuggestion) => {
    setOpen(false);
    setQuery(
      suggestion.kind === "marketplace" ? trimmedQuery : suggestion.label
    );
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

  return {
    query,
    setQuery,
    open,
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
  };
}
