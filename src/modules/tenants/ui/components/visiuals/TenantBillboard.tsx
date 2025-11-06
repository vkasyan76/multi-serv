"use client";

import Image from "next/image";
import { Star, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  imageSrc?: string;
  name?: string;
  city?: string;
  country?: string;
  pricePerHour?: number;
  rating?: number;
  ratingCount?: number;
  since?: string;
  orders?: number;
  blurb?: string;
};

export default function TenantBillboard({
  className,
  imageSrc = "/images/billboard/Plumber.png",
  name = "Valentyn Kasyan",
  city = "Frankfurt am Main",
  country = "DE",
  pricePerHour = 1,
  rating = 5.0,
  ratingCount = 626,
  since = "Oct 2025",
  orders = 12,
  blurb = "Friendly professional. On-site & online.",
}: Props) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl",
        "transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-xl",
        className
      )}
    >
      <div className="flex flex-col">
        {/* image block with fixed aspect ratio */}
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          <Image
            src={imageSrc}
            alt={name}
            fill
            sizes="(min-width:1024px) 34vw, 100vw"
            className="object-cover [object-position:center_18%]" // 🔹 keep heads in frame on portrait
            priority
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* rating top-left */}
          <Badge className="absolute top-3 left-3 bg-black/70 text-white hover:bg-black/70 backdrop-blur px-2.5 py-1.5 text-xs">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              {rating.toFixed(1)}{" "}
              <span className="opacity-80">({ratingCount})</span>
            </span>
          </Badge>

          {/* name + location bottom-left */}
          <div className="absolute left-4 bottom-4 text-white drop-shadow">
            <div className="text-2xl font-bold leading-6">{name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm opacity-95">
              <MapPin className="h-4 w-4" />
              <span>
                {city}
                {country ? `, ${country}` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* bottom strip */}
        <CardContent className="px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-blue-700 font-bold text-xl">
                €{pricePerHour}/h
              </div>
              <div className="text-sm text-gray-600 truncate">{blurb}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-700 font-medium">
                {orders} orders
              </div>
              <div className="text-xs text-gray-500">Since: {since}</div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
