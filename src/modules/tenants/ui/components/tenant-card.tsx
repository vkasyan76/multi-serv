"use client";

import { MapPin, Clock, Monitor, MapPinOff, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import type { TenantWithRelations } from "../../types";

// Helper function to format market tenure - simple date format
const formatMarketTenure = (createdAt: string): string => {
  const created = new Date(createdAt);
  return created.toLocaleDateString();
};

// Helper function to render star rating
const renderStars = (rating: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={`h-4 w-4 ${
        i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
      }`}
    />
  ));
};

interface TenantCardProps {
  tenant: TenantWithRelations;
  reviewRating?: number;
  reviewCount?: number;
}

export const TenantCard = ({
  tenant,
  reviewRating = 3,
  reviewCount = 5,
}: TenantCardProps) => {
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

  return (
    <div className="border rounded-lg bg-white p-5 hover:shadow-lg transition-all duration-200 hover:border-blue-200 w-[280px] flex-shrink-0 flex-1 max-w-[320px]">
      {/* Header with image and price/service types in flex column layout */}
      <div className="flex gap-4 mb-4">
        {/* Left Column: Tenant Image */}
        <div className="flex-shrink-0">
          {/* Larger Square Image Component */}
          <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center shadow-sm relative">
            {tenant.image?.url || tenant.user?.clerkImageUrl ? (
              <Image
                src={(tenant.image?.url || tenant.user?.clerkImageUrl) ?? ""}
                alt={tenant.name}
                fill
                className="object-cover"
                sizes="96px"
                onError={handleImageError}
                unoptimized={true}
              />
            ) : null}
            <div
              className={`bg-blue-100 text-blue-600 font-semibold text-2xl flex items-center justify-center w-full h-full ${tenant.image?.url || tenant.user?.clerkImageUrl ? "hidden" : ""}`}
            >
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Right Column: Price and Service Types */}
        <div className="flex flex-col flex-1">
          {/* Price */}
          <div className="text-right mb-3">
            <span className="text-2xl font-bold text-blue-600">
              €{tenant.hourlyRate}/h
            </span>
          </div>

          {/* Service Type Icons Below Price */}
          {tenant.services && tenant.services.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-end">
              {tenant.services.map((service) => (
                <span
                  key={service}
                  className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${
                    service === "on-site"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
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
      </div>

      {/* Both Names Below Image and Price Section - Left/Right Justified */}
      <div className="flex justify-between items-center mb-3 gap-4">
        {/* Tenant Name - Left Aligned */}
        <div className="flex-1 min-w-0">
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-1 truncate">
            {tenant.name}
          </Badge>
        </div>

        {/* First + Last Name - Right Aligned */}
        <div className="flex-1 text-right min-w-0">
          <Badge
            variant="outline"
            className="text-gray-700 text-sm font-medium px-3 py-1 border-gray-300 truncate"
          >
            {tenant.firstName} {tenant.lastName}
          </Badge>
        </div>
      </div>

      {/* Rating Section - moved to bottom for better spacing */}
      <div className="mb-3">
        <div className="flex items-center gap-1">
          <div className="flex items-center">{renderStars(reviewRating)}</div>
          <span className="text-sm text-gray-500 ml-1">
            {new Intl.NumberFormat(navigator.language, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }).format(reviewRating)}{" "}
            ({reviewCount} reviews)
          </span>
        </div>
      </div>

      {/* Distance and Market Tenure */}
      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between text-sm text-gray-500">
          {/* Distance */}
          {tenant.distance !== null && tenant.distance !== undefined ? (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span>{tenant.distance.toFixed(1)} km</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <MapPinOff className="h-4 w-4 text-gray-400" />
              <span>Distance unavailable</span>
            </div>
          )}

          {/* Market Tenure */}
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-green-600" />
            <span>{formatMarketTenure(tenant.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
