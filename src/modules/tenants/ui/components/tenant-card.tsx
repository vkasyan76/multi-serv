"use client";

import { MapPin, Monitor, MapPinOff, Star, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import type { TenantWithRelations } from "../../types";
import { AuthTooltip } from "@/modules/tenants/ui/components/auth-tooltip";
import { formatMonthYearForLocale, formatNumberForLocale, formatIntegerForLocale, formatOneDecimalForLocale } from "@/modules/profile/location-utils";
import { cn } from "@/lib/utils";

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
  reviewRating?: number;
  reviewCount?: number;
  isSignedIn: boolean;
  variant?: "list" | "detail";   // NEW: layout control
  showActions?: boolean;          // NEW: button rendering control
  onBook?: () => void;           // NEW: optional handler
  onContact?: () => void;        // NEW: optional handler
  ordersCount?: number; // NEW: optional orders count
}

export const TenantCard = ({
  tenant,
  reviewRating = 3,
  reviewCount = 5,
  isSignedIn,
  variant = "list",
  showActions = false,
  onBook,
  onContact,
  ordersCount, // NEW
}: TenantCardProps) => {

  // Edge case variables for cleaner logic
  const hasServices = !!tenant.services?.length;
  const canShowDistance = isSignedIn && tenant.distance != null;
  const showDistanceRow = hasServices || isSignedIn; // we still render a left block (unavailable / tooltip) for balance

  // Responsive width logic with group hover
  const wrapperClass = cn(
    "border rounded-lg bg-white hover:shadow-lg transition-all duration-200 hover:border-blue-200 overflow-hidden group",
    variant === "list"
      ? "w-[280px] max-w-[320px] flex-shrink-0"
      : "w-full lg:w-[320px] lg:max-w-[320px] lg:flex-shrink-0"
  );

  return (
    <div className={wrapperClass}>
      {/* Image Section with aspect ratio instead of fixed height */}
      <div className={cn(
        "relative overflow-hidden rounded-t-lg",
        variant === "list" ? "aspect-[16/9]" : "aspect-[4/3]"
      )}>
        {tenant.image?.url || tenant.user?.clerkImageUrl ? (
          <Image
            src={(tenant.image?.url || tenant.user?.clerkImageUrl) ?? ""}
            alt={tenant.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes={variant === "list" ? "(min-width:1024px) 320px, 90vw" : "320px"}
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
        {reviewCount > 0 ? (
          <div className="absolute top-2 right-2 rounded-full bg-black/70 backdrop-blur px-2 py-1 text-white text-xs flex items-center gap-1">
            <Star aria-hidden className="h-3 w-3 text-yellow-400 fill-yellow-400" />
            <span className="sr-only">Rating</span>
            <span suppressHydrationWarning>
              {formatNumberForLocale(reviewRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="opacity-80">({reviewCount})</span>
          </div>
        ) : (
          <div className="absolute top-2 right-2 rounded-full bg-black/70 backdrop-blur px-2 py-1 text-white text-xs">
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
          <Badge variant="outline" className="text-gray-700 text-sm font-medium px-3 py-1 border-gray-300 truncate">
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
                  {tenant.user.coordinates.countryISO && `, ${tenant.user.coordinates.countryISO}`}
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
                €{tenant.hourlyRate}/h
              </span>
            )}
          </div>
        )}

        {/* Distance + Services (single row) */}
        {showDistanceRow && (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
            {/* Left: Distance / hint / unavailable */}
            <div className="flex items-center gap-1 text-sm text-gray-500 min-w-0">
              {isSignedIn ? (
                canShowDistance ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                    <span suppressHydrationWarning>
                      {formatOneDecimalForLocale(tenant.distance!)} km
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <MapPinOff className="h-4 w-4 text-gray-400 shrink-0" />
                    <span>Distance unavailable</span>
                  </span>
                )
              ) : (
                <AuthTooltip isSignedIn={!!isSignedIn}>
                  <span className="text-gray-400 cursor-help">Sign in to see distance</span>
                </AuthTooltip>
              )}
            </div>

            {/* Right: Service badges */}
            {hasServices && (
              <div className="ml-auto flex gap-2 flex-wrap">
                {tenant.services!.map((service) => (
                  <span
                    key={service}
                    className={`px-2 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1 ${
                      service === "on-site" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                    }`}
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
            {/* Left: fulfilled orders (placeholder-ready) */}
            <div className="flex items-center gap-1">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              <span suppressHydrationWarning>
                {typeof ordersCount === "number"
                  ? `${formatIntegerForLocale(ordersCount)} orders`
                  : "—"}
              </span>
            </div>

            {/* Right: Active since (Month + Year) */}
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Since:</span>
              <span suppressHydrationWarning>
                {formatMonthYearForLocale(tenant.createdAt)}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons (only when showActions is true) */}
        {showActions && (
          <div className="grid grid-cols-1 gap-2 pt-2">
            <Button
              size="lg"
              className="w-full"
              aria-label="Book service"
              onClick={onBook ?? (() => console.log("TODO: Book service"))}
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
          </div>
        )}
      </div>
    </div>
  );
};
