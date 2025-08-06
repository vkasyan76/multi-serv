"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTenantFilters } from "../../hooks/use-tenant-filters";

interface Props {
  category?: string;
  subcategory?: string;
}

export const TenantList = ({ category, subcategory }: Props) => {
  const trpc = useTRPC();
  const [filters] = useTenantFilters();

  const { data } = useSuspenseQuery(
    trpc.tenants.getMany.queryOptions({
      category: category || null,
      subcategory: subcategory || null,
      ...filters, 
    })
  );

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4
"
    >
      {/* {JSON.stringify(data, null, 2)} */}
      {data?.docs.map((tenant) => (
        <div key={tenant.id} className="border rounded-md bg-white p-4">
          <h2 className="text-xl font-medium">{tenant.name}</h2>
          <h2>{tenant.hourlyRate}</h2>
        </div>
      ))}
    </div>
  );
};

export const TenantListSkeleton = () => {
  return <div>Loading...</div>;
};
