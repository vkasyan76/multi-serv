"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClipboardListIcon, Home } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, generateTenantUrl, localizedPlatformHref } from "@/lib/utils";
import { Poppins } from "next/font/google";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import ReviewForm from "./review-form";

const poppins = Poppins({ subsets: ["latin"], weight: ["700"] });

export default function NewReviewView({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const tCommon = useTranslations("common");
  const tReviews = useTranslations("reviews");
  const params = useParams<{ lang?: string }>();
  const appLang = normalizeToSupported(params?.lang);

  const mine = useQuery(trpc.reviews.getMineForTenant.queryOptions({ slug }));
  const ctxQ = useQuery(trpc.reviews.reviewContext.queryOptions({ slug }));

  const hasExistingReview = !!mine.data;
  const tenantSlug = ctxQ.data?.tenant?.slug ?? slug;
  const tenantName = ctxQ.data?.tenant?.name ?? tenantSlug;
  const ordersHref = localizedPlatformHref("/orders", appLang);
  const pageTitle = hasExistingReview
    ? tReviews("page.update_title", { tenantName })
    : tReviews("page.write_title", { tenantName });

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white w-full border-b">
        <div className="mx-auto max-w-(--breakpoint-xl) px-3 sm:px-4 lg:px-12 h-14 sm:h-16 flex items-center justify-between">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={generateTenantUrl(tenantSlug, appLang)}
                  className={cn(
                    "text-lg sm:text-xl font-semibold truncate",
                    poppins.className
                  )}
                  aria-label={tReviews("page.open_provider_page")}
                >
                  {tenantName}
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                {tReviews("page.go_to_provider_page")}
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1 shrink-0 sm:gap-2">
              {/* Review pages belong to the orders journey, so keep a direct
              path back to the customer's localized Orders area here too. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={ordersHref}
                    className="p-2 rounded-full hover:bg-muted"
                    aria-label={tCommon("nav.my_orders")}
                  >
                    <ClipboardListIcon className="h-7 w-7" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{tCommon("nav.my_orders")}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={withLocalePrefix("/", appLang)}
                    className="p-2 rounded-full hover:bg-muted"
                    aria-label={tReviews("page.home")}
                  >
                    <Home className="h-7 w-7" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{tReviews("page.home")}</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </nav>

      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
          <h1 className="text-[32px] font-medium">{pageTitle}</h1>
        </div>
      </header>
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <div className="mx-auto w-full max-w-xl">
          <ReviewForm slug={slug} existingReview={mine.data ?? null} />
        </div>
      </section>
    </div>
  );
}
