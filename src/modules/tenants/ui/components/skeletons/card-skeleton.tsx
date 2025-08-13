import { Skeleton } from "@/components/ui/skeleton";

export const CardSkeleton = () => {
  return (
    <div className="border rounded-lg bg-white p-4">
      {/* Header with name and hourly rate */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-6 w-32 mb-2" />
          {/* Review Rating Skeleton */}
          <div className="flex items-center gap-1 mt-1">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-4 rounded" />
              ))}
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="text-right ml-3">
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>

      {/* Service delivery type skeleton */}
      <div className="mb-3">
        <Skeleton className="h-3 w-24 mb-2" />
        <div className="flex gap-2 mt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>

      {/* Distance and Market Tenure skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
};
