"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export function OrdersLifecycleTable({ mode, orders }: Props) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-11" />
          <TableHead>{mode === "customer" ? "Provider" : "Customer"}</TableHead>
          <TableHead>Date range</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {(orders ?? []).map((o) => {
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
                      <div className="text-sm font-medium mb-2">Slots</div>

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
                          {(o.slots ?? []).map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{formatDateTime(s.start)}</TableCell>
                              <TableCell>
                                {s.serviceSnapshot?.serviceName ?? "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={statusBadgeVariant(s.serviceStatus)}
                                >
                                  {s.serviceStatus}
                                </Badge>
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
                          ))}
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
  );
}
