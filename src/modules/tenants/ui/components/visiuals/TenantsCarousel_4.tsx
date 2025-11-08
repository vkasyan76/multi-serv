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
  // to avoid showing empty slides if itemes run out
  const safeItems = useMemo(
    () => items.filter((i) => i && i.id && i.slug),
    [items]
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
      const base = safeItems.length ? i % safeItems.length : 0;
      const slug = safeItems[base]?.slug;
      if (slug) onActiveChange(slug);
    };
    api.on("select", handler);
    return () => {
      api.off("select", handler);
    };
  }, [api, onActiveChange, safeItems]);

  return (
    <Carousel
      setApi={setApi}
      opts={{
        align: "center",
        containScroll: "trimSnaps",
        loop: safeItems.length > 1,
      }}
      className="w-full"
    >
      {/* No negative margin/gutters; we want a single, full-width slide */}
      {/* small inner padding prevents clipping of rounded corners */}
      {/* show a tiny, symmetric peek of prev/next; keep corners un-clipped. */}
      {/* <CarouselContent className="!ml-0"> */}
      <CarouselContent>
        {safeItems.map((t) => (
          // <CarouselItem key={t.id} className="basis-auto lg:basis-full px-2">
          <CarouselItem
            key={t.id}
            className="pr-4 basis-[calc(100%-2rem)] sm:basis-[calc(100%-1.5rem)] lg:basis-full"
          >
            {/* inner padding lives here so width stays deterministic */}

            <Link href={generateTenantUrl(t.slug)} className="block group">
              <TenantBillboard
                className="w-full transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-xl"
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
      {/* Hide arrows on mobile; hide entirely when only 1 slide */}
      <CarouselPrevious
        className={safeItems.length > 1 ? "hidden lg:inline-flex" : "hidden"}
      />
      <CarouselNext
        className={safeItems.length > 1 ? "hidden lg:inline-flex" : "hidden"}
      />
    </Carousel>
  );
}
