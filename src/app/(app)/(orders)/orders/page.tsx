import { CustomerSlotOrdersView } from "@/modules/orders/ui/customer-slot-orders-view";
import { caller, getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const Page = async ({ searchParams }: OrdersPageProps) => {
  // Guard orders behind auth so email deep-links prompt sign-in if needed.
  const session = await caller.auth.session();
  if (!session.user) {
    // Preserve invoice callback params so CustomerSlotOrdersView can finalize
    // /orders?invoice=success&session_id=... after login.
    const params = new URLSearchParams();
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        if (Array.isArray(value)) {
          value.forEach((entry) => params.append(key, entry));
        } else if (value != null) {
          params.set(key, value);
        }
      }
    }
    const suffix = params.toString();
    const redirectUrl = suffix ? `/orders?${suffix}` : "/orders";
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`,
    );
  }

  const queryClient = getQueryClient();
  // listMine is a normal query (no args)
  await queryClient.prefetchQuery(trpc.auth.session.queryOptions());
  await queryClient.prefetchQuery(trpc.orders.listMine.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CustomerSlotOrdersView />
    </HydrationBoundary>
  );
};

export default Page;
