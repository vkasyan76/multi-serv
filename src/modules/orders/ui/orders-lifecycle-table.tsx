"use client";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { BOOKING_CH } from "@/constants";
import type { NormalizedServiceStatus } from "@/modules/bookings/ui/service-status";
import {
  normalizeServiceStatus,
  SERVICE_STATUS_COLORS,
  SERVICE_STATUS_LABELS,
} from "@/modules/bookings/ui/service-status";

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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Booking, Order } from "@/payload-types";
import {
  type AppLang,
  getInitialLanguage,
  getLocaleAndCurrency,
} from "@/modules/profile/location-utils";
import { toast } from "sonner";

type Mode = "customer" | "tenant";

type ServiceStatus = Order["serviceStatus"];
type InvoiceStatus = Order["invoiceStatus"];

export type SlotLifecycleSlot = Pick<Booking, "id" | "start" | "end"> & {
  serviceStatus: ServiceStatus;
  disputeReason: string | null;
  serviceSnapshot: NonNullable<Booking["serviceSnapshot"]> | null;
};

type OrdersLifecycleRow = OrdersLifecycleCustomerRow | OrdersLifecycleTenantRow;

export type OrdersLifecycleCustomerRow = Pick<
  Order,
  "id" | "createdAt" | "serviceStatus" | "lifecycleMode" | "invoiceStatus"
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
  appLang?: AppLang;
};

type SortKey = "date" | "name" | "status" | "payment";
type SortDir = "asc" | "desc";

const EM_DASH = "\u2014";
const RANGE_ARROW = "\u2192";

function statusTextClass(s: NormalizedServiceStatus) {
  return s === "accepted" ? "text-white" : "text-slate-900";
}

function StatusBadge({ value }: { value: ServiceStatus }) {
  const st = normalizeServiceStatus(value);
  return (
    <Badge
      variant="secondary"
      className={`border-0 ${SERVICE_STATUS_COLORS[st].className} ${statusTextClass(st)}`}
    >
      {SERVICE_STATUS_LABELS[st]}
    </Badge>
  );
}

function StatusSelectItem({
  value,
  disabled,
}: {
  value: NormalizedServiceStatus;
  disabled?: boolean;
}) {
  return (
    <SelectItem value={value} disabled={disabled}>
      <span className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${SERVICE_STATUS_COLORS[value].className}`}
          aria-hidden="true"
        />
        {SERVICE_STATUS_LABELS[value]}
      </span>
    </SelectItem>
  );
}

function paymentBadgeMeta(status: InvoiceStatus | null | undefined) {
  switch (status) {
    case "paid":
      return { label: "paid", className: "bg-emerald-200 text-emerald-900" };
    case "issued":
    case "overdue":
      return { label: "payment due", className: "bg-amber-200 text-amber-900" };
    case "draft":
    case "void":
    case "none":
    default:
      return {
        label: "not invoiced yet",
        className: "bg-slate-200 text-slate-900",
      };
  }
}

function PaymentStatusBadge({ value }: { value?: InvoiceStatus | null }) {
  const meta = paymentBadgeMeta(value);
  return (
    <Badge variant="secondary" className={`border-0 ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

function formatDateTime(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getDateRange(slots: SlotLifecycleSlot[], locale: string) {
  if (!slots.length) return EM_DASH;

  const starts = slots
    .map((s) => new Date(s.start).getTime())
    .filter((t) => !Number.isNaN(t));

  const ends = slots
    .map((s) => new Date(s.end ?? s.start).getTime())
    .filter((t) => !Number.isNaN(t));

  if (!starts.length) return EM_DASH;

  const minStart = new Date(Math.min(...starts)).toISOString();
  const maxEnd = ends.length
    ? new Date(Math.max(...ends)).toISOString()
    : minStart;

  return `${formatDateTime(minStart, locale)} ${RANGE_ARROW} ${formatDateTime(maxEnd, locale)}`;
}

function getProviderLabel(order: OrdersLifecycleRow) {
  const first = order.slots?.[0];
  return first?.serviceSnapshot?.tenantName ?? EM_DASH;
}

function getCustomerLabel(order: OrdersLifecycleTenantRow) {
  const cs = order.customerSnapshot;
  const name = `${cs.firstName ?? ""} ${cs.lastName ?? ""}`.trim();
  if (name) return name;
  return cs.email ?? order.userId ?? EM_DASH;
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

function invoiceWeight(s: InvoiceStatus | null | undefined) {
  switch (s) {
    case "none":
      return 0;
    case "draft":
      return 1;
    case "void":
      return 2;
    case "issued":
      return 3;
    case "overdue":
      return 4;
    case "paid":
      return 5;
    default:
      return -1;
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

export function OrdersLifecycleTable({ mode, orders, appLang }: Props) {
  const effectiveLang = appLang ?? getInitialLanguage();
  const { locale } = getLocaleAndCurrency(effectiveLang);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "date",
    dir: "desc",
  });
  const trpc = useTRPC();
  const qc = useQueryClient();
  const nowMs = Date.now();

  const findTenantSlugForBooking = (bookingId: string) => {
    for (const order of orders ?? []) {
      const match = order.slots?.find((slot) => slot.id === bookingId);
      const slug = match?.serviceSnapshot?.tenantSlug;
      if (slug) return slug;
    }
    return undefined;
  };

  // updating the calendar when service status changes:
  const broadcastBookingUpdated = (tenantSlug: string, bookingId: string) => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return;
    }
    try {
      const ch = new BroadcastChannel(BOOKING_CH);
      ch.postMessage({
        type: "booking:updated",
        tenantSlug,
        ids: [bookingId],
        ts: Date.now(),
      });
      ch.close();
    } catch {}
  };

  // Invalidate list query broadly so all pages refresh after a slot status mutation.
  const markSlotCompleted = useMutation({
    ...trpc.bookings.vendorMarkCompleted.mutationOptions(),
    onSuccess: async (_data, variables) => {
      toast.success("Slot marked as completed.");
      if (mode === "tenant") {
        const tenantSlug = findTenantSlugForBooking(variables.bookingId);
        if (tenantSlug) {
          broadcastBookingUpdated(tenantSlug, variables.bookingId);
        }
      }
      await qc.invalidateQueries({
        queryKey: trpc.orders.listForMyTenantSlotLifecycle.queryKey(),
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update slot.");
    },
  });

  const acceptSlot = useMutation({
    ...trpc.bookings.customerAcceptSlot.mutationOptions(),
    onSuccess: async (_data, variables) => {
      toast.success("Slot accepted.");
      if (mode === "customer") {
        const tenantSlug = findTenantSlugForBooking(variables.bookingId);
        if (tenantSlug) {
          broadcastBookingUpdated(tenantSlug, variables.bookingId);
        }
      }
      await qc.invalidateQueries({
        queryKey: trpc.orders.listMineSlotLifecycle.queryKey(),
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to accept slot.");
    },
  });

  const disputeSlot = useMutation({
    ...trpc.bookings.customerDisputeSlot.mutationOptions(),
    onSuccess: async (_data, variables) => {
      toast.success("Dispute submitted.");
      if (mode === "customer") {
        const tenantSlug = findTenantSlugForBooking(variables.bookingId);
        if (tenantSlug) {
          broadcastBookingUpdated(tenantSlug, variables.bookingId);
        }
      }
      await qc.invalidateQueries({
        queryKey: trpc.orders.listMineSlotLifecycle.queryKey(),
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to dispute slot.");
    },
  });

  const sortedOrders = useMemo(() => {
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
      } else if (sort.key === "payment") {
        av = invoiceWeight(a.invoiceStatus);
        bv = invoiceWeight(b.invoiceStatus);
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
    <div className="relative max-h-[70vh] overflow-auto rounded-lg border bg-background">
      <table className="w-full caption-bottom text-sm table-fixed">
        <colgroup>
          <col className="w-11" />
          <col className="w-[180px]" />
          <col className="w-[360px]" />
          <col className="w-[140px]" />
          <col className="w-[140px]" />
          <col className="w-[180px]" />
        </colgroup>
        <TableHeader className="border-b">
          <TableRow>
            <TableHead className="sticky top-0 z-20 bg-background w-11" />
            <TableHead className="sticky top-0 z-20 bg-background">
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
            <TableHead className="sticky top-0 z-20 bg-background">
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
            <TableHead className="sticky top-0 z-20 bg-background">
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
            <TableHead className="sticky top-0 z-20 bg-background">
              <Button
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => toggleSort("payment")}
              >
                Payment
                <SortIcon active={sort.key === "payment"} dir={sort.dir} />
              </Button>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-background text-right whitespace-nowrap">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {(sortedOrders ?? []).map((o) => {
            const isOpen = !!open[o.id];
            const range = getDateRange(o.slots ?? [], locale);

            const label =
              mode === "customer"
                ? getProviderLabel(o)
                : getCustomerLabel(o as OrdersLifecycleTenantRow);

            return (
              <Fragment key={o.id}>
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
                  <TableCell className="pr-6">{range}</TableCell>

                  <TableCell>
                    <StatusBadge value={o.serviceStatus} />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge value={o.invoiceStatus} />
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      {mode === "tenant" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex w-full max-w-[140px]">
                              <Button
                                size="sm"
                                variant="neubrutalism"
                                className="w-full"
                                disabled={o.serviceStatus !== "accepted"}
                              >
                                Request payment
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {o.serviceStatus !== "accepted" ? (
                            <TooltipContent side="top" sideOffset={6}>
                              You can request payment after user acceptance.
                            </TooltipContent>
                          ) : null}
                        </Tooltip>
                      ) : (
                        <span className="inline-flex w-full max-w-[140px]">
                          <Button
                            size="sm"
                            variant="neubrutalism"
                            className="w-full"
                          >
                            Pay
                          </Button>
                        </span>
                      )}
                      <span aria-hidden="true" className="inline-block w-5" />
                    </div>
                  </TableCell>
                </TableRow>

                {/* expanded panel */}
                {isOpen && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                      <div className="py-2">
                        <table className="w-full caption-bottom text-sm table-fixed">
                          <colgroup>
                            <col className="w-11" />
                            <col className="w-[180px]" />
                            <col className="w-[360px]" />
                            <col className="w-[140px]" />
                            <col className="w-[140px]" />
                            <col className="w-[180px]" />
                          </colgroup>
                          <TableHeader>
                            <TableRow>
                              <TableHead aria-hidden="true" />
                              <TableHead>Date/time</TableHead>
                              <TableHead>Service</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead aria-hidden="true" />
                              <TableHead aria-hidden="true" />
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {(o.slots ?? []).map((s) => {
                              const endMs = new Date(
                                s.end ?? s.start,
                              ).getTime();
                              const canCompleteNow =
                                Number.isFinite(endMs) && endMs <= nowMs;
                              const normalizedStatus = normalizeServiceStatus(
                                s.serviceStatus,
                              );
                              const isScheduled =
                                normalizedStatus === "scheduled";
                              const showTenantSelect =
                                mode === "tenant" && isScheduled;
                              const disableTenantSelect =
                                !canCompleteNow || markSlotCompleted.isPending;
                              const showCustomerSelect =
                                mode === "customer" &&
                                normalizedStatus === "completed";
                              const disableCustomerSelect =
                                acceptSlot.isPending || disputeSlot.isPending;

                              return (
                                <TableRow key={s.id}>
                                  <TableCell aria-hidden="true" />
                                  <TableCell>
                                    {formatDateTime(s.start, locale)}
                                  </TableCell>
                                  <TableCell>
                                    {s.serviceSnapshot?.serviceName ?? EM_DASH}
                                  </TableCell>
                                  <TableCell>
                                    <div className="h-10 flex items-center">
                                      {showTenantSelect ? (
                                        <Select
                                          value={normalizedStatus}
                                          onValueChange={(value) => {
                                            if (value !== "completed") return;
                                            if (disableTenantSelect) return;
                                            markSlotCompleted.mutate({
                                              bookingId: s.id,
                                            });
                                          }}
                                          disabled={disableTenantSelect}
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <StatusSelectItem value="scheduled" />
                                            <StatusSelectItem value="completed" />
                                          </SelectContent>
                                        </Select>
                                      ) : showCustomerSelect ? (
                                        <Select
                                          value={normalizedStatus}
                                          onValueChange={(value) => {
                                            if (value === "accepted") {
                                              acceptSlot.mutate({
                                                bookingId: s.id,
                                              });
                                              return;
                                            }
                                            if (value === "disputed") {
                                              const reason = window
                                                .prompt(
                                                  "Reason for dispute (optional)",
                                                )
                                                ?.trim();
                                              if (reason === undefined) return;
                                              disputeSlot.mutate({
                                                bookingId: s.id,
                                                reason: reason || undefined,
                                              });
                                            }
                                          }}
                                          disabled={disableCustomerSelect}
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <StatusSelectItem
                                              value="completed"
                                              disabled
                                            />
                                            <StatusSelectItem value="accepted" />
                                            <StatusSelectItem value="disputed" />
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <StatusBadge value={s.serviceStatus} />
                                      )}
                                    </div>
                                    {normalizedStatus === "disputed" &&
                                    s.disputeReason ? (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {s.disputeReason}
                                      </div>
                                    ) : null}
                                  </TableCell>
                                  <TableCell aria-hidden="true" />
                                  <TableCell aria-hidden="true" />
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </table>
    </div>
  );
}



