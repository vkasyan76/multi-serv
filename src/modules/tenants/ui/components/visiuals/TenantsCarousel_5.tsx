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
  const safeItems = useMemo(
    () => items.filter((i) => i && i.id && i.slug),
    [items]
  );

  const hasMultiple = safeItems.length > 1;

  const carouselKey = useMemo(
    () => safeItems.map((s) => s.id).join("|"),
    [safeItems]
  );
  const slugToIndex = useMemo(() => {
    const m = new Map<string, number>();
    safeItems.forEach((it, i) => m.set(it.slug, i));
    return m;
  }, [safeItems]);

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
      const slug = safeItems[i]?.slug;
      if (slug) onActiveChange(slug);
    };
    api.on("select", handler);
    return () => {
      api.off("select", handler);
    };
  }, [api, onActiveChange, safeItems]);

  return (
    <Carousel
      key={carouselKey}
      setApi={setApi}
      opts={{
        align: hasMultiple ? "start" : "center", // <-- was "center"
        containScroll: "trimSnaps",
        loop: safeItems.length > 2,
      }}
      className="w-full"
    >
      {/* No negative margin/gutters; we want a single, full-width slide */}
      {/* small inner padding prevents clipping of rounded corners */}
      {/* show a tiny, symmetric peek of prev/next; keep corners un-clipped. */}
      <CarouselContent>
        {safeItems.map((t) => (
          <CarouselItem key={t.id} className="basis-full">
            <Link href={generateTenantUrl(t.slug)} className="block group">
              <TenantBillboard
                // className="w-full transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-xl"
                className="!w-full !max-w-none !mx-0"
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
