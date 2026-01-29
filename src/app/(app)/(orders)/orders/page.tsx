import { CustomerSlotOrdersView } from "@/modules/orders/ui/customer-slot-orders-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export const dynamic = "force-dynamic";

const Page = async () => {
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
