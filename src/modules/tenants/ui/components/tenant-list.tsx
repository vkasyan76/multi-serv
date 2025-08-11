"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTenantFilters } from "../../hooks/use-tenant-filters";
import { MapPin, Clock, Monitor, MapPinOff } from "lucide-react";
import type { TenantWithRelations } from "../../types";

// Helper function to format market tenure - simple "Since [date]" format
const formatMarketTenure = (createdAt: string): string => {
  const created = new Date(createdAt);
  return `Since ${created.toLocaleDateString()}`;
};

interface Props {
  category?: string;
  subcategory?: string;
}

export const TenantList = ({ category, subcategory }: Props) => {
  const trpc = useTRPC();
  const [filters] = useTenantFilters();

  const { data: userProfile } = useSuspenseQuery(
    trpc.auth.getUserProfile.queryOptions()
  );

  const { data } = useSuspenseQuery(
    trpc.tenants.getMany.queryOptions({
      category: category || null,
      subcategory: subcategory || null,
      ...filters,
      userLat: userProfile?.coordinates?.lat ?? null,
      userLng: userProfile?.coordinates?.lng ?? null,
    })
  );

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4
"
    >
      {/* {JSON.stringify(data, null, 2)} */}
             {data?.docs.map((tenant: TenantWithRelations) => (
         <div
           key={tenant.id}
           className="border rounded-md bg-white p-4 hover:shadow-md transition-shadow"
         >
           {/* Header with name and hourly rate */}
           <div className="flex items-start justify-between mb-3">
             <h2 className="text-xl font-semibold text-gray-900">
               {tenant.name}
             </h2>
             <div className="text-right">
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
               <div className="flex gap-2 mt-1">
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
       ))}
    </div>
  );
};

export const TenantListSkeleton = () => {
  return <div>Loading...</div>;
};
