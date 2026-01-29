"use client";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  const router = useRouter();
  const nowMs = Date.now();
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [pendingDisputeId, setPendingDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

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
      setDisputeDialogOpen(false);
      setPendingDisputeId(null);
      setDisputeReason("");
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

  // Tenant issues invoice for an accepted order (pay-after-acceptance flow).
  const issueInvoice = useMutation({
    ...trpc.invoices.issueForOrder.mutationOptions(),
    onSuccess: async () => {
      toast.success("Invoice issued.");
      await qc.invalidateQueries({
        queryKey: trpc.orders.listForMyTenantSlotLifecycle.queryKey(),
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to issue invoice.");
    },
  });

  // Customer starts Stripe Checkout to pay an issued invoice.
  const createInvoiceCheckout = useMutation({
    ...trpc.invoices.createCheckoutSession.mutationOptions(),
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Checkout URL missing.");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start checkout.");
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

  // Customer-only: fetch payable invoice ids per order so the Pay button can work.
  const invoiceQueries = useQueries({
    queries:
      mode === "customer"
        ? (sortedOrders ?? []).map((o) => ({
            ...trpc.invoices.getForOrder.queryOptions({ orderId: o.id }),
            enabled: ["issued", "overdue"].includes(
              String(o.invoiceStatus ?? ""),
            ),
          }))
        : [],
  });

  const invoiceByOrderId = useMemo(() => {
    if (mode !== "customer") return {};
    const map: Record<string, { id: string; status: string | null }> = {};
    (sortedOrders ?? []).forEach((o, idx) => {
      const data = invoiceQueries[idx]?.data as
        | { id: string; status: string | null }
        | null
        | undefined;
      const isPayable = ["issued", "overdue"].includes(
        String(o.invoiceStatus ?? ""),
      );
      if (isPayable && data?.id) map[o.id] = data;
    });
    return map;
  }, [invoiceQueries, sortedOrders, mode]);

  const goViewInvoice = async (orderId: string) => {
    try {
      const invoice = await qc.fetchQuery(
        trpc.invoices.getLatestForOrderAnyStatus.queryOptions({ orderId }),
      );
      if (!invoice?.id) {
        toast.error("No invoice found for this order yet.");
        return;
      }
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to open invoice.";
      toast.error(message);
    }
  };

  const goWriteReview = (orderId: string, tenantSlug?: string) => {
    if (!tenantSlug) {
      toast.error("Missing tenant slug for review.");
      return;
    }
    router.push(`/tenants/${tenantSlug}/reviews/new?order=${orderId}`);
  };

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

  const openDisputeDialog = (bookingId: string) => {
    setPendingDisputeId(bookingId);
    setDisputeReason("");
    setDisputeDialogOpen(true);
  };

  const submitDispute = () => {
    if (!pendingDisputeId || disputeSlot.isPending) return;
    const reason = disputeReason.trim();
    disputeSlot.mutate({
      bookingId: pendingDisputeId,
      reason: reason ? reason : undefined,
    });
  };

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
            const payableInvoice =
              mode === "customer" ? invoiceByOrderId[o.id] : null;
            const canRequestPayment =
              mode === "tenant" &&
              o.serviceStatus === "accepted" &&
              o.invoiceStatus === "none";
            const canPay =
              mode === "customer" &&
              ["issued", "overdue"].includes(String(o.invoiceStatus ?? "")) &&
              !!payableInvoice?.id;
            const canViewInvoice =
              o.invoiceStatus != null && o.invoiceStatus !== "none";
            const canWriteReview = o.invoiceStatus === "paid";
            const requestPaymentTooltip =
              o.serviceStatus !== "accepted"
                ? "You can request payment after user acceptance."
                : "Invoice already issued.";
            const reviewTooltip = "You can write a review after payment.";
            const tenantSlug =
              o.slots
                ?.find((s) => s.serviceSnapshot?.tenantSlug)
                ?.serviceSnapshot?.tenantSlug ?? undefined;

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
                        o.invoiceStatus === "none" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex w-full max-w-[140px]">
                                <Button
                                  size="sm"
                                  variant="neubrutalism"
                                  className="w-full"
                                  onClick={() => {
                                    if (!canRequestPayment) return;
                                    issueInvoice.mutate({ orderId: o.id });
                                  }}
                                  disabled={
                                    !canRequestPayment ||
                                    issueInvoice.isPending
                                  }
                                >
                                  Request payment
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!canRequestPayment ? (
                              <TooltipContent side="top" sideOffset={6}>
                                {requestPaymentTooltip}
                              </TooltipContent>
                            ) : null}
                          </Tooltip>
                        ) : null
                      ) : (
                        canPay ? (
                          <span className="inline-flex w-full max-w-[140px]">
                            <Button
                              size="sm"
                              variant="neubrutalism"
                              className="w-full"
                              onClick={() => {
                                createInvoiceCheckout.mutate({
                                  invoiceId: payableInvoice.id,
                                });
                              }}
                              disabled={createInvoiceCheckout.isPending}
                            >
                              Pay
                            </Button>
                          </span>
                        ) : null
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => goViewInvoice(o.id)}
                            disabled={!canViewInvoice}
                          >
                            View invoice
                          </DropdownMenuItem>
                          {mode === "customer" ? (
                            <>
                              <DropdownMenuSeparator />
                              {canWriteReview ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    goWriteReview(o.id, tenantSlug)
                                  }
                                  disabled={!tenantSlug}
                                >
                                  Write a review
                                </DropdownMenuItem>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block w-full">
                                      <DropdownMenuItem disabled>
                                        Write a review
                                      </DropdownMenuItem>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" sideOffset={6}>
                                    {reviewTooltip}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                                (normalizedStatus === "completed" ||
                                  normalizedStatus === "disputed");
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
                                              openDisputeDialog(s.id);
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
      <Dialog
        open={disputeDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDisputeDialogOpen(false);
            setPendingDisputeId(null);
            setDisputeReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute this slot?</DialogTitle>
            <DialogDescription>
              You can add an optional reason. This helps the provider understand
              what needs fixing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Reason (optional)</Label>
            <Textarea
              id="dispute-reason"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Share what went wrong..."
              rows={4}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisputeDialogOpen(false)}
              disabled={disputeSlot.isPending}
            >
              Cancel
            </Button>
            <Button onClick={submitDispute} disabled={disputeSlot.isPending}>
              {disputeSlot.isPending ? "Submitting..." : "Submit dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OrdersLifecycleSkeleton() {
  return (
    <div className="relative max-h-[70vh] overflow-auto rounded-lg border bg-background p-4 space-y-4">
      <div className="grid grid-cols-6 gap-4">
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-4">
          <Skeleton className="h-5" />
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



