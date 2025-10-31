"use client";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useRouter } from "next/navigation";
import ReviewForm from "./review-form";
import { formatDateForLocale } from "@/modules/profile/location-utils";

export default function NewReviewView({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const router = useRouter();

  const mine = useQuery(trpc.reviews.getMineForTenant.queryOptions({ slug }));
  const ctxQ = useQuery(trpc.reviews.reviewContext.queryOptions({ slug })); // header context

  if (mine.data) {
    router.replace(`/tenants/${slug}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar reused from OrdersView */}
      <nav className="p-4 bg-[#F4F4F0] w-full border-b">
        <Link
          prefetch
          href={`/tenants/${slug}`}
          className="flex items-center gap-2"
        >
          <ArrowLeftIcon className="size-4" />
          <span className="font-medium">
            Back to {ctxQ.data?.tenant?.name ?? "provider"}
          </span>
        </Link>
      </nav>

      {/* Header with tenant + service + date */}
      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
          <h1 className="text-[32px] font-medium">Write a review</h1>
          {ctxQ.data && (
            <p className="text-muted-foreground mt-2">
              {ctxQ.data.tenant?.name}
              {ctxQ.data.serviceName ? ` · ${ctxQ.data.serviceName}` : ""}
              {ctxQ.data.when
                ? ` · ${formatDateForLocale(ctxQ.data.when)}`
                : ""}
            </p>
          )}
        </div>
      </header>

      {/* Center the form */}
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <div className="mx-auto w-full max-w-xl">
          <ReviewForm slug={slug} />
        </div>
      </section>
    </div>
  );
}
