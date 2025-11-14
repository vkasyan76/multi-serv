"use client";

// Single, combined skeleton for the whole middle + right columns
export function HomeRadarSkeleton() {
  return (
    <>
      {/* Orbit placeholder */}
      <div className="flex w-full min-w-0 justify-center lg:justify-start pr-6 min-h-[280px]">
        <div
          className="relative rounded-full bg-muted/30 animate-pulse"
          style={{ width: 560, height: 560 }}
        />
      </div>

      {/* Carousel placeholder */}
      <div className="w-full lg:h-full flex justify-end">
        <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center lg:px-12">
          <div className="w-full">
            <div className="aspect-[4/3] lg:aspect-square rounded-2xl bg-muted/30 animate-pulse" />
            <div className="mt-3 space-y-2">
              <div className="h-5 w-40 rounded bg-muted/30 animate-pulse" />
              <div className="h-4 w-28 rounded bg-muted/30 animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted/30 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
