"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { OrdersLifecycleTable } from "./orders-lifecycle-table";
import { useEffect } from "react";

export function TenantOrdersLifecycleView() {
  const trpc = useTRPC();
  const q = useQuery(trpc.orders.listForMyTenantSlotLifecycle.queryOptions());

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    if (q.data) console.log("[TenantOrdersLifecycleView] data:", q.data);
    if (q.error) console.log("[TenantOrdersLifecycleView] error:", q.error);
  }, [q.data, q.error]);

  if (q.isLoading) return <div>Loading…</div>;
  if (q.isError) return <div>Failed to load orders.</div>;

  const orders = q.data ?? [];

  if (orders.length === 0) {
    return (
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        As soon as you receive any orders from your customers, they will appear
        in this section.
      </div>
    );
  }

  return <OrdersLifecycleTable mode="tenant" orders={orders} />;
}
