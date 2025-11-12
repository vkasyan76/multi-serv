"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type {
  TenantsGetManyInput,
  TenantWithRelations,
} from "@/modules/tenants/types";
import { formatMonthYearForLocale } from "@/modules/profile/location-utils";

import TenantOrbit from "@/modules/tenants/ui/components/visiuals/TenantOrbit";
import TenantsCarousel from "@/modules/tenants/ui/components/visiuals/TenantsCarousel";

type Viewer = { lat: number; lng: number; city?: string | null } | undefined;

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function OrbitAndCarousel({
  queryInput,
  viewer,
}: {
  queryInput: TenantsGetManyInput;
  viewer: Viewer;
}) {
  const trpc = useTRPC();

  // Suspense fetch; keep previous data on filter changes (no flicker)
  const { data } = useSuspenseQuery({
    ...trpc.tenants.getMany.queryOptions(queryInput),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const tenants = useMemo(
    () => (data?.docs ?? []) as TenantWithRelations[],
    [data?.docs]
  );

  // Map to carousel items
  const items = useMemo(
    () =>
      tenants.map((t) => ({
        id: t.id!,
        slug: t.slug,
        name: t.name,
        city: t.user?.coordinates?.city ?? "",
        country: t.user?.coordinates?.countryISO ?? undefined,
        imageSrc: t.image?.url ?? t.user?.clerkImageUrl ?? undefined,
        pricePerHour: typeof t.hourlyRate === "number" ? t.hourlyRate : 0,
        rating: 5.0,
        ratingCount: 0,
        since: t.createdAt ? formatMonthYearForLocale(t.createdAt) : "",
        orders: 0,
        blurb: "Professional services.",
      })),
    [tenants]
  );

  // Sync selection
  const [activeSlug, setActiveSlug] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!activeSlug && tenants[0]?.slug) setActiveSlug(tenants[0].slug);
  }, [activeSlug, tenants]);

  const onOrbitSelect = useCallback((slug: string) => setActiveSlug(slug), []);
  const onCarouselChange = useCallback(
    (slug: string) => setActiveSlug(slug),
    []
  );

  // Measure orbit size (mount + resize)
  const radarRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
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
            viewer={viewer}
            selectedSlug={activeSlug}
            onSelect={onOrbitSelect}
          />
        )}
      </div>

      {/* Carousel (right column) */}
      <div className="w-full lg:h-full flex justify-end">
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

