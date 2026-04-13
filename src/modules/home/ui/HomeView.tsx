"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

import Headline from "@/modules/home/ui/billboard/headline";
import CallToAction from "@/modules/home/ui/cta/call-to-action";
import type { HomepageCategoriesOutput } from "@/modules/categories/types";

import { Poppins } from "next/font/google";
import { OrbitAndCarousel } from "./OrbitAndCarousel";
import { HomeMarketplaceSearchBlock } from "./components/home-marketplace-search-block";
import { HomeBrowseCategories } from "./components/home-browse-categories";
import { HomeMarketplaceDesktopFilterRow } from "./components/home-marketplace-desktop-filter-row";

import { type AppLang, normalizeToSupported } from "@/lib/i18n/app-lang";
import {
  DEFAULT_HOME_MARKETPLACE_FILTERS,
  buildHomeMarketplaceQueryInput,
} from "./home-marketplace-filters";
import { useDebouncedValue } from "./use-debounced-value";

const poppins = Poppins({ subsets: ["latin"], weight: ["600"] });
const DESKTOP_DISCOVERY_DOCK_TOP = 116;
const DESKTOP_DISCOVERY_DOCK_GAP = 10;
const DESKTOP_DISCOVERY_DOCK_OFFSET =
  DESKTOP_DISCOVERY_DOCK_TOP + DESKTOP_DISCOVERY_DOCK_GAP;

type Props = {
  homepageCategories: HomepageCategoriesOutput;
};

export default function HomeView({ homepageCategories }: Props) {
  const trpc = useTRPC();
  const tCommon = useTranslations("common");
  const appLang: AppLang = normalizeToSupported(useLocale());
  const [filters, setFilters] = useState(DEFAULT_HOME_MARKETPLACE_FILTERS);
  const discoverySectionRef = useRef<HTMLElement | null>(null);
  const filterAnchorRef = useRef<HTMLDivElement | null>(null);
  const [showDesktopFilterDock, setShowDesktopFilterDock] = useState(false);

  const { data: session, isLoading: sessionLoading } = useQuery(
    trpc.auth.session.queryOptions()
  );
  const profileQ = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: !!session?.user,
  });
  const isAuthed = !!session?.user;
  const isProfileResolved =
    !isAuthed || profileQ.isSuccess || profileQ.isError;

  const viewer =
    isAuthed &&
    typeof profileQ.data?.coordinates?.lat === "number" &&
    typeof profileQ.data?.coordinates?.lng === "number"
      ? {
          lat: profileQ.data.coordinates.lat,
          lng: profileQ.data.coordinates.lng,
          city: profileQ.data.coordinates.city ?? null,
        }
      : undefined;
  const hasViewerCoords = !!viewer;

  useEffect(() => {
    if (!isProfileResolved) return;

    const shouldClearDistance =
      !isAuthed || (profileQ.isSuccess && !hasViewerCoords);

    if (!shouldClearDistance) return;

    // Keep homepage filter state aligned with auth/profile availability so an
    // old distance choice cannot silently reactivate after logout or after a
    // successful profile load that confirms no saved coordinates.
    setFilters((prev) =>
      prev.distanceFilterEnabled || prev.maxDistance !== null
        ? {
            ...prev,
            distanceFilterEnabled: false,
            maxDistance: null,
          }
        : prev
    );
  }, [hasViewerCoords, isAuthed, isProfileResolved, profileQ.isSuccess]);

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

  const isOnboarded = isAuthed && profileQ.data?.onboardingCompleted === true;
  const hasTenant = !!session?.user?.tenants?.length;
  const ctaLoading = sessionLoading || profileQ.isLoading;

  useEffect(() => {
    const sectionEl = discoverySectionRef.current;
    const anchorEl = filterAnchorRef.current;
    if (!sectionEl || !anchorEl) return;

    const updateDock = () => {
      if (window.innerWidth < 1024) {
        setShowDesktopFilterDock(false);
        return;
      }

      const sectionRect = sectionEl.getBoundingClientRect();
      const anchorRect = anchorEl.getBoundingClientRect();
      const hasScrolledPastFilters =
        anchorRect.top <= DESKTOP_DISCOVERY_DOCK_OFFSET;
      const sectionStillActive =
        sectionRect.bottom > DESKTOP_DISCOVERY_DOCK_OFFSET + 120;

      setShowDesktopFilterDock(
        hasScrolledPastFilters && sectionStillActive
      );
    };

    updateDock();
    window.addEventListener("scroll", updateDock, { passive: true });
    window.addEventListener("resize", updateDock);
    return () => {
      window.removeEventListener("scroll", updateDock);
      window.removeEventListener("resize", updateDock);
    };
  }, []);

  return (
    <>
      <div className="sticky top-16 z-40 hidden border-b border-black/10 bg-[#F4F4F0] lg:block">
        <div className="container mx-auto px-4 py-3">
          {/* Restore the desktop browse rail as its own opaque header layer so
          sticky behavior matches the old homepage navigation more closely. */}
          <HomeBrowseCategories data={homepageCategories} />
        </div>
      </div>

      {showDesktopFilterDock ? (
        <div
          className="fixed left-0 right-0 z-30 hidden border-b border-black/10 bg-[#F4F4F0]/95 backdrop-blur lg:block"
          style={{ top: DESKTOP_DISCOVERY_DOCK_OFFSET }}
        >
          <div className="container mx-auto px-4 pt-3 pb-2">
            {/* Keep the dock out of normal flow so it appears without pushing
            the discovery section. A small top gap keeps the compact pills from
            feeling clipped against the sticky browse rail above. */}
            <HomeMarketplaceDesktopFilterRow
              compact
              categories={homepageCategories}
              isSignedIn={isAuthed}
              hasViewerCoords={hasViewerCoords}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>
        </div>
      ) : null}

      <div className="overflow-x-hidden">
        <div className="container mx-auto px-4 pt-6 pb-4">
          <Headline
            line1={tCommon("home.hero.line1")}
            line2={tCommon("home.hero.line2")}
            className="md:max-w-6xl lg:max-w-7xl"
            line1FontClass={poppins.className}
            line2FontClass={poppins.className}
          />

          {/* Keep the homepage filters attached to the orbit/billboard block so
          desktop browsing does not lose the controls as soon as the hero
          scrolls out of view. */}
          <section ref={discoverySectionRef} className="mt-6 space-y-6">
            <div className="lg:rounded-[32px] lg:border lg:border-black/5 lg:bg-[#F4F4F0]/55 lg:p-4">
              <HomeMarketplaceSearchBlock
                categories={homepageCategories}
                isSignedIn={isAuthed}
                hasViewerCoords={hasViewerCoords}
                filters={filters}
                onFiltersChange={setFilters}
                desktopRowRef={filterAnchorRef}
              />

              <div className="mt-6 grid grid-cols-1 gap-10 items-start lg:grid-cols-[1fr_minmax(360px,520px)]">
                <OrbitAndCarousel
                  queryInput={queryInput}
                  viewer={viewer}
                  appLang={appLang}
                />
              </div>
            </div>
          </section>

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
