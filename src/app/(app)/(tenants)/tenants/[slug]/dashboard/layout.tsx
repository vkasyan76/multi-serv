import { Suspense } from "react";
import { Footer } from "@/modules/tenants/ui/components/tenant_page/footer";
import DashboardNavbar, {
  DashboardNavbarSkeleton,
} from "@/modules/tenants/ui/components/tenant_dashboard/dashboard-navbar";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const qc = getQueryClient();
  await qc.prefetchQuery(trpc.tenants.getOne.queryOptions({ slug }));

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col">
      <HydrationBoundary state={dehydrate(qc)}>
        <Suspense fallback={<DashboardNavbarSkeleton />}>
          <DashboardNavbar slug={slug} />
        </Suspense>

        <main className="flex-1">
          <div className="max-w-[var(--breakpoint-xl)] mx-auto px-3 sm:px-4 lg:px-12 py-4">
            {children}
          </div>
        </main>

        <Footer slug={slug} />
      </HydrationBoundary>
    </div>
  );
}
