"use client";

import Image from "next/image";
import { Star, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatOneDecimalForLocale } from "@/modules/profile/location-utils";
import { CategoryIcon } from "@/modules/categories/category-icons";
import { useLocale, useTranslations } from "next-intl";
import { normalizeToSupported } from "@/lib/i18n/app-lang";

// Handle broken <Image>, show the fallback tile instead.
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
  categoryIcon?: string | null;
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
  categoryIcon,
}: Props) {
  const tTenantPage = useTranslations("tenantPage");
  const appLang = normalizeToSupported(useLocale());
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "—";
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
        <div className="relative w-full aspect-[4/3] overflow-hidden lg:aspect-square">
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
              <div
                className="absolute inset-0 hidden items-center justify-center bg-blue-100"
                aria-hidden
              >
                <span className="text-4xl font-semibold text-blue-600">
                  {initial}
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-blue-100">
              <span className="text-4xl font-semibold text-blue-600">
                {initial}
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {categoryName && (
            <div
              className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm"
              style={
                categoryColor ? { backgroundColor: categoryColor } : undefined
              }
            >
              <CategoryIcon
                icon={categoryIcon ?? null}
                className="text-white"
                size={14}
              />
              <span>{categoryName}</span>
            </div>
          )}

          {ratingCount != null &&
          ratingCount > 0 &&
          typeof rating === "number" ? (
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs text-white backdrop-blur">
              <Star
                aria-hidden
                className="h-3 w-3 fill-yellow-400 text-yellow-400"
              />
              <span className="sr-only">{tTenantPage("card.rating_sr")}</span>
              <span>{formatOneDecimalForLocale(rating, appLang)}</span>
              <span className="opacity-80">({ratingCount})</span>
            </div>
          ) : (
            <div className="absolute right-3 top-3 rounded-full bg-green-600 px-2 py-1 text-xs text-white backdrop-blur">
              {tTenantPage("card.new")}
            </div>
          )}

          <div className="absolute bottom-4 left-4 text-white drop-shadow">
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

        <CardContent className="px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xl font-bold text-blue-700">
                {pricePerHourLabel}
              </div>
              {blurb && (
                <p
                  className="line-clamp-1 text-sm text-muted-foreground"
                  title={blurb}
                >
                  {blurb}
                </p>
              )}
            </div>
            <div className="text-right">
              {hasOrders && (
                <div className="text-sm font-medium text-gray-700">
                  {/* Reuse tenantPage card labels so billboard chrome stays aligned with tenant cards. */}
                  {tTenantPage("card.orders", { count: orders ?? 0 })}
                </div>
              )}

              <div className="text-xs text-gray-500">
                {tTenantPage("card.since")} {since}
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
