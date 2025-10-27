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

import { formatCurrency } from "@/modules/profile/location-utils";

type Row = {
  id: string;
  status: Order["status"];
  amount: Order["amount"]; // cents
  currency: Order["currency"]; // e.g. "eur"
  createdAt: Order["createdAt"];
  slots: (string | Booking)[];
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
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState />
        ) : (
          <OrdersTable rows={q.data as Row[]} />
        )}
      </section>
    </div>
  );
}

/* ---------- Presentational pieces ---------- */

function OrdersTable({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Slots</TableHead>
            <TableHead className="text-right">Receipt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id}>
              <TableCell>{new Date(o.createdAt).toLocaleString()}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    o.status === "paid"
                      ? "default"
                      : o.status === "refunded"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {o.status}
                </Badge>
              </TableCell>
              <TableCell>
                {/* 2) Consistent formatter (expects major units) */}
                {formatCurrency(o.amount / 100, o.currency)}
              </TableCell>
              <TableCell>
                {Array.isArray(o.slots) ? o.slots.length : 0}
              </TableCell>
              <TableCell className="text-right">
                {o.receiptUrl ? (
                  <Link
                    href={o.receiptUrl}
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
