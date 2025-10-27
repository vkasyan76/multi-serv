import { OrdersView } from "@/modules/orders/ui/orders-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export const dynamic = "force-dynamic";

const Page = async () => {
  const queryClient = getQueryClient();
  // listMine is a normal query (no args)
  void queryClient.prefetchQuery(trpc.orders.listMine.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersView />
    </HydrationBoundary>
  );
};

export default Page;
