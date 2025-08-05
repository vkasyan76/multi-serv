"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

interface Props {
  category?: string;
  subcategory?: string;
}

export const TenantsList = ({ category, subcategory }: Props) => {
  const trpc = useTRPC();

  const { data } = useSuspenseQuery(
    trpc.tenants.getMany.queryOptions({ 
      category: category || null,
      subcategory: subcategory || null
    })
  );

  return <div>{JSON.stringify(data, null, 2)}</div>;
};

export const TenantsListSkeleton = () => {
  return <div>Loading...</div>;
}; 