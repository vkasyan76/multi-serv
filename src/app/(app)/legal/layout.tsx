import { Footer } from "@/modules/home/ui/components/footer";
import { Navbar } from "@/modules/home/ui/components/navbar";
import { getQueryClient, trpc } from "@/trpc/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

export const dynamic = "force-dynamic";

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Keep Navbar behavior consistent (it may rely on categories query)
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.categories.getMany.queryOptions());

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F4F0]">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Navbar />
      </HydrationBoundary>

      <main className="flex-1">
        {/* “legal” pages styling wrapper */}
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
          <div className="rounded-xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-black/5">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
