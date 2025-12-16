"use client";

import {
  MapPin,
  Monitor,
  MapPinOff,
  Star,
  BadgeCheck,
  // Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import type { TenantWithRelations } from "../../types";
import { AuthTooltip } from "@/modules/tenants/ui/components/auth-tooltip";
import {
  formatMonthYearForLocale,
  formatNumberForLocale,
  formatIntegerForLocale,
  formatOneDecimalForLocale,
  type AppLang,
  getInitialLanguage,
  formatCurrency,
} from "@/modules/profile/location-utils";
import { cn, platformHomeHref } from "@/lib/utils";
import Link from "next/link";

// Helper function to handle image errors
const handleImageError = (
  event: React.SyntheticEvent<HTMLImageElement, Event>
) => {
  // Hide the broken image and show fallback
  const img = event.currentTarget;
  img.style.display = "none";
  const fallback = img.nextElementSibling as HTMLElement;
  if (fallback) {
    fallback.style.display = "flex";
  }
};

interface TenantCardProps {
  tenant: TenantWithRelations;
  reviewRating?: number | null; // <– now clearly optional
  reviewCount?: number | null; // <– now clearly optional
  isSignedIn: boolean | null; // ← was boolean accepts null
  variant?: "list" | "detail"; // NEW: layout control
  showActions?: boolean; // NEW: button rendering control
  onBook?: () => void; // NEW: optional handler
  onContact?: () => void; // NEW: optional handler
  ordersCount?: number; // NEW: optional orders count
  appLang?: AppLang;
  isOwner?: boolean; // to check if the user sees his own tenant card
}

export const TenantCard = ({
  tenant,
  reviewRating,
  reviewCount,
  isSignedIn,
  variant = "list",
  showActions = false,
  onBook,
  onContact,
  ordersCount, // NEW
  appLang,
  isOwner = false,
}: TenantCardProps) => {
  const effectiveLang: AppLang = appLang ?? getInitialLanguage();

  const homeHref = platformHomeHref();
  // redirect the tenant to his pages
  const toPlatform = (path: string) => {
    if (homeHref === "/") return path;
    const base = homeHref.endsWith("/") ? homeHref.slice(0, -1) : homeHref;
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  };

  const dashboardHref = toPlatform(`/tenants/${tenant.slug}/dashboard`);
  const profileHref = toPlatform(`/profile?tab=vendor`);

  // Edge case variables for cleaner logic
  const hasServices = !!tenant.services?.length;
  const showDistanceRow = hasServices || isSignedIn || tenant.distance != null; // we still render a left block (unavailable / tooltip) for balance
  // const isList = variant === "list";

  // Responsive width logic with group hover
  const wrapperClass = cn(
    "border rounded-lg bg-white hover:shadow-lg transition-all duration-200 hover:border-blue-200 overflow-hidden group",
    variant === "list"
      ? "w-[280px] max-w-[320px] flex-shrink-0"
      : "w-full lg:w-[320px] lg:max-w-[320px] lg:flex-shrink-0"
  );

  // order count logic
  const hasOrders = typeof ordersCount === "number" && ordersCount > 0;

  return (
    <div className={wrapperClass}>
      {/* Image Section with aspect ratio instead of fixed height */}
      <div
        className={cn(
          "relative overflow-hidden rounded-t-lg",
          variant === "list" ? "aspect-[16/9]" : "aspect-[4/3]"
        )}
      >
        {tenant.image?.url || tenant.user?.clerkImageUrl ? (
          <Image
            src={(tenant.image?.url || tenant.user?.clerkImageUrl) ?? ""}
            alt={tenant.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes={
              variant === "list" ? "(min-width:1024px) 320px, 90vw" : "320px"
            }
            onError={handleImageError}
            // Remove unoptimized in production
          />
        ) : (
          <div className="w-full h-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 font-semibold text-2xl">
              {tenant.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Subtle gradient for overlay readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

        {/* Enhanced Rating Overlay with accessibility */}
        {reviewCount != null &&
        reviewCount > 0 &&
        typeof reviewRating === "number" ? (
          <div className="absolute top-2 right-2 rounded-full bg-black/70 backdrop-blur px-2 py-1 text-white text-xs flex items-center gap-1">
            <Star
              aria-hidden
              className="h-3 w-3 text-yellow-400 fill-yellow-400"
            />
            <span className="sr-only">Rating</span>
            <span suppressHydrationWarning>
              {formatNumberForLocale(
                reviewRating,
                {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                },
                effectiveLang
              )}
            </span>
            <span className="opacity-80">({reviewCount})</span>
          </div>
        ) : (
          <div className="absolute top-2 right-2 rounded-full bg-green-600  backdrop-blur px-2 py-1 text-white text-xs">
            New
          </div>
        )}
      </div>

      {/* Information Section (70% height) */}
      <div className="p-4 space-y-2">
        {/* Name Row with truncation */}
        <div className="flex justify-between items-center gap-2">
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-1 truncate">
            {tenant.name}
          </Badge>
          <Badge
            variant="outline"
            className="text-gray-700 text-sm font-medium px-3 py-1 border-gray-300 truncate"
          >
            {tenant.firstName} {tenant.lastName}
          </Badge>
        </div>

        {/* City + Price (single row) */}
        {(tenant.user?.coordinates?.city || tenant.hourlyRate != null) && (
          <div
            className={cn(
              "flex items-baseline",
              tenant.user?.coordinates?.city ? "justify-between" : "justify-end"
            )}
          >
            {/* City (left) */}
            {tenant.user?.coordinates?.city && (
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="truncate text-gray-700">
                  {tenant.user.coordinates.city}
                  {tenant.user.coordinates.countryISO &&
                    `, ${tenant.user.coordinates.countryISO}`}
                </span>
              </div>
            )}

            {/* Price (right) */}
            {tenant.hourlyRate != null && (
              <span
                className={cn(
                  "font-bold text-blue-600 whitespace-nowrap",
                  variant === "list" ? "text-xl" : "text-2xl"
                )}
                suppressHydrationWarning
              >
                {formatCurrency(tenant.hourlyRate, "EUR", effectiveLang)} /h
              </span>
            )}
          </div>
        )}

        {/* Distance + Services (single row) */}
        {showDistanceRow && (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 min-h-[28px]">
            {/* Left: Distance / hint / unavailable  — stable tree to avoid hydration error */}
            <div
              className="inline-flex items-center gap-1 text-sm min-w-0"
              suppressHydrationWarning
            >
              {/* Icons stay mounted; just toggle visibility */}
              <MapPin
                aria-hidden
                suppressHydrationWarning
                className={cn(
                  "h-4 w-4 shrink-0",
                  tenant.distance != null ? "text-blue-600 inline" : "hidden"
                )}
              />
              <MapPinOff
                aria-hidden
                suppressHydrationWarning
                className={cn(
                  "h-4 w-4 shrink-0",
                  tenant.distance == null && isSignedIn === true
                    ? "text-gray-400 inline"
                    : "hidden"
                )}
              />

              {/* Content */}
              {tenant.distance != null ? (
                <span className="tabular-nums" suppressHydrationWarning>
                  {`${formatOneDecimalForLocale(tenant.distance, effectiveLang)} km`}
                </span>
              ) : isSignedIn === null ? (
                // auth unknown → neutral placeholder (prevents the “Log in…” flash)
                <span
                  aria-busy="true"
                  className="inline-block h-4 w-24 rounded bg-gray-200/60 animate-pulse"
                />
              ) : isSignedIn === true ? (
                <span className="truncate max-w-[10ch] text-gray-500">
                  Unavailable
                </span>
              ) : (
                // signed out (known) → show tooltip
                <AuthTooltip isSignedIn={false}>
                  <span
                    className={cn(
                      "truncate",
                      variant === "list"
                        ? "text-[11px] leading-4 text-gray-400"
                        : "text-sm text-gray-400"
                    )}
                  >
                    Log in for distance
                  </span>
                </AuthTooltip>
              )}
            </div>

            {/* Right: Service badges */}
            {hasServices && (
              <div
                className={cn(
                  "ml-auto flex flex-wrap",
                  variant === "list" ? "gap-1" : "gap-2"
                )}
              >
                {tenant.services!.map((service) => (
                  <span
                    key={service}
                    className={`px-2 py-1 font-medium rounded-full inline-flex items-center gap-1 ${
                      service === "on-site"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    } ${variant === "list" ? "text-[10px]" : "text-xs"}`}
                  >
                    {service === "on-site" ? (
                      <>
                        <MapPin className="h-3 w-3" />
                        On-site
                      </>
                    ) : (
                      <>
                        <Monitor className="h-3 w-3" />
                        On-line
                      </>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders fulfilled + Active since (one row) */}
        {(typeof ordersCount === "number" || tenant.createdAt) && (
          <div className="flex items-center justify-between text-sm text-gray-500 pt-2">
            {/* Left: fulfilled orders – only show when > 0 */}
            {hasOrders && (
              <div className="flex items-center gap-1">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                <span suppressHydrationWarning>
                  {formatIntegerForLocale(ordersCount ?? 0, effectiveLang)}{" "}
                  {(ordersCount ?? 0) === 1 ? "order" : "orders"}
                </span>
              </div>
            )}

            {/* Right: Active since (Month + Year) */}
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Since:</span>
              <span suppressHydrationWarning>
                {formatMonthYearForLocale(
                  tenant.createdAt,
                  "short",
                  effectiveLang
                )}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons (only when showActions is true) */}
        {showActions && (
          <div className="grid grid-cols-1 gap-2 pt-2">
            {isOwner ? (
              <>
                <Button size="lg" className="w-full" asChild>
                  <Link href={dashboardHref} prefetch={false}>
                    Your dashboard
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="w-full" asChild>
                  <Link href={profileHref} prefetch={false}>
                    Profile
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="w-full"
                  aria-label="Book service"
                  onClick={onBook}
                >
                  Book service
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  aria-label="Contact provider"
                  onClick={onContact ?? (() => console.log("TODO: Contact"))}
                >
                  Contact
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
