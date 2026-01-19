"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Booking, Order } from "@/payload-types";

type Mode = "customer" | "tenant";

type ServiceStatus = Order["serviceStatus"];

export type SlotLifecycleSlot = Pick<Booking, "id" | "start" | "end"> & {
  serviceStatus: ServiceStatus;
  disputeReason: string | null;
  serviceSnapshot: NonNullable<Booking["serviceSnapshot"]> | null;
};

type OrdersLifecycleRow = OrdersLifecycleCustomerRow | OrdersLifecycleTenantRow;

export type OrdersLifecycleCustomerRow = Pick<
  Order,
  "id" | "createdAt" | "serviceStatus" | "lifecycleMode"
> & {
  slots: SlotLifecycleSlot[];
};

export type OrdersLifecycleTenantRow = OrdersLifecycleCustomerRow & {
  userId: string;
  customerSnapshot: Order["customerSnapshot"];
};

type Props = {
  mode: Mode;
  orders: Array<OrdersLifecycleCustomerRow | OrdersLifecycleTenantRow>;
};

type SortKey = "date" | "name" | "status";
type SortDir = "asc" | "desc";

function statusBadgeVariant(s: ServiceStatus) {
  // keep it simple (you can style variants later)
  return s === "disputed" ? "destructive" : "secondary";
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getDateRange(slots: SlotLifecycleSlot[]) {
  if (!slots.length) return "—";

  const starts = slots
    .map((s) => new Date(s.start).getTime())
    .filter((t) => !Number.isNaN(t));

  const ends = slots
    .map((s) => new Date(s.end ?? s.start).getTime())
    .filter((t) => !Number.isNaN(t));

  if (!starts.length) return "—";

  const minStart = new Date(Math.min(...starts)).toISOString();
  const maxEnd = ends.length
    ? new Date(Math.max(...ends)).toISOString()
    : minStart;

  return `${formatDateTime(minStart)} → ${formatDateTime(maxEnd)}`;
}

function getProviderLabel(order: OrdersLifecycleRow) {
  const first = order.slots?.[0];
  return first?.serviceSnapshot?.tenantName ?? "—";
}

function getCustomerLabel(order: OrdersLifecycleTenantRow) {
  const cs = order.customerSnapshot;
  const name = `${cs.firstName ?? ""} ${cs.lastName ?? ""}`.trim();
  if (name) return name;
  return cs.email ?? order.userId ?? "—";
}

function getMinStartMs(slots: SlotLifecycleSlot[]) {
  const starts = slots
    .map((s) => new Date(s.start).getTime())
    .filter((t) => Number.isFinite(t));

  if (!starts.length) return Number.POSITIVE_INFINITY;

  return Math.min(...starts);
}

function getMaxEndMs(slots: SlotLifecycleSlot[]) {
  const ends = slots
    .map((s) => new Date(s.end ?? s.start).getTime())
    .filter((t) => Number.isFinite(t));

  if (!ends.length) return Number.POSITIVE_INFINITY;

  return Math.max(...ends);
}

function statusWeight(s: ServiceStatus) {
  switch (s) {
    case "scheduled":
      return 1;
    case "completed":
      return 2;
    case "accepted":
      return 3;
    case "disputed":
      return 4;
    default:
      return 0;
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 h-4 w-4 opacity-70" />
  ) : (
    <ArrowDown className="ml-1 h-4 w-4 opacity-70" />
  );
}

export function OrdersLifecycleTable({ mode, orders }: Props) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({
    key: "date",
    dir: "asc",
  });
  const trpc = useTRPC();
  const qc = useQueryClient();
  const nowMs = Date.now();

  const markSlotCompleted = useMutation({
    ...trpc.bookings.vendorMarkCompleted.mutationOptions(),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: trpc.orders.listForMyTenantSlotLifecycle.queryKey(),
      });
    },
  });

  const sortedOrders = React.useMemo(() => {
    const list = [...(orders ?? [])];

    list.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";

      if (sort.key === "date") {
        av = getMinStartMs(a.slots ?? []);
        bv = getMinStartMs(b.slots ?? []);
      } else if (sort.key === "status") {
        av = statusWeight(a.serviceStatus);
        bv = statusWeight(b.serviceStatus);
      } else {
        av =
          mode === "customer"
            ? getProviderLabel(a)
            : getCustomerLabel(a as OrdersLifecycleTenantRow);
        bv =
          mode === "customer"
            ? getProviderLabel(b)
            : getCustomerLabel(b as OrdersLifecycleTenantRow);
      }

      let cmp = 0;

      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, {
          sensitivity: "base",
        });
      }

      if (cmp === 0 && sort.key === "date") {
        const aEnd = getMaxEndMs(a.slots ?? []);
        const bEnd = getMaxEndMs(b.slots ?? []);
        cmp = aEnd - bEnd;
      }

      if (cmp === 0) cmp = a.id.localeCompare(b.id);

      return sort.dir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [orders, sort, mode]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border bg-background">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background border-b">
        <TableRow>
          <TableHead className="w-11" />
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              className="px-0"
              onClick={() => toggleSort("name")}
            >
              {mode === "customer" ? "Provider" : "Customer"}
              <SortIcon active={sort.key === "name"} dir={sort.dir} />
            </Button>
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              className="px-0"
              onClick={() => toggleSort("date")}
            >
              Date range
              <SortIcon active={sort.key === "date"} dir={sort.dir} />
            </Button>
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              className="px-0"
              onClick={() => toggleSort("status")}
            >
              Status
              <SortIcon active={sort.key === "status"} dir={sort.dir} />
            </Button>
          </TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {(sortedOrders ?? []).map((o) => {
          const isOpen = !!open[o.id];
          const range = getDateRange(o.slots ?? []);

          const label =
            mode === "customer"
              ? getProviderLabel(o)
              : getCustomerLabel(o as OrdersLifecycleTenantRow);

          return (
            <React.Fragment key={o.id}>
              {/* summary row */}
              <TableRow>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggle(o.id)}
                    aria-label={isOpen ? "Collapse order" : "Expand order"}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>

                <TableCell className="font-medium">{label}</TableCell>
                <TableCell>{range}</TableCell>

                <TableCell>
                  <Badge variant={statusBadgeVariant(o.serviceStatus)}>
                    {o.serviceStatus}
                  </Badge>
                </TableCell>

                <TableCell className="text-right text-muted-foreground">
                  {/* Stage 2 keeps this empty; Stage 3 will add buttons */}—
                </TableCell>
              </TableRow>

              {/* expanded panel */}
              {isOpen && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-muted/30">
                    <div className="py-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date/time</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {(o.slots ?? []).map((s) => {
                            const endMs = new Date(s.end ?? s.start).getTime();
                            const canCompleteNow =
                              Number.isFinite(endMs) && endMs <= nowMs;
                            const isScheduled = s.serviceStatus === "scheduled";
                            const showSelect = mode === "tenant" && isScheduled;
                            const disableSelect =
                              !canCompleteNow || markSlotCompleted.isPending;

                            return (
                              <TableRow key={s.id}>
                                <TableCell>{formatDateTime(s.start)}</TableCell>
                                <TableCell>
                                  {s.serviceSnapshot?.serviceName ?? "—"}
                                </TableCell>
                                <TableCell>
                                  {showSelect ? (
                                    <Select
                                      value={s.serviceStatus}
                                      onValueChange={(value) => {
                                        if (value !== "completed") return;
                                        if (disableSelect) return;
                                        markSlotCompleted.mutate({
                                          bookingId: s.id,
                                        });
                                      }}
                                      disabled={disableSelect}
                                    >
                                      <SelectTrigger className="w-40">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="scheduled">
                                          scheduled
                                        </SelectItem>
                                        <SelectItem value="completed">
                                          completed
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge
                                      variant={statusBadgeVariant(
                                        s.serviceStatus,
                                      )}
                                    >
                                      {s.serviceStatus}
                                    </Badge>
                                  )}
                                  {s.serviceStatus === "disputed" &&
                                  s.disputeReason ? (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {s.disputeReason}
                                    </div>
                                  ) : null}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {/* Stage 3 adds per-slot actions */}—
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
        </TableBody>
      </Table>
    </div>
  );
}
