import { Footer } from "@/modules/tenants/ui/components/tenant_page/footer";
import {
  Navbar,
  NavbarSkeleton,
} from "@/modules/tenants/ui/components/tenant_page/navbar";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

const Layout = async ({ children, params }: LayoutProps) => {
  const { slug } = await params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.tenants.getOne.queryOptions({
      slug,
    })
  );

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<NavbarSkeleton />}>
          <Navbar slug={slug} />
        </Suspense>
        <div className="flex-1">
          <div className="max-w-[var(--breakpoint-xl)] mx-auto"> {children}</div>
        </div>
        <Suspense fallback={<div className="border-t font-medium bg-white h-16" />}>
          <Footer slug={slug} />
        </Suspense>
      </HydrationBoundary>
    </div>
  );
};

export default Layout;
