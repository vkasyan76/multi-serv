"use client";
import Link from "next/link";
import { Home } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Poppins } from "next/font/google";

import { generateTenantUrl } from "@/lib/utils";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
// import { useRouter } from "next/navigation";
import ReviewForm from "./review-form";

const poppins = Poppins({ subsets: ["latin"], weight: ["700"] });

export default function NewReviewView({ slug }: { slug: string }) {
  const trpc = useTRPC();
  // const router = useRouter();

  const mine = useQuery(trpc.reviews.getMineForTenant.queryOptions({ slug }));
  const ctxQ = useQuery(trpc.reviews.reviewContext.queryOptions({ slug })); // header context

  const hasExistingReview = !!mine.data;
  const tenantSlug = ctxQ.data?.tenant?.slug ?? slug;

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar — consistent with dashboard: left = provider name (public), right = Home */}
      <nav className="bg-white w-full border-b">
        <div className="mx-auto max-w-(--breakpoint-xl) px-3 sm:px-4 lg:px-12 h-14 sm:h-16 flex items-center justify-between">
          {/* Provider link with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={generateTenantUrl(tenantSlug)}
                  className={cn(
                    "text-lg sm:text-xl font-semibold truncate",
                    poppins.className
                  )}
                  aria-label="Open provider page"
                >
                  {ctxQ.data?.tenant?.name ?? tenantSlug}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Go to provider page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Home icon with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  className="p-2 rounded-full hover:bg-muted"
                  aria-label="Home"
                >
                  <Home className="h-7 w-7" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Home</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </nav>

      {/* Header with tenant + service + date */}
      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
          <h1 className="text-[32px] font-medium">
            {hasExistingReview
              ? "Update your review for "
              : "Write a review for "}
            {ctxQ.data?.tenant?.slug ?? slug}
          </h1>
        </div>
      </header>
      {/* Center the form */}
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <div className="mx-auto w-full max-w-xl">
          <ReviewForm slug={slug} existingReview={mine.data ?? null} />
        </div>
      </section>
    </div>
  );
}
