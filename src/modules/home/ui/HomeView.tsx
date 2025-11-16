"use client";

import { Suspense, useMemo } from "react";
import type { FallbackProps } from "react-error-boundary";
import { useQuery } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { useTRPC } from "@/trpc/client";

import Headline from "@/modules/home/ui/billboard/headline";
import CallToAction from "@/modules/home/ui/cta/call-to-action";
import { TenantFilters } from "@/modules/tenants/ui/components/tenant-filters";
import { useTenantFilters } from "@/modules/tenants/hooks/use-tenant-filters";

import { Poppins } from "next/font/google";
import { HomeRadarSkeleton } from "@/modules/home/ui/HomeRadarSkeleton";
import { OrbitAndCarousel } from "./OrbitAndCarousel";

const poppins = Poppins({ subsets: ["latin"], weight: ["600"] });

function RadarError({ resetErrorBoundary }: FallbackProps) {
  return (
    <>
      <div className="flex w-full min-w-0 justify-center lg:justify-start pr-6 min-h-[280px]">
        <div className="rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground">
          Couldn&apos;t load providers. Please adjust filters or retry.
          <div className="mt-3">
            <button
              onClick={resetErrorBoundary}
              className="px-3 py-1 rounded-md border text-xs"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
      <div className="w-full lg:h-full flex justify-end lg:px-12" />
    </>
  );
}

export default function HomeView() {
  const trpc = useTRPC();

  // Auth + profile (do NOT block Suspense)
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

  const [filters] = useTenantFilters();

  // Distance mode needs viewer coords; otherwise first mount would re-suspend when viewer arrives.

  const queryInput = useMemo(
    () => ({
      ...filters,
      ...(session?.user
        ? {}
        : {
            distanceFilterEnabled: false,
            maxDistance: null as number | null,
          }),
      userLat: viewer?.lat ?? null,
      userLng: viewer?.lng ?? null,
      limit: 24,
    }),
    [filters, session?.user, viewer?.lat, viewer?.lng]
  );

  const isAuthed = !!session?.user;
  const isOnboarded = profileQ.data?.onboardingCompleted === true;
  const hasTenant = !!session?.user?.tenants?.length;
  const ctaLoading = sessionLoading || profileQ.isLoading;

  return (
    <div className="container mx-auto px-4 pt-6 pb-4 overflow-x-hidden">
      <Headline
        className="md:max-w-6xl lg:max-w-7xl"
        line1FontClass={poppins.className}
        line2FontClass={poppins.className}
      />

      {/* 3-column row: Filters | Orbit | Carousel */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[250px_1fr_minmax(360px,520px)] gap-10 items-start">
        {/* Filters stay mounted; we don't touch their internals */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-4">
            <TenantFilters isSignedIn={!!session?.user} />
          </div>
        </aside>

        {/* Orbit + Carousel are suspended together with a combined skeleton */}
        <Suspense fallback={<HomeRadarSkeleton />}>
          <ErrorBoundary FallbackComponent={RadarError}>
            <OrbitAndCarousel queryInput={queryInput} viewer={viewer} />
          </ErrorBoundary>
        </Suspense>
      </div>

      {/* CTA sentinel */}
      <div id="cta-sentinel" className="h-px w-full" aria-hidden="true" />
      <CallToAction
        isAuthed={isAuthed}
        isOnboarded={isOnboarded}
        hasTenant={hasTenant}
        loading={ctaLoading}
        sentinelId="cta-sentinel"
      />
    </div>
  );
}
