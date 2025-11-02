"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Home, ExternalLink, MoreHorizontal } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { generateTenantUrl } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

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
    enabled: !!session.data?.user?.id, // <— only after mount
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Flatten orders → slot rows
  const slotRows: SlotRow[] = (q.data ?? []).flatMap((o) => {
    const slots = (o.slots ?? [])
      .map((s) => (typeof s === "string" ? null : (s as Booking)))
      .filter(Boolean) as Booking[];

    // Use the first row (latest order) just to power the “public page” icon in the top bar.
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
      {/* Top bar — icons left, white bg for consistency */}
      <nav className="bg-white w-full border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 h-14 sm:h-16 flex items-center justify-end gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  className="p-2 rounded-full hover:bg-muted"
                  aria-label="Home"
                >
                  <Home className="h-7 w-7" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Home</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </nav>

      {/* Header */}
      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 flex flex-col gap-y-2">
          <h1 className="text-[32px] font-medium">My Orders</h1>
          {/* <p className="font-medium text-muted-foreground">
            Paid / refunded orders
          </p> */}
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

  // date on small screens
  const whenLabelShort = (startISO: string) => {
    const d = new Date(startISO);
    const date = d.toLocaleDateString(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} ${time}`;
  };

  function RowActions({ r }: { r: SlotRow }) {
    const router = useRouter();

    const goWriteReview = () => {
      // You said: one review per tenant (not per slot). Route path is up to you.
      // For now, push to a tenant-scoped review page. You can change later.
      if (!r.tenantSlug) return;
      router.push(`/tenants/${r.tenantSlug}/reviews/new`);
    };

    const requestRefund = () => {
      // TODO: wire to a protected TRPC mutation (orders.requestRefund)
      // Right now just navigate to a “request” UI or toast.
      console.log("Request refund for order:", r.orderId);
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={goWriteReview}>
            Write a review
          </DropdownMenuItem>

          <DropdownMenuItem asChild disabled={!r.tenantSlug}>
            <Link href={r.tenantSlug ? generateTenantUrl(r.tenantSlug) : "#"}>
              Contact provider
            </Link>
          </DropdownMenuItem>

          {/* Mobile-only: keep receipt accessible when the column is hidden */}
          <DropdownMenuItem
            asChild
            className="md:hidden"
            disabled={!r.receiptUrl}
          >
            <Link
              href={r.receiptUrl ?? "#"}
              target={r.receiptUrl ? "_blank" : undefined}
            >
              View receipt
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={requestRefund}
            disabled={r.status !== "paid"}
          >
            Request refund
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead className="hidden md:table-cell">Service(s)</TableHead>
            <TableHead>When</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="hidden md:table-cell text-right">
              Receipt
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.orderId}-${r.whenStart}`}>
              <TableCell className="truncate">
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

                {/* mobile-only secondary line */}
                <div className="md:hidden text-[12px] text-muted-foreground line-clamp-1">
                  {r.serviceName || "—"}
                </div>
              </TableCell>

              <TableCell className="hidden md:table-cell truncate">
                {r.serviceName || "—"}
              </TableCell>
              <TableCell suppressHydrationWarning className="whitespace-nowrap">
                <span className="hidden md:inline">
                  {whenLabel(r.whenStart)}
                </span>
                <span className="md:hidden text-sm">
                  {whenLabelShort(r.whenStart)}
                </span>
              </TableCell>
              <TableCell className="text-center">
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

              <TableCell
                className="text-right tabular-nums whitespace-nowrap shrink-0"
                suppressHydrationWarning
              >
                {formatCurrency(r.amount / 100, r.currency)}
              </TableCell>

              <TableCell className="hidden md:table-cell text-right whitespace-nowrap">
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
              {/* Actions menu */}
              <TableCell className="text-right">
                <RowActions r={r} />
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
