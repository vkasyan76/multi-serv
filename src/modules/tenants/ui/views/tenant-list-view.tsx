"use client";

import { Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import { ErrorBoundary } from "react-error-boundary";
import { TenantList, TenantListSkeleton } from "../components/tenant-list";
import { TenantFilters } from "../components/tenant-filters";
import { TenantSort } from "../components/tenants-sort";
import { SortingDisplay } from "../components/sorting-display";
import { TenantListError } from "../components/tenant-list-error";

interface TenantListViewProps {
  category?: string;
  subcategory?: string;
}

export const TenantListView = ({ category, subcategory }: TenantListViewProps) => {
  const { isSignedIn } = useAuth();

  return (
    <div className="px-4 lg:px-12 py-8 flex flex-col gap-4">
      {/* Sort */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-y-2 lg:gap-y-0 justify-between">
        <SortingDisplay isSignedIn={!!isSignedIn} />
        <TenantSort isSignedIn={!!isSignedIn} />
      </div>

      {/* Filters & Tenant List */}
      <div className="grid grid-cols-1 lg:grid-cols-6 xl:grid-cols-8 gap-y-6 gap-x-12">
        <div className="lg:col-span-2 xl:col-span-2">
          <TenantFilters isSignedIn={!!isSignedIn} />
        </div>
        <div className="lg:col-span-4 xl:col-span-6">
          <Suspense fallback={<TenantListSkeleton />}>
            <ErrorBoundary fallback={<TenantListError />}>
              <TenantList category={category} subcategory={subcategory} isSignedIn={!!isSignedIn} />
            </ErrorBoundary>
          </Suspense>
        </div>
      </div>
    </div>
  );
};
