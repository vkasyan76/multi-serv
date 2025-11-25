"use client";

import Image from "next/image";
import { Star, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatIntegerForLocale } from "@/modules/profile/location-utils";

// handle broken <Image>, show fallback tile
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const img = e.currentTarget;
  img.style.display = "none";
  const fallback = img.nextElementSibling as HTMLElement | null;
  if (fallback) fallback.style.display = "flex";
};

type Props = {
  className?: string;
  imageSrc?: string;
  name?: string;
  city?: string;
  country?: string;
  pricePerHourLabel?: string;
  rating?: number;
  ratingCount?: number;
  since?: string;
  orders?: number;
  blurb?: string;
  categoryName?: string;
  categoryColor?: string;
};

export default function TenantBillboard({
  className,
  imageSrc,
  name = "Valentyn Kasyan",
  city = "Frankfurt am Main",
  country = "DE",
  pricePerHourLabel = "€1.00/h",
  rating = 0,
  ratingCount = 0,
  since = "Oct 2025",
  orders = 0,
  blurb = "Friendly professional. On-site & online.",
  categoryName,
  categoryColor,
}: Props) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "—"; // user initals fallback if image fails

  const hasOrders = typeof orders === "number" && orders > 0;

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
        <div className="relative w-full aspect-[4/3] lg:aspect-square overflow-hidden">
          {imageSrc ? (
            <>
              <Image
                src={imageSrc}
                alt={name}
                fill
                sizes="(min-width:1024px) 34vw, 100vw"
                className="object-cover [object-position:center_18%]"
                onError={handleImageError}
              />
              {/* hidden fallback shown if image errors */}
              <div
                className="absolute inset-0 hidden items-center justify-center bg-blue-100"
                aria-hidden
              >
                <span className="text-blue-600 font-semibold text-4xl">
                  {initial}
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-4xl">
                {initial}
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* rating top-left */}
          {/* {ratingCount > 0 ? (
            <Badge className="absolute top-3 left-3 bg-black/70 text-white hover:bg-black/70 backdrop-blur px-2.5 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                {rating.toFixed(1)}{" "}
                <span className="opacity-80">({ratingCount})</span>
              </span>
            </Badge>
          ) : (
            <Badge className="absolute top-3 left-3 bg-green-600 text-white hover:bg-green-600 backdrop-blur px-2.5 py-1.5 text-xs">
              New
            </Badge>
          )} */}

          {/* Category badge – top-left, using orbit category color */}
          {categoryName && (
            <div
              className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm"
              style={
                categoryColor ? { backgroundColor: categoryColor } : undefined
              }
            >
              {categoryName}
            </div>
          )}

          {/* Rating badge – top-right, same shape as TenantCard */}
          {ratingCount != null &&
          ratingCount > 0 &&
          typeof rating === "number" ? (
            <div className="absolute top-3 right-3 rounded-full bg-black/70 backdrop-blur px-2 py-1 text-white text-xs flex items-center gap-1">
              <Star
                aria-hidden
                className="h-3 w-3 text-yellow-400 fill-yellow-400"
              />
              <span className="sr-only">Rating</span>
              <span>{rating.toFixed(1)}</span>
              <span className="opacity-80">({ratingCount})</span>
            </div>
          ) : (
            <div className="absolute top-3 right-3 rounded-full bg-green-600 backdrop-blur px-2 py-1 text-white text-xs">
              New
            </div>
          )}

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
                {pricePerHourLabel}
              </div>
              {/* <div className="text-sm text-gray-600 truncate">{blurb}</div> */}
              {/* description */}
              {blurb && (
                <p
                  className="text-sm text-muted-foreground line-clamp-1"
                  title={blurb}
                >
                  {blurb}
                </p>
              )}
            </div>
            <div className="text-right">
              {hasOrders && (
                <div className="text-sm text-gray-700 font-medium">
                  {formatIntegerForLocale(orders ?? 0)}{" "}
                  {(orders ?? 0) === 1 ? "order" : "orders"}
                </div>
              )}

              <div className="text-xs text-gray-500">Since: {since}</div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
