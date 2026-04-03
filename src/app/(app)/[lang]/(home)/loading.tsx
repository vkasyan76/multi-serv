import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="flex-1 bg-[#F4F4F0]">
      <div className="container mx-auto px-4 pt-6 pb-10 overflow-x-hidden">
        {/* Keep this neutral because the shared (home) segment covers landing,
            category, subcategory, and marketing pages, while navbar/search/footer
            already render through the existing layout path. */}
        <div className="space-y-6">
          <Skeleton className="h-14 w-3/4 max-w-4xl" />
          <Skeleton className="h-8 w-1/2 max-w-2xl" />
        </div>

        <div className="mt-10 space-y-6">
          <Skeleton className="h-72 w-full rounded-3xl" />

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
