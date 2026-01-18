"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { OrdersLifecycleTable } from "./orders-lifecycle-table";
import { useEffect } from "react";

export function CustomerOrdersLifecycleView() {
  const trpc = useTRPC();
  const q = useQuery(trpc.orders.listMineSlotLifecycle.queryOptions());

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    if (q.data) console.log("[CustomerOrdersLifecycleView] data:", q.data);
    if (q.error) console.log("[CustomerOrdersLifecycleView] error:", q.error);
  }, [q.data, q.error]);

  if (q.isLoading) return <div>Loading…</div>;
  if (q.isError) return <div>Failed to load orders.</div>;

  return <OrdersLifecycleTable mode="customer" orders={q.data ?? []} />;
}
