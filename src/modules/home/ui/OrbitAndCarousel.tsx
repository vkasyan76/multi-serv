"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import { useSuspenseQuery, useQuery, skipToken } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { TenantWithRelations } from "@/modules/tenants/types";
import {
  formatMonthYearForLocale,
  type AppLang,
  formatCurrency,
  getLocaleAndCurrency,
} from "@/modules/profile/location-utils";

import TenantOrbit from "@/modules/tenants/ui/components/visuals/TenantOrbit";
import TenantsCarousel from "@/modules/tenants/ui/components/visuals/TenantsCarousel";
import { Category } from "@/payload-types";

type Viewer = { lat: number; lng: number; city?: string | null } | undefined;
// Derive the EXACT input type from the TRPC client:
type TRPCClient = ReturnType<typeof useTRPC>;
type GetManyInput = Parameters<
  TRPCClient["tenants"]["getMany"]["queryOptions"]
>[0];

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function OrbitAndCarousel({
  queryInput,
  viewer,
  appLang,
}: {
  queryInput: GetManyInput; // <-- router-true input type
  viewer: Viewer;
  appLang: AppLang;
}) {
  const trpc = useTRPC();

  const base = trpc.tenants.getMany.queryOptions(queryInput);

  // ✅ Narrow away the `skipToken` branch so TS knows queryFn is a real function
  if (base.queryFn === skipToken) {
    // With your inputs this shouldn't happen; if it does, throw so we notice in dev
    throw new Error(
      "tenants.getMany query was unexpectedly skipped (skipToken)."
    );
  }

  // Suspense fetch; keep previous data on filter changes (no flicker)
  const { data } = useSuspenseQuery({
    queryKey: base.queryKey, // from tRPC
    queryFn: base.queryFn!, // assert non-skip (we know we’re not skipping)
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const tenants = useMemo(
    () => (data?.docs ?? []) as TenantWithRelations[],
    [data?.docs]
  );

  // collect IDs/slugs for rating + order aggregations
  const tenantSlugs = useMemo(
    () =>
      tenants
        .map((t) => t.slug)
        .filter((slug): slug is string => typeof slug === "string"),
    [tenants]
  );

  const tenantIds = useMemo(
    () =>
      tenants
        .map((t) => t.id)
        .filter((id): id is string => typeof id === "string"),
    [tenants]
  );

  // reviews: aggregated avgRating + totalReviews per tenant slug
  const { data: reviewSummaries } = useQuery({
    ...trpc.reviews.summariesForTenants.queryOptions({ slugs: tenantSlugs }),
    enabled: tenantSlugs.length > 0,
  });

  // orders: aggregated ordersCount per tenant id
  const { data: orderStats } = useQuery({
    ...trpc.orders.statsForTenants.queryOptions({ tenantIds }),
    enabled: tenantIds.length > 0,
  });

  // ✅ memoize these maps so they’re stable for useMemo deps
  const reviewMap = useMemo(
    () =>
      reviewSummaries ??
      ({} as Record<string, { avgRating: number; totalReviews: number }>),
    [reviewSummaries]
  );

  const ordersMap = useMemo(
    () => orderStats ?? ({} as Record<string, { ordersCount: number }>),
    [orderStats]
  );

  // small helper: strip HTML and collapse whitespace: for tenant blurbs (descriptions)
  const toPlain = (s: string | null | undefined): string =>
    typeof s === "string"
      ? s
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";

  // Currency for the current appLang
  const { currency } = useMemo(() => getLocaleAndCurrency(appLang), [appLang]);

  // Map to carousel items
  // The non-null assertion assumes all tenants have an id, but if the type allows undefined this will cause a runtime error.
  const items = useMemo(
    () =>
      tenants
        .filter((t) => Boolean(t.id) && Boolean(t.slug))
        .map((t) => {
          const summary = reviewMap[t.slug];
          const ordersSummary = t.id ? ordersMap[t.id] : undefined;

          const rating = summary?.avgRating ?? 0;
          const ratingCount = summary?.totalReviews ?? 0;
          const orders = ordersSummary?.ordersCount ?? 0;
          const pricePerHour =
            typeof t.hourlyRate === "number" ? t.hourlyRate : 0;

          // pick the primary category (first one)
          const primaryCategory = t.categories?.[0];

          const categoryIcon =
            primaryCategory &&
            typeof primaryCategory === "object" &&
            "icon" in primaryCategory
              ? (primaryCategory as Category).icon
              : null;

          return {
            id: t.id!,
            slug: t.slug,
            name: t.name,
            city: t.user?.coordinates?.city ?? "",
            country: t.user?.coordinates?.countryISO ?? undefined,
            imageSrc: t.image?.url ?? t.user?.clerkImageUrl ?? undefined,
            // preformatted price label, including currency and /h
            pricePerHourLabel: `${formatCurrency(
              pricePerHour,
              currency,
              appLang
            )}/h`,
            rating,
            ratingCount,
            since: t.createdAt
              ? formatMonthYearForLocale(t.createdAt, "short", appLang)
              : "",
            orders,
            blurb: toPlain(t.bio) || "Professional services.",
            // category info for billboard
            categoryName: primaryCategory?.name,
            categoryColor:
              typeof primaryCategory?.color === "string"
                ? primaryCategory.color
                : undefined,
            categoryIcon:
              typeof categoryIcon === "string" ? categoryIcon : null,
          };
        }),
    [tenants, reviewMap, ordersMap, appLang, currency]
  );
  // Sync selection
  const [activeSlug, setActiveSlug] = useState<string | undefined>(undefined);

  // fall back to the first available tenant (or clear the selection) whenever the dataset changes and the current slug disappears:
  useEffect(() => {
    if (tenants.length === 0) {
      if (activeSlug !== undefined) {
        setActiveSlug(undefined);
      }
      return;
    }

    const hasActive =
      !!activeSlug && tenants.some((tenant) => tenant.slug === activeSlug);

    if (!hasActive) {
      const next = tenants.find((tenant) => tenant.slug)?.slug;
      if (next && next !== activeSlug) {
        setActiveSlug(next);
      }
    }
  }, [activeSlug, tenants]);

  const onOrbitSelect = useCallback((slug: string) => setActiveSlug(slug), []);
  const onCarouselChange = useCallback(
    (slug: string) => setActiveSlug(slug),
    []
  );

  // Measure orbit size (mount + resize)
  const radarRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = radarRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width || 0;
      setSize(clamp(Math.round(w - 24), 280, 720));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Empty state (not skeleton)
  if (tenants.length === 0) {
    return (
      <>
        <div className="flex w-full min-w-0 justify-center lg:justify-start pr-6 min-h-[280px]">
          <div className="rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground">
            No providers match your filters.
          </div>
        </div>
        <div className="w-full lg:h-full flex justify-end lg:px-12" />
      </>
    );
  }

  return (
    <>
      {/* Orbit (middle column) */}
      <div
        ref={radarRef}
        className="flex w-full min-w-0 justify-center lg:justify-start pr-6 min-h-[280px]"
      >
        {size !== null && (
          <TenantOrbit
            size={size}
            maxDistanceKm={80}
            baseSeconds={16}
            parallax={18}
            tenants={tenants}
            selectedSlug={activeSlug}
            onSelect={onOrbitSelect}
            {...(viewer ? { viewer } : {})} // Omit the prop entirely when viewer is undefined to avoid type error.
            appLang={appLang}
          />
        )}
      </div>

      {/* Carousel (right column) */}
      <div
        className="w-full lg:h-full flex justify-end"
        style={{ visibility: size !== null ? "visible" : "hidden" }} // prevents showing carrousel before orbit measures
        aria-hidden={size === null}
      >
        <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center lg:px-12">
          <TenantsCarousel
            items={items}
            activeSlug={activeSlug}
            onActiveChange={onCarouselChange}
          />
        </div>
      </div>
    </>
  );
}
