"use client";

import { MapPin, Clock, Monitor, MapPinOff, Star } from "lucide-react";
import type { TenantWithRelations } from "../../types";

// Helper function to format market tenure - simple "Since [date]" format
const formatMarketTenure = (createdAt: string): string => {
  const created = new Date(createdAt);
  return `Since ${created.toLocaleDateString()}`;
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
  reviewCount = 5 
}: TenantCardProps) => {
  return (
    <div className="border rounded-lg bg-white p-4 hover:shadow-lg transition-all duration-200 hover:border-blue-200">
      {/* Header with name and hourly rate */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 truncate">
            {tenant.name}
          </h2>
          {/* Review Rating */}
          <div className="flex items-center gap-1 mt-1">
            <div className="flex items-center">
              {renderStars(reviewRating)}
            </div>
            <span className="text-sm text-gray-500">
              ({reviewCount} reviews)
            </span>
          </div>
        </div>
        <div className="text-right ml-3">
          <span className="text-2xl font-bold text-blue-600">
            €{tenant.hourlyRate}
          </span>
          <span className="block text-sm text-gray-500">per hour</span>
        </div>
      </div>

      {/* Service delivery type */}
      {tenant.services && tenant.services.length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Service Delivery
          </span>
          <div className="flex gap-2 mt-1 flex-wrap">
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
        </div>
      )}

      {/* Distance and Market Tenure */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        {/* Distance */}
        {tenant.distance ? (
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span>{tenant.distance.toFixed(1)} km away</span>
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
  );
};
