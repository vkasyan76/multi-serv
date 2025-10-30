"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ArrowLeftIcon, ExternalLink } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Order, Booking } from "@/payload-types";

import {
  formatCurrency,
  formatDateForLocale,
} from "@/modules/profile/location-utils";
import { generateTenantUrl } from "@/lib/utils";

type SlotRow = {
  orderId: string;
  vendorName: string; // from first slot's serviceSnapshot.tenantName
  tenantSlug?: string; // used to build public URL
  serviceName: string; // slot subcategory name
  whenStart: string; // ISO
  status: Order["status"];
  amount: Order["amount"]; // cents (total order amount; repeated per slot)
  currency: Order["currency"];
  receiptUrl: Order["receiptUrl"];
};

export function OrdersView() {
  const trpc = useTRPC();

  // 1) Consistent: gate orders query by tRPC session (same as search-input.tsx)
  const session = useQuery(trpc.auth.session.queryOptions());

  const q = useQuery({
    ...trpc.orders.listMine.queryOptions(),
    enabled: !!session.data?.user?.id, // don't call for guests
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Flatten orders → slot rows
  const slotRows: SlotRow[] = (q.data ?? []).flatMap((o) => {
    const slots = (o.slots ?? [])
      .map((s) => (typeof s === "string" ? null : (s as Booking)))
      .filter(Boolean) as Booking[];

    const first = slots[0];
    const vendorName = first?.serviceSnapshot?.tenantName ?? ""; // one tenant per order (your assumption)

    const tenantSlug =
      first?.serviceSnapshot?.tenantSlug ??
      (typeof first?.tenant !== "string" ? (first?.tenant?.slug ?? "") : "");

    return slots.map((s) => ({
      orderId: o.id,
      vendorName,
      tenantSlug,
      serviceName:
        s.serviceSnapshot?.serviceName ||
        (typeof s.service !== "string" ? (s.service?.name ?? "") : ""),
      whenStart: s.start,
      status: o.status,
      amount: o.amount,
      currency: o.currency,
      receiptUrl: o.receiptUrl ?? null,
    }));
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <nav className="p-4 bg-[#F4F4F0] w-full border-b">
        <Link prefetch href="/" className="flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          <span className="text font-medium">Continue browsing</span>
        </Link>
      </nav>

      {/* Header */}
      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 flex flex-col gap-y-2">
          <h1 className="text-[40px] font-medium">My Orders</h1>
          <p className="font-medium text-muted-foreground">
            Paid / refunded orders
          </p>
        </div>
      </header>

      {/* Content */}
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        {q.isLoading ? (
          <OrdersTableSkeleton />
        ) : q.isError ? (
          <p className="text-sm text-destructive">Couldn’t load orders.</p>
        ) : slotRows.length === 0 ? (
          <EmptyState />
        ) : (
          <OrdersTable rows={slotRows} />
        )}
      </section>
    </div>
  );
}

/* ---------- Presentational pieces ---------- */

function OrdersTable({ rows }: { rows: SlotRow[] }) {
  const whenLabel = (startISO: string) => {
    const date = formatDateForLocale(startISO, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const start = new Date(startISO).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} ${start}`;
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead>Service(s)</TableHead>
            <TableHead className="w-[240px]">When</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead className="text-right">Receipt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.orderId}-${r.whenStart}`}>
              <TableCell>
                {r.tenantSlug ? (
                  <Link
                    href={generateTenantUrl(r.tenantSlug)}
                    className="underline underline-offset-2"
                  >
                    {r.vendorName || r.tenantSlug}
                  </Link>
                ) : (
                  r.vendorName || "—"
                )}
              </TableCell>
              {/* link to tenant public page */}
              <TableCell>{r.serviceName || "—"}</TableCell>
              <TableCell>{whenLabel(r.whenStart)}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    r.status === "paid"
                      ? "default"
                      : r.status === "refunded"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {r.status}
                </Badge>
              </TableCell>
              <TableCell>
                {formatCurrency(r.amount / 100, r.currency)}
              </TableCell>
              <TableCell className="text-right">
                {r.receiptUrl ? (
                  <Link
                    href={r.receiptUrl}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
                  >
                    View <ExternalLink className="size-3.5" />
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OrdersTableSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-5 gap-4">
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border bg-card p-8 text-center">
      <p className="text-lg font-medium mb-2">No orders yet</p>
      <p className="text-muted-foreground">
        When you complete a booking, it will appear here.
      </p>
    </div>
  );
}
