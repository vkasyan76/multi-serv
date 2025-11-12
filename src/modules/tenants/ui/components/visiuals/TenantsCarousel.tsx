"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import TenantBillboard from "./TenantBillboard";
import Link from "next/link";
import { generateTenantUrl } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

// ✅ items is optional; fallback to demo data
type Item = {
  id: string;
  name: string;
  slug: string;
  city: string;
  country?: string;
  imageSrc?: string;
  pricePerHour: number;
  rating: number;
  ratingCount: number;
  since: string;
  orders: number;
  blurb: string;
};

export default function TenantsCarousel({
  items,
  activeSlug,
  onActiveChange,
}: {
  items: Item[];
  activeSlug?: string;
  onActiveChange?: (slug: string) => void;
}) {
  const [api, setApi] = useState<CarouselApi | undefined>(undefined);
  const slugToIndex = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it, i) => m.set(it.slug, i));
    return m;
  }, [items]);

  // External → Carousel
  useEffect(() => {
    if (!api || !activeSlug) return;
    const idx = slugToIndex.get(activeSlug);
    if (idx != null) api.scrollTo(idx, true);
  }, [api, activeSlug, slugToIndex]);

  // Carousel → External
  useEffect(() => {
    if (!api || !onActiveChange) return;
    const handler = () => {
      const i = api.selectedScrollSnap();
      const slug = items[i]?.slug;
      if (slug) onActiveChange(slug);
    };
    api.on("select", handler);
    return () => {
      api.off("select", handler);
    };
  }, [api, onActiveChange, items]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: "center", loop: true }}
      className="w-full"
    >
      {/* No negative margin/gutters; we want a single, full-width slide */}
      {/* small inner padding prevents clipping of rounded corners */}
      {/* show a tiny, symmetric peek of prev/next; keep corners un-clipped. */}
      <CarouselContent className="!ml-0">
        {items.map((t) => (
          <CarouselItem key={t.id} className="basis-auto lg:basis-full px-2">
            <Link href={generateTenantUrl(t.slug)} className="block group">
              <TenantBillboard
                className="w-full" // hover classes (they’re already inside TenantBillboard
                imageSrc={t.imageSrc}
                name={t.name}
                city={t.city}
                country={t.country}
                pricePerHour={t.pricePerHour}
                rating={t.rating}
                ratingCount={t.ratingCount}
                since={t.since}
                orders={t.orders}
                blurb={t.blurb}
              />
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

// Billboard-style skeleton for Suspense fallback
export function TenantsCarouselSkeleton() {
  return (
    <div className="w-full">
      <div className="aspect-[4/3] lg:aspect-square rounded-2xl bg-muted/30 animate-pulse" />
      <div className="mt-3 space-y-2">
        <div className="h-5 w-40 rounded bg-muted/30 animate-pulse" />
        <div className="h-4 w-28 rounded bg-muted/30 animate-pulse" />
        <div className="h-4 w-24 rounded bg-muted/30 animate-pulse" />
      </div>
    </div>
  );
}
