"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantCombobox } from "@/components/ui/tenant-combobox";
import { DEFAULT_LIMIT } from "@/constants";
import type { AppLang } from "@/lib/i18n/app-lang";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import {
  getInitialLanguage,
  getLocaleAndCurrency,
} from "@/modules/profile/location-utils";
import { useTRPC } from "@/trpc/client";
import { AdminOrdersLifecycleTable } from "./admin-orders-lifecycle-table";

function pageWindow(current: number, total: number, size = 5) {
  const half = Math.floor(size / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + size - 1);
  start = Math.max(1, end - size + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function AdminOrdersLifecycleView() {
  const trpc = useTRPC();
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const anchoredTopRef = useRef<number | null>(null);

  const profileQ = useQuery(trpc.auth.getUserProfile.queryOptions());
  const tenantOptionsQ = useQuery(
    trpc.commissions.adminTenantOptions.queryOptions({}),
  );

  const appLang: AppLang = useMemo(() => {
    const profileLang = profileQ.data?.language;
    if (profileLang) return normalizeToSupported(profileLang);
    return getInitialLanguage();
  }, [profileQ.data?.language]);

  const { locale } = useMemo(() => getLocaleAndCurrency(appLang), [appLang]);

  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
  const [customerQueryInput, setCustomerQueryInput] = useState("");
  const [appliedCustomerQuery, setAppliedCustomerQuery] = useState<
    string | undefined
  >(undefined);
  const [page, setPage] = useState(1);

  const tenantId = selectedTenantId === "all" ? undefined : selectedTenantId;
  const hasActiveFilters =
    selectedTenantId !== "all" || Boolean(appliedCustomerQuery);

  const q = useQuery(
    trpc.orders.adminListSlotLifecycle.queryOptions({
      tenantId,
      customerQuery: appliedCustomerQuery,
      page,
      limit: DEFAULT_LIMIT,
    }),
  );

  const items = q.data?.items ?? [];
  const totalPages = q.data?.totalPages ?? 1;
  const pages = totalPages > 1 ? pageWindow(page, totalPages, 5) : [];

  const captureAnchor = () => {
    anchoredTopRef.current =
      sectionRef.current?.getBoundingClientRect().top ?? null;
  };

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useLayoutEffect(() => {
    if (anchoredTopRef.current == null || !sectionRef.current) return;
    const nextTop = sectionRef.current.getBoundingClientRect().top;
    const delta = nextTop - anchoredTopRef.current;
    // Preserve the orders section position on screen when filter/query state changes above it.
    if (Math.abs(delta) > 1) window.scrollBy(0, delta);
    anchoredTopRef.current = null;
  }, [
    hasActiveFilters,
    selectedTenantId,
    appliedCustomerQuery,
    page,
    items.length,
    q.isLoading,
    q.isError,
  ]);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    captureAnchor();
    setPage(1);
    const next = customerQueryInput.trim();
    // Admin search is explicit so list queries do not refetch on every keystroke.
    setAppliedCustomerQuery(next || undefined);
  };

  const handleTenantChange = (value: string) => {
    captureAnchor();
    setSelectedTenantId(value);
    setPage(1);
  };

  const handleClear = () => {
    captureAnchor();
    setSelectedTenantId("all");
    setCustomerQueryInput("");
    setAppliedCustomerQuery(undefined);
    setPage(1);
  };

  if (q.isLoading) {
    return (
      <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">
        Loading orders...
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Failed to load orders.
      </div>
    );
  }

  return (
    <div ref={sectionRef} className="space-y-4">
      <form
        onSubmit={handleSearch}
        className="rounded-lg border bg-white p-4 flex flex-col gap-3 lg:flex-row lg:items-end"
      >
        <div className="grid gap-2 min-w-0 lg:w-[260px]">
          <label className="text-sm text-muted-foreground">Tenant</label>
          <TenantCombobox
            value={selectedTenantId}
            options={tenantOptionsQ.data ?? []}
            loading={tenantOptionsQ.isLoading}
            onChange={handleTenantChange}
          />
        </div>

        <div className="grid gap-2 min-w-0 flex-1">
          <label className="text-sm text-muted-foreground">Customer</label>
          <Input
            value={customerQueryInput}
            onChange={(e) => setCustomerQueryInput(e.target.value)}
            placeholder="Search by customer name or email"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={!hasActiveFilters}
            className={!hasActiveFilters ? "invisible pointer-events-none" : undefined}
          >
            Clear filters
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {hasActiveFilters
            ? "No orders match the current filters."
            : "No slot-lifecycle orders are available yet."}
        </div>
      ) : (
        <AdminOrdersLifecycleTable orders={items} locale={locale} />
      )}

      {items.length > 0 && totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => {
              captureAnchor();
              setPage(1);
            }}
          >
            {"<<"}
          </Button>
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => {
              captureAnchor();
              setPage((p) => Math.max(1, p - 1));
            }}
          >
            {"<"}
          </Button>

          {pages.map((p) => (
            <Button
              key={p}
              variant={p === page ? "default" : "ghost"}
              onClick={() => {
                captureAnchor();
                setPage(p);
              }}
            >
              {p}
            </Button>
          ))}

          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => {
              captureAnchor();
              setPage((p) => Math.min(totalPages, p + 1));
            }}
          >
            {">"}
          </Button>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => {
              captureAnchor();
              setPage(totalPages);
            }}
          >
            {">>"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
