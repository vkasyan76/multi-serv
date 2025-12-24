// src/app/(app)/dashboard/layout.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Footer } from "@/modules/tenants/ui/components/tenant_page/footer";
import DashboardNavbar, {
  DashboardNavbarSkeleton,
} from "@/modules/tenants/ui/components/tenant_dashboard/dashboard-navbar";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const qc = getQueryClient();

  // 1) Get my tenant
  const mine = await qc.fetchQuery(trpc.tenants.getMine.queryOptions({}));
  if (!mine?.slug) redirect("/profile?tab=vendor");

  // 2) Prefetch tenant details used by navbar/calendar
  await qc.prefetchQuery(trpc.tenants.getOne.queryOptions({ slug: mine.slug }));

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col">
      <HydrationBoundary state={dehydrate(qc)}>
        <Suspense fallback={<DashboardNavbarSkeleton />}>
          <DashboardNavbar slug={mine.slug} />
        </Suspense>

        <main className="flex-1">
          <div className="max-w-[var(--breakpoint-xl)] mx-auto px-3 sm:px-4 lg:px-12 py-4">
            {children}
          </div>
        </main>

        <Footer slug={mine.slug} />
      </HydrationBoundary>
    </div>
  );
}
