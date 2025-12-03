"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { StarRating } from "./star-rating";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { DEFAULT_LIMIT } from "@/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type TenantReviewSummaryProps = {
  slug: string; // tenant slug
};

export function TenantReviewSummary({ slug }: TenantReviewSummaryProps) {
  const trpc = useTRPC();

  // ---------- Review summary ----------

  const summaryQ = useQuery(
    trpc.reviews.summaryForTenant.queryOptions({ slug })
  );

  // ---------- Review comments: list (paginated) ----------

  const listBase = trpc.reviews.listForTenant.infiniteQueryOptions(
    { slug, limit: DEFAULT_LIMIT },
    {
      getNextPageParam: (lastPage) =>
        lastPage.hasNextPage ? lastPage.nextPage : undefined,
    }
  );

  const listQ = useInfiniteQuery({
    ...listBase,
    enabled: !!slug && (summaryQ.data?.totalReviews ?? 0) > 0,
  });

  const reviews = useMemo(() => {
    const pages = listQ.data?.pages ?? [];
    return pages.flatMap((p) => p.docs);
  }, [listQ.data]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const initials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "U";
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("");
  };

  // Loading state – simple skeleton
  if (summaryQ.isLoading) {
    return (
      <div className="space-y-8">
        {/* ===== Summary ===== */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: overall rating block */}
          ...
          {/* Right: breakdown per star (Amazon-style bars) */}
          ...
        </div>
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
    <div className="space-y-8">
      {/* ===== Summary ===== */}
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

      {/* ===== Reviews list ===== */}
      <div className="space-y-4">
        {listQ.isError && (
          <p className="text-sm text-muted-foreground">
            We couldn’t load review details right now. Please try again later.
          </p>
        )}

        {listQ.isLoading && reviews.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border bg-white/70 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-56 mt-4" />
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-5/6 mt-2" />
              </div>
            ))}
          </div>
        ) : (
          reviews.map((r) => {
            const isExpanded = !!expanded[r.id];
            const showToggle = (r.body?.length ?? 0) > 260;

            return (
              <div
                key={r.id}
                className="rounded-2xl border bg-white/70 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage
                        src={r.author.avatarUrl ?? undefined}
                        alt={r.author.name}
                        referrerPolicy="no-referrer"
                      />
                      <AvatarFallback className="font-semibold text-sm">
                        {initials(r.author.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {r.author.name}
                      </div>
                      {r.createdAt ? (
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StarRating rating={r.rating ?? 0} />
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {r.title ? (
                    <div className="font-semibold leading-snug">{r.title}</div>
                  ) : null}

                  {r.body ? (
                    <p
                      className={[
                        "text-sm text-muted-foreground whitespace-pre-line break-words",
                        isExpanded ? "" : "line-clamp-4",
                      ].join(" ")}
                    >
                      {r.body}
                    </p>
                  ) : null}

                  {showToggle && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(r.id)}
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {listQ.hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => listQ.fetchNextPage()}
              disabled={listQ.isFetchingNextPage}
              className="min-w-[140px]"
            >
              {listQ.isFetchingNextPage ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
