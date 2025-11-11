"use client";

import { useLayoutEffect, useRef, useState, useEffect, useMemo } from "react";
import TenantOrbit from "@/modules/tenants/ui/components/visiuals/TenantOrbit";
import LoadingPage from "@/components/shared/loading";
import TenantsCarousel from "@/modules/tenants/ui/components/visiuals/TenantsCarousel";

import type { TenantWithRelations } from "@/modules/tenants/types";
import { formatMonthYearForLocale } from "@/modules/profile/location-utils";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Headline from "@/modules/home/ui/billboard/headline";
import CallToAction from "@/modules/home/ui/cta/call-to-action";

import { Poppins } from "next/font/google";

// const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"] });
const poppins = Poppins({ subsets: ["latin"], weight: ["600"] }); // sans
// const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] }); // serif (visibly different)

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function Home() {
  const trpc = useTRPC();
  const radarRef = useRef<HTMLDivElement | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null); // sync orbit <> carousel
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

  // fetching the user location for viewer coordinates || loading state for call to action:
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

  // Stabilize tenants and guard the first slug.
  const tenants = useMemo(
    () => (data?.docs ?? []) as TenantWithRelations[],
    [data?.docs]
  );
  const firstSlug = tenants[0]?.slug;

  // Initialize active slide once data arrives
  useEffect(() => {
    if (!activeSlug && firstSlug) setActiveSlug(firstSlug);
  }, [activeSlug, firstSlug]);

  const handleOrbitSelect = (slug: string) => setActiveSlug(slug);
  const handleCarouselChange = (slug: string) => setActiveSlug(slug);

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

  // Call to action constants
  const isAuthed = !!session?.user;
  const isOnboarded = profileQ.data?.onboardingCompleted === true;
  const hasTenant = !!session?.user?.tenants?.length;
  const ctaLoading = sessionLoading || profileQ.isLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 pt-6 pb-4 min-h-[60vh] flex items-center justify-center">
        <LoadingPage />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-4 overflow-x-hidden">
      <Headline
        // optional overrides:
        // line1="We connect clients with professionals."
        // line2="Your solution is only a click away."
        // hideOnMobile={true}
        className="md:max-w-6xl lg:max-w-7xl" // give the heading more room on desktop
        line1FontClass={poppins.className} // first line = Playfair
        line2FontClass={poppins.className} // second line = Poppins
      />
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
              selectedSlug={activeSlug ?? undefined}
              onSelect={handleOrbitSelect}
            />
          )}
        </div>

        {/* Carousel (right) gets same data */}
        <div className="w-full lg:h-full flex justify-end">
          {/* Make the carousel container exactly the card width */}
          {/* <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center"> */}
          <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center lg:px-12">
            <TenantsCarousel
              items={items}
              activeSlug={activeSlug ?? undefined}
              onActiveChange={handleCarouselChange}
            />
          </div>
        </div>
      </div>
      {/* 👇 sentinel that marks “below the orbit” */}
      <div id="cta-sentinel" className="h-px w-full" aria-hidden="true" />
      <CallToAction
        key={`${isAuthed}-${isOnboarded}-${hasTenant}`}
        isAuthed={isAuthed}
        isOnboarded={isOnboarded}
        hasTenant={hasTenant}
        loading={ctaLoading}
        sentinelId="cta-sentinel" // ← observe this marker
      />
    </div>
  );
}
