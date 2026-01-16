"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { OrdersLifecycleTable } from "./orders-lifecycle-table";

export function CustomerOrdersLifecycleView() {
  const trpc = useTRPC();
  const q = useQuery(trpc.orders.listMineSlotLifecycle.queryOptions());

  if (q.isLoading) return <div>Loading…</div>;
  if (q.isError) return <div>Failed to load orders.</div>;

  return <OrdersLifecycleTable mode="customer" orders={q.data ?? []} />;
}
