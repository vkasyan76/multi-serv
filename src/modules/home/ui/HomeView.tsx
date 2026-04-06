"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

import Headline from "@/modules/home/ui/billboard/headline";
import CallToAction from "@/modules/home/ui/cta/call-to-action";

import { Poppins } from "next/font/google";
import { OrbitAndCarousel } from "./OrbitAndCarousel";
import { HomeMarketplaceSearchBlock } from "./components/home-marketplace-search-block";
import { HomeBrowseCategories } from "./components/home-browse-categories";

import { type AppLang, normalizeToSupported } from "@/lib/i18n/app-lang";
import { buildHomeMarketplaceHref } from "./build-home-marketplace-href";
import {
  DEFAULT_HOME_MARKETPLACE_FILTERS,
  buildHomeMarketplaceQueryInput,
} from "./home-marketplace-filters";
import { useDebouncedValue } from "./use-debounced-value";

const poppins = Poppins({ subsets: ["latin"], weight: ["600"] });

export default function HomeView() {
  const router = useRouter();
  const trpc = useTRPC();
  const tCommon = useTranslations("common");
  const appLang: AppLang = normalizeToSupported(useLocale());
  const [filters, setFilters] = useState(DEFAULT_HOME_MARKETPLACE_FILTERS);

  const { data: session, isLoading: sessionLoading } = useQuery(
    trpc.auth.session.queryOptions()
  );
  const profileQ = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: !!session?.user,
  });

  const viewer =
    typeof profileQ.data?.coordinates?.lat === "number" &&
    typeof profileQ.data?.coordinates?.lng === "number"
      ? {
          lat: profileQ.data.coordinates.lat,
          lng: profileQ.data.coordinates.lng,
          city: profileQ.data.coordinates.city ?? null,
        }
      : undefined;

  const debouncedSearch = useDebouncedValue(filters.search, 400);
  const previewFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters]
  );

  const queryInput = useMemo(
    () =>
      buildHomeMarketplaceQueryInput({
        // Homepage preview stays local-state driven. Listing URL state remains
        // separate and is only used when the user opens full results.
        filters: previewFilters,
        viewer,
        isSignedIn: !!session?.user,
        limit: 24,
      }),
    [previewFilters, session?.user, viewer]
  );

  const isAuthed = !!session?.user;
  const isOnboarded = profileQ.data?.onboardingCompleted === true;
  const hasTenant = !!session?.user?.tenants?.length;
  const ctaLoading = sessionLoading || profileQ.isLoading;

  const handleViewResults = useCallback(() => {
    router.push(
      buildHomeMarketplaceHref({
        lang: appLang,
        filters,
        isSignedIn: !!session?.user,
      })
    );
  }, [appLang, filters, router, session?.user]);

  return (
    <>
      <div className="sticky top-16 z-40 hidden border-b border-black/10 bg-[#F4F4F0] lg:block">
        <div className="container mx-auto px-4 py-3">
          {/* Restore the desktop browse rail as its own opaque header layer so
          sticky behavior matches the old homepage navigation more closely. */}
          <HomeBrowseCategories />
        </div>
      </div>

      <div className="overflow-x-hidden">
        <div className="container mx-auto px-4 pt-6 pb-4">
          <Headline
            line1={tCommon("home.hero.line1")}
            line2={tCommon("home.hero.line2")}
            className="md:max-w-6xl lg:max-w-7xl"
            line1FontClass={poppins.className}
            line2FontClass={poppins.className}
          />

          <HomeMarketplaceSearchBlock
            isSignedIn={isAuthed}
            filters={filters}
            onFiltersChange={setFilters}
            onViewResultsAction={handleViewResults}
          />

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_minmax(360px,520px)] gap-10 items-start">
            <OrbitAndCarousel
              queryInput={queryInput}
              viewer={viewer}
              appLang={appLang}
            />
          </div>

          <div id="cta-sentinel" className="h-px w-full" aria-hidden="true" />
          <CallToAction
            isAuthed={isAuthed}
            isOnboarded={isOnboarded}
            hasTenant={hasTenant}
            loading={ctaLoading}
            sentinelId="cta-sentinel"
          />
        </div>
      </div>
    </>
  );
}
