import { Skeleton } from "@/components/ui/skeleton";

export const TenantCalendarSkeleton = () => {
  return (
    <div className="h-[50vh] rounded-lg border bg-white overflow-hidden">
      {/* Toolbar-ish header */}
      <div className="px-3 py-2 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>

        <Skeleton className="h-5 w-44" />

        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>

      {/* Grid-ish body (resembles RBC week/day grid) */}
      <div className="h-[calc(50vh-44px)] grid grid-cols-[72px_repeat(7,1fr)]">
        {/* Time gutter */}
        <div className="border-r">
          <div className="h-9 border-b" />
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-10 border-b flex items-center justify-center"
            >
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>

        {/* Day columns */}
        {Array.from({ length: 7 }).map((_, col) => (
          <div key={col} className="border-r last:border-r-0 relative">
            <div className="h-9 border-b flex items-center justify-center">
              <Skeleton className="h-4 w-16" />
            </div>

            {Array.from({ length: 9 }).map((__, row) => (
              <div key={row} className="h-10 border-b" />
            ))}

            {/* Fake “events” so it reads like a calendar */}
            {col === 1 && (
              <div className="absolute left-2 right-2 top-[64px]">
                <Skeleton className="h-6 w-full rounded-md" />
              </div>
            )}
            {col === 4 && (
              <div className="absolute left-2 right-2 top-[140px]">
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
