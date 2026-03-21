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
  const baseOptions = trpc.orders.listMineSlotLifecycle.queryOptions();
  // Scope cached lifecycle rows by route locale so service labels refresh on language switch.
  const queryKey = [
    baseOptions.queryKey[0],
    { ...(baseOptions.queryKey[1] ?? {}), locale: appLang },
  ] as unknown as typeof baseOptions.queryKey;
  const q = useQuery({
    ...baseOptions,
    queryKey,
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
  if (q.isError) return <div role="alert">{tOrders("states.load_error")}</div>;

  return (
    <OrdersLifecycleTable
      mode="customer"
      orders={q.data ?? []}
      appLang={appLang}
    />
  );
}

