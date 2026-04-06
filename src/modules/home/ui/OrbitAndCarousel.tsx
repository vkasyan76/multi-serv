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
import type { TenantWithRelations } from "@/modules/tenants/types";
import {
  formatMonthYearForLocale,
  type AppLang,
  formatCurrency,
  getLocaleAndCurrency,
} from "@/modules/profile/location-utils";
import TenantOrbit from "@/modules/tenants/ui/components/visuals/TenantOrbit";
import TenantsCarousel from "@/modules/tenants/ui/components/visuals/TenantsCarousel";
import { HomeRadarSkeleton } from "./HomeRadarSkeleton";
import { Category } from "@/payload-types";
import { cn } from "@/lib/utils";

type Viewer = { lat: number; lng: number; city?: string | null } | undefined;
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
            blurb: toPlain(tenant.bio) || "Professional services.",
            categoryName: primaryCategory?.name,
            categoryColor:
              typeof primaryCategory?.color === "string"
                ? primaryCategory.color
                : undefined,
            categoryIcon:
              typeof categoryIcon === "string" ? categoryIcon : null,
          };
        }),
    [appLang, currency, ordersMap, reviewMap, tenants]
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

  if (tenantsQ.isPending && !data) {
    return <HomeRadarSkeleton />;
  }

  if (tenantsQ.isError && !data) {
    return (
      <>
        <div className="flex w-full min-w-0 justify-center lg:justify-start pr-6 min-h-[280px]">
          <div className="rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground">
            {tMarketplace("error.home_radar_body")}
            <div className="mt-3">
              <button
                onClick={() => tenantsQ.refetch()}
                className="rounded-md border px-3 py-1 text-xs"
              >
                {tMarketplace("error.retry")}
              </button>
            </div>
          </div>
        </div>
        <div className="w-full lg:h-full flex justify-end lg:px-12" />
      </>
    );
  }

  if (tenants.length === 0) {
    return null;
  }

  return (
    <>
      <div
        ref={radarRef}
        className={cn(
          "relative flex w-full min-w-0 justify-center lg:justify-start pr-6 min-h-[280px]",
          isRefreshing && "opacity-80 transition-opacity"
        )}
      >
        {isRefreshing && (
          <div className="absolute right-2 top-2 z-10 rounded-full bg-background/85 p-1 shadow-sm">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {size !== null && (
          <TenantOrbit
            size={size}
            maxDistanceKm={80}
            baseSeconds={16}
            parallax={18}
            tenants={tenants}
            selectedSlug={activeSlug}
            onSelect={onOrbitSelect}
            {...(viewer ? { viewer } : {})}
            appLang={appLang}
          />
        )}
      </div>

      <div
        className={cn(
          "w-full lg:h-full flex justify-end transition-opacity",
          isRefreshing && "opacity-80"
        )}
        style={{ visibility: size !== null ? "visible" : "hidden" }}
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
