"use client";

import { Input } from "@/components/ui/input";
import { BookmarkCheckIcon, ListFilterIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CategoriesSidebar } from "./categories-sidebar";
import { SignedIn, useAuth } from "@clerk/nextjs";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";
import { useTenantFilters } from "@/modules/tenants/hooks/use-tenant-filters";
import { debounce } from "nuqs";

interface Props {
  disabled?: boolean;
}

export const SearchInput = ({ disabled }: Props) => {
  const tCommon = useTranslations("common");
  const tOrders = useTranslations("orders");
  const [filters, setFilters] = useTenantFilters();
  const currentLang = normalizeToSupported(useLocale());
  const { isSignedIn } = useAuth();

  const trpc = useTRPC();

  // Always refetch auth-backed state so the Orders CTA reflects the session.
  const session = useQuery({
    ...trpc.auth.session.queryOptions(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
  });

  // Show Orders only when Clerk is signed in and the backend confirms data.
  const hasOrdersQ = useQuery({
    ...trpc.orders.hasAnyMineSlotLifecycle.queryOptions(),
    enabled: isSignedIn && !!session.data?.user?.id,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const showOrders = isSignedIn && !!hasOrdersQ.data?.hasAny;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 w-full">
      <CategoriesSidebar
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
      />
      <div className="relative w-full">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
        <Input
          className="pl-10"
          type="search"
          placeholder={tCommon("home.search.placeholder")}
          disabled={disabled}
          value={filters.search}
          onChange={(e) =>
            setFilters(
              (prev) => ({
                ...prev,
                search: e.target.value,
              }),
              {
                // Debounce URL/server updates while typing, but clear immediately.
                limitUrlUpdates:
                  e.target.value === "" ? undefined : debounce(400),
              },
            )
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setFilters(
                (prev) => ({
                  ...prev,
                  search: (e.target as HTMLInputElement).value,
                }),
                {},
              );
            }
          }}
        />
      </div>
      <Button
        variant="elevated"
        className="size-12 shrink-0 flex lg:hidden"
        onClick={() => setIsSidebarOpen(true)}
      >
        <ListFilterIcon className="size-4" />
      </Button>
      <SignedIn>
        {showOrders && (
          <Button
            asChild
            variant="elevated"
            className="h-12 shrink-0 px-3 sm:px-4"
          >
            <Link
              href={withLocalePrefix("/orders", currentLang)}
              aria-label={tOrders("page.title")}
              title={tOrders("page.title")}
            >
              <BookmarkCheckIcon />
              {/* Keep the search-bar CTA shorter than the page title so it stays stable across locales. */}
              <span className="hidden sm:inline">
                {tOrders("page.cta_short")}
              </span>
            </Link>
          </Button>
        )}
      </SignedIn>
    </div>
  );
};
