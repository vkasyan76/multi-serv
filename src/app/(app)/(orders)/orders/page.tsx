import { CustomerSlotOrdersView } from "@/modules/orders/ui/customer-slot-orders-view";
import { caller, getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const Page = async () => {
  // Guard orders behind auth so email deep-links prompt sign-in if needed.
  const session = await caller.auth.session();
  if (!session.user) {
    // Include redirect_url so users return here after sign-in.
    redirect("/sign-in?redirect_url=/orders");
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
