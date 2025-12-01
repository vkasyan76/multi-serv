"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { StarRating } from "./star-rating";
import { Skeleton } from "@/components/ui/skeleton";

type TenantReviewSummaryProps = {
  slug: string; // tenant slug
};

export function TenantReviewSummary({ slug }: TenantReviewSummaryProps) {
  const trpc = useTRPC();

  const summaryQ = useQuery(
    trpc.reviews.summaryForTenant.queryOptions({ slug })
  );

  // Loading state – simple skeleton
  if (summaryQ.isLoading) {
    return (
      <div>
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-4 w-32 mb-3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full mb-2" />
        ))}
      </div>
    );
  }

  // Error or no reviews yet
  if (summaryQ.isError) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          We couldn’t load reviews right now. Please try again later.
        </p>
      </div>
    );
  }
  if (!summaryQ.data || summaryQ.data.totalReviews === 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          No reviews yet. Once customers start leaving feedback, their ratings
          will be displayed here.
        </p>
      </div>
    );
  }

  const { avgRating, totalReviews, breakdown } = summaryQ.data;
  const roundedAvg = Math.round(avgRating * 10) / 10; // 4.44 -> 4.4
  const rows = [5, 4, 3, 2, 1] as const;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: overall rating block */}
      <div className="flex flex-col gap-2 min-w-[220px]">
        <div className="flex items-center gap-2">
          <StarRating rating={avgRating ?? 0} />
          <span className="text-lg font-medium">
            {roundedAvg.toFixed(1)} out of 5
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalReviews} {totalReviews === 1 ? "rating" : "ratings"}
        </div>
      </div>

      {/* Right: breakdown per star (Amazon-style bars) */}
      <div className="flex-1 max-w-xl space-y-1">
        {rows.map((star) => {
          const count = breakdown[star] ?? 0;
          const percentage = totalReviews
            ? Math.round((count / totalReviews) * 100)
            : 0;

          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-12 text-right">{star} star</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-2 bg-amber-500 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-20 text-right tabular-nums">
                {count} ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
