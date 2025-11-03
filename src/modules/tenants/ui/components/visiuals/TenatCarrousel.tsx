"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import TenantBillboard from "./TenantBillboard";

// ✅ items is optional; fallback to demo data
type Item = {
  id: string;
  name: string;
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

const FALLBACK_ITEMS: Item[] = [
  {
    id: "1",
    name: "Valentyn Kasyan",
    city: "Frankfurt am Main",
    country: "DE",
    imageSrc: "/images/billboard/Plumber.png",
    pricePerHour: 1,
    rating: 5.0,
    ratingCount: 626,
    since: "Oct 2025",
    orders: 12,
    blurb: "Friendly professional. On-site & online.",
  },
  {
    id: "2",
    name: "Super Tenant",
    city: "Hanau",
    country: "DE",
    imageSrc: "/images/billboard/Plumber.png",
    pricePerHour: 10,
    rating: 4.8,
    ratingCount: 143,
    since: "Sep 2025",
    orders: 22,
    blurb: "Fast response, fair pricing.",
  },
];

export default function TenantsCarousel({ items }: { items?: Item[] }) {
  const data = items ?? FALLBACK_ITEMS;

  return (
    <Carousel opts={{ align: "start", loop: true }} className="w-full">
      <CarouselContent className="-ml-4">
        {data.map((t) => (
          <CarouselItem key={t.id} className="pl-4 basis-full">
            <TenantBillboard
              className="w-full"
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
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
