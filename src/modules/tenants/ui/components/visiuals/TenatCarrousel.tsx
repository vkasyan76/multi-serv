"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import TenantBillboard from "./TenantBillboard";
import Link from "next/link";
import { generateTenantUrl } from "@/lib/utils";

// ✅ items is optional; fallback to demo data
type Item = {
  id: string;
  name: string;
  slug: string;
  city: string;
  country?: string;
  imageSrc: string;
  pricePerHour: number;
  rating: number;
  ratingCount: number;
  since: string;
  orders: number;
  blurb: string;
};

export default function TenantsCarousel({ items }: { items: Item[] }) {
  return (
    <Carousel opts={{ align: "center", loop: true }} className="w-full">
      {/* No negative margin/gutters; we want a single, full-width slide */}
      {/* small inner padding prevents clipping of rounded corners */}
      {/* show a tiny, symmetric peek of prev/next; keep corners un-clipped. */}
      <CarouselContent className="!ml-0">
        {items.map((t) => (
          <CarouselItem key={t.id} className="basis-auto lg:basis-full px-2">
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
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
