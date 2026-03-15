"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTRPC } from "@/trpc/client";
import {
  OrdersLifecycleSkeleton,
  OrdersLifecycleTable,
} from "./orders-lifecycle-table";
import { useEffect } from "react";
import type { AppLang } from "@/lib/i18n/app-lang";

export function CustomerOrdersLifecycleView({
  appLang,
}: {
  appLang: AppLang;
}) {
  const trpc = useTRPC();
  const tOrders = useTranslations("orders");
  const q = useQuery({
    ...trpc.orders.listMineSlotLifecycle.queryOptions(),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    if (q.data) console.log("[CustomerOrdersLifecycleView] data:", q.data);
    if (q.error) console.log("[CustomerOrdersLifecycleView] error:", q.error);
  }, [q.data, q.error]);

  if (q.isLoading) return <OrdersLifecycleSkeleton />;
  if (q.isError) return <div>{tOrders("states.load_error")}</div>;

  return (
    <OrdersLifecycleTable
      mode="customer"
      orders={q.data ?? []}
      appLang={appLang}
    />
  );
}

