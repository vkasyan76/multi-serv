"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";

type Viewer = { lat: number; lng: number; city?: string | null } | undefined;
type TRPCClient = ReturnType<typeof useTRPC>;
type GetManyInput = Parameters<
  TRPCClient["tenants"]["getMany"]["queryOptions"]
>[0];

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const orbitShellClassName =
  "relative w-full max-w-[720px] aspect-square min-h-[280px]";

function OrbitViewportSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading providers"
      className="relative h-full w-full"
    >
      <div className="absolute inset-0 rounded-full border border-border/70 shadow-sm shimmer" />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      >
        <span className="relative block h-5 w-5">
          <span className="absolute inset-0 rounded-full bg-zinc-300/60 animate-ping" />
          <span className="absolute inset-1 rounded-full bg-zinc-400" />
        </span>
      </div>
    </div>
  );
}

function CarouselViewportSkeleton() {
  return (
    <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center lg:px-12">
      <div className="w-full">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <Skeleton className="w-full aspect-[4/3] lg:aspect-square" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrbitAndCarousel({
  queryInput,
  viewer,
  appLang,
}: {
  queryInput: GetManyInput;
  viewer: Viewer;
  appLang: AppLang;
}) {
  const trpc = useTRPC();
  const tMarketplace = useTranslations("marketplace");

  const base = trpc.tenants.getMany.queryOptions(queryInput);
  // Locale-sensitive tenant docs need locale-scoped cache keys or a language
  // switch can reuse stale category names from a previous route locale.
  const queryKey = [
    base.queryKey[0],
    { ...(base.queryKey[1] ?? {}), locale: appLang },
  ] as unknown as typeof base.queryKey;

  if (base.queryFn === skipToken) {
    throw new Error(
      "tenants.getMany query was unexpectedly skipped (skipToken)."
    );
  }

  // Keep previous data during live homepage filter changes so the orbit and
  // carousel do not blank out on every local-state update.
  const tenantsQ = useQuery({
    queryKey,
    queryFn: base.queryFn!,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const data = tenantsQ.data;
  const tenants = useMemo(
    () => (data?.docs ?? []) as TenantWithRelations[],
    [data?.docs]
  );
  const isRefreshing = tenantsQ.isFetching && !!data;

  const tenantSlugs = useMemo(
    () =>
      tenants
        .map((tenant) => tenant.slug)
        .filter((slug): slug is string => typeof slug === "string"),
    [tenants]
  );

  const tenantIds = useMemo(
    () =>
      tenants
        .map((tenant) => tenant.id)
        .filter((id): id is string => typeof id === "string"),
    [tenants]
  );

  const { data: reviewSummaries } = useQuery({
    ...trpc.reviews.summariesForTenants.queryOptions({ slugs: tenantSlugs }),
    enabled: tenantSlugs.length > 0,
    placeholderData: keepPreviousData,
  });

  const { data: orderStats } = useQuery({
    ...trpc.orders.statsForTenants.queryOptions({ tenantIds }),
    enabled: tenantIds.length > 0,
    placeholderData: keepPreviousData,
  });

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

  const toPlain = (value: string | null | undefined): string =>
    typeof value === "string"
      ? value
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";

  const { currency } = useMemo(() => getLocaleAndCurrency(appLang), [appLang]);

  const items = useMemo(
    () =>
      tenants
        .filter((tenant) => Boolean(tenant.id) && Boolean(tenant.slug))
        .map((tenant) => {
          const summary = reviewMap[tenant.slug];
          const ordersSummary = tenant.id ? ordersMap[tenant.id] : undefined;
          const pricePerHour =
            typeof tenant.hourlyRate === "number" ? tenant.hourlyRate : 0;
          const primaryCategory = tenant.categories?.[0];

          const categoryIcon =
            primaryCategory &&
            typeof primaryCategory === "object" &&
            "icon" in primaryCategory
              ? (primaryCategory as Category).icon
              : null;

          return {
            id: tenant.id!,
            slug: tenant.slug,
            name: tenant.name,
            city: tenant.user?.coordinates?.city ?? "",
            country: tenant.user?.coordinates?.countryISO ?? undefined,
            imageSrc: tenant.image?.url ?? tenant.user?.clerkImageUrl ?? undefined,
            pricePerHourLabel: `${formatCurrency(
              pricePerHour,
              currency,
              appLang
            )}/h`,
            rating: summary?.avgRating ?? 0,
            ratingCount: summary?.totalReviews ?? 0,
            since: tenant.createdAt
              ? formatMonthYearForLocale(tenant.createdAt, "short", appLang)
              : "",
            orders: ordersSummary?.ordersCount ?? 0,
            blurb: toPlain(tenant.bio) || tMarketplace("tenant.fallback_bio"),
            categoryName: primaryCategory?.name,
            categoryColor:
              typeof primaryCategory?.color === "string"
                ? primaryCategory.color
                : undefined,
            categoryIcon:
              typeof categoryIcon === "string" ? categoryIcon : null,
          };
        }),
    [appLang, currency, ordersMap, reviewMap, tMarketplace, tenants]
  );

  const [activeSlug, setActiveSlug] = useState<string | undefined>(undefined);

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

  const radarRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = radarRef.current;
    if (!element) return;

    const measure = () => {
      const width = element.getBoundingClientRect().width || 0;
      setSize(clamp(Math.round(width - 24), 280, 720));
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  const showError = tenantsQ.isError && !data;
  const showPending = tenantsQ.isPending && !data;
  const showEmpty = !showPending && !showError && tenants.length === 0;
  // Startup hydration can deliver tenant data before the client has measured
  // the orbit shell, so keep a section skeleton visible until size is ready.
  const showViewportSkeleton =
    showPending || (!showError && !showEmpty && size === null);
  const showContent = !showError && !showEmpty && size !== null;

  return (
    <>
      <div
        className="flex w-full min-w-0 justify-center lg:justify-start pr-6"
      >
        <div
          ref={radarRef}
          className={cn(
            orbitShellClassName,
            isRefreshing && "opacity-80 transition-opacity"
          )}
        >
          {isRefreshing && showContent && tenants.length > 0 && (
            <div className="absolute right-2 top-2 z-10 rounded-full bg-background/85 p-1 shadow-sm">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {showViewportSkeleton ? (
            <OrbitViewportSkeleton />
          ) : showError ? (
            <div className="flex h-full w-full items-center justify-center rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground">
              <div>
                {tMarketplace("error.home_radar_body")}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => tenantsQ.refetch()}
                    className="rounded-md border px-3 py-1 text-xs"
                  >
                    {tMarketplace("error.retry")}
                  </button>
                </div>
              </div>
            </div>
          ) : showEmpty ? (
            <div className="flex h-full w-full items-center justify-center rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground">
              {tMarketplace("list.empty_body")}
            </div>
          ) : showContent ? (
            <TenantOrbit
              size={size}
              maxDistanceKm={80}
              baseSeconds={16}
              parallax={18}
              tenants={tenants}
              // Homepage is a discovery surface, so keep the visible result set
              // spread across the radar after any local filter reduces results.
              radiusMode="relative_spread"
              selectedSlug={activeSlug}
              onSelect={onOrbitSelect}
              {...(viewer ? { viewer } : {})}
              appLang={appLang}
            />
          ) : (
            <div className="h-full w-full" />
          )}
        </div>
      </div>

      <div
        className={cn(
          "w-full lg:h-full flex justify-end transition-opacity",
          isRefreshing && showContent && "opacity-80"
        )}
        aria-hidden={showError || showEmpty}
      >
        {showViewportSkeleton ? (
          // Keep the billboard occupied during startup so refreshed pages do
          // not flash a blank right column before orbit sizing finishes.
          <CarouselViewportSkeleton />
        ) : showContent ? (
          <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center lg:px-12">
            <TenantsCarousel
              items={items}
              activeSlug={activeSlug}
              onActiveChange={onCarouselChange}
            />
          </div>
        ) : (
          <div className="w-full lg:w-[min(32vw,600px)] h-full" />
        )}
      </div>
    </>
  );
}
