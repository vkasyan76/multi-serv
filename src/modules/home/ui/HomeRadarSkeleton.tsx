"use client";

type Props = { size?: number };

/** Single, final-look skeleton from first paint (no white flash) */
export function HomeRadarSkeleton({ size = 560 }: Props) {
  return (
    <>
      {/* Orbit (middle column) */}
      <div className="flex w-full min-w-0 justify-center lg:justify-start pr-6 min-h-[280px]">
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading providers"
          className="relative"
          style={{ width: size, height: size }}
        >
          {/* Shimmer lives on the base disk now */}
          <div className="absolute inset-0 rounded-full border border-border/70 shadow-sm shimmer" />

          {/* pulsating center */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            aria-hidden
          >
            <span className="relative block h-5 w-5">
              <span className="absolute inset-0 rounded-full bg-zinc-300/60 dark:bg-zinc-600/60 animate-ping" />
              <span className="absolute inset-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
            </span>
          </div>
        </div>
      </div>

      {/* Carousel (right column) */}
      <div className="w-full lg:h-full flex justify-end">
        <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center lg:px-12">
          <div className="w-full">
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
              {/* image area with the same shimmer */}
              <div className="w-full aspect-[4/3] lg:aspect-square shimmer" />
              {/* text lines */}
              <div className="p-4 space-y-3">
                <div className="h-5 w-48 rounded-md shimmer" />
                <div className="h-4 w-32 rounded-md shimmer" />
                <div className="h-4 w-28 rounded-md shimmer" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
