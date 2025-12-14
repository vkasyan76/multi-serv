import { Skeleton } from "@/components/ui/skeleton";

export const TenantMessagesSkeleton = () => {
  return (
    <div className="h-[70vh] rounded-lg border bg-white overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] h-full">
        {/* Left: inbox list */}
        <div className="h-full border-r bg-background">
          <div className="px-4 py-3 border-b">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>

          <div className="p-2 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg px-3 py-2 border bg-white/60">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-3 w-full mt-2" />
              </div>
            ))}
          </div>

          <div className="p-2 border-t">
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>

        {/* Right: conversation panel */}
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b bg-background">
            <Skeleton className="h-4 w-44 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>

          <div className="flex-1 p-4 space-y-3">
            {/* bubbles */}
            <div className="flex justify-start">
              <Skeleton className="h-8 w-2/3 rounded-2xl" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-8 w-1/2 rounded-2xl" />
            </div>
            <div className="flex justify-start">
              <Skeleton className="h-10 w-3/4 rounded-2xl" />
            </div>
          </div>

          <div className="border-t p-3 bg-background">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-3 w-56 mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
};
