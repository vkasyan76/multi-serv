"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DEFAULT_LIMIT } from "@/constants";
import { useTRPC } from "@/trpc/client";
import {
  OrdersLifecycleSkeleton,
  OrdersLifecycleTable,
} from "./orders-lifecycle-table";
import { type AppLang, getInitialLanguage } from "@/modules/profile/location-utils";

function pageWindow(current: number, total: number, size = 5) {
  const half = Math.floor(size / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + size - 1);
  start = Math.max(1, end - size + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function TenantOrdersLifecycleView({ appLang }: { appLang?: AppLang }) {
  const trpc = useTRPC();
  const [page, setPage] = useState(1);
  const q = useQuery({
    ...trpc.orders.listForMyTenantSlotLifecycle.queryOptions({
      page,
      limit: DEFAULT_LIMIT,
    }),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    if (q.data) console.log("[TenantOrdersLifecycleView] data:", q.data);
    if (q.error) console.log("[TenantOrdersLifecycleView] error:", q.error);
  }, [q.data, q.error]);

  const items = q.data?.items ?? [];
  const totalPages = q.data?.totalPages ?? 1;

  // when totalPages shrinks (e.g. data changes), ensure page isn’t out of range:

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (q.isLoading) return <OrdersLifecycleSkeleton />;
  if (q.isError) return <div>Failed to load orders.</div>;
  if (items.length === 0) {
    return (
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        As soon as you receive any orders from your customers, they will appear
        in this section.
      </div>
    );
  }

  const pages = totalPages > 1 ? pageWindow(page, totalPages, 5) : [];

  const effectiveLang: AppLang = appLang ?? getInitialLanguage();

  return (
    <div className="space-y-3">
      <OrdersLifecycleTable
        mode="tenant"
        orders={items}
        appLang={effectiveLang}
      />

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage(1)}
          >
            {"<<"}
          </Button>
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {"<"}
          </Button>

          {pages.map((p) => (
            <Button
              key={p}
              variant={p === page ? "default" : "ghost"}
              onClick={() => setPage(p)}
            >
              {p}
            </Button>
          ))}

          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {">"}
          </Button>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            {">>"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

