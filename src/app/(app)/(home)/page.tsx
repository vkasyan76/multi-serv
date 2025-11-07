"use client";

import { useLayoutEffect, useRef, useState } from "react";
import TenantOrbit from "@/modules/tenants/ui/components/visiuals/TenantOrbit";
import LoadingPage from "@/components/shared/loading";
import TenantsCarousel from "@/modules/tenants/ui/components/visiuals/TenantsCarousel";

import type { TenantWithRelations } from "@/modules/tenants/types";
import { formatMonthYearForLocale } from "@/modules/profile/location-utils";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

// const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"] });

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function Home() {
  const trpc = useTRPC();
  const radarRef = useRef<HTMLDivElement | null>(null);
  // const [size, setSize] = useState(320);
  const [size, setSize] = useState<number | null>(null); // no wrong first paint

  // 🔹 Single fetch for both Orbit & Carousel
  const { data, isLoading } = useQuery({
    ...trpc.tenants.getMany.queryOptions({
      sort: "distance",
      limit: 24,
      distanceFilterEnabled: false,
      userLat: null, // (no filters yet; orbit will still render)
      userLng: null,
    }),
    refetchOnWindowFocus: false,
  });

  // fetching the user location for viewer coordinates:
  const { data: session } = useQuery(trpc.auth.session.queryOptions());
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

  // measure radar box
  useLayoutEffect(() => {
    const el = radarRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width || 0;
      setSize(clamp(Math.round(w - 24), 280, 720));
    };

    measure(); // ← critical: set size once on mount (hard refresh case)
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading]);

  // [isLoading] dependency is a workaround so the effect runs again after loading flips to false, because while isLoading is true you early-return <LoadingPage />

  const tenants = (data?.docs ?? []) as TenantWithRelations[];

  // map to carousel items (placeholders for rating/orders for now)
  const items = tenants.map((t) => ({
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
  }));

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 pt-6 pb-4 min-h-[60vh] flex items-center justify-center">
        <LoadingPage />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-4 overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[5fr_2fr] gap-6 items-center">
        {/* Orbit (left) now receives data */}
        <div
          ref={radarRef}
          className="flex w-full min-w-0 justify-center min-h-[280px]"
        >
          {size !== null && (
            <TenantOrbit
              key={size as number} // helps GSAP/rings re-init on first real measure
              size={size}
              maxDistanceKm={80}
              baseSeconds={16}
              parallax={18}
              tenants={tenants}
              viewer={viewer}
            />
          )}
        </div>

        {/* Carousel (right) gets same data */}
        <div className="w-full lg:h-full flex justify-end">
          {/* Make the carousel container exactly the card width */}
          {/* <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center"> */}
          <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center lg:px-12">
            <TenantsCarousel
              items={items} // drop slug & silence lint
            />
          </div>
        </div>
      </div>
    </div>
  );
}
