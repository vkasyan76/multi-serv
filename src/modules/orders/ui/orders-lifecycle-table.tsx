"use client";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { BOOKING_CH } from "@/constants";
import type { NormalizedServiceStatus } from "@/modules/bookings/ui/service-status";
import {
  normalizeServiceStatus,
  SERVICE_STATUS_COLORS,
} from "@/modules/bookings/ui/service-status";

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
import type { AppLang } from "@/lib/i18n/app-lang";
import { getLocaleAndCurrency } from "@/lib/i18n/locale";
import { withLocalePrefix } from "@/i18n/routing";
import { toast } from "sonner";
import {
  CanceledBadge,
  canShowSelfCancelAction,
  type OrdersLifecycleBaseSortKey,
  type OrdersLifecycleSortDir,
  type OrdersLifecycleCustomerRow,
  type OrdersLifecycleTenantRow,
  EM_DASH,
  OrdersLifecycleSortIcon,
  PaymentStatusBadge,
  StatusBadge,
  formatDateTime,
  getCustomerLabel,
  getDateRange,
  getProviderLabel,
  sortOrdersLifecycleRows,
} from "./orders-lifecycle-shared";

type Mode = "customer" | "tenant";
type RequestDecision = "confirm" | "decline";

type Props = {
  mode: Mode;
  orders: Array<OrdersLifecycleCustomerRow | OrdersLifecycleTenantRow>;
  appLang: AppLang;
};

function StatusSelectItem({
  value,
  label,
  disabled,
}: {
  value: NormalizedServiceStatus;
  label: string;
  disabled?: boolean;
}) {
  return (
    <SelectItem value={value} disabled={disabled}>
      <span className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${SERVICE_STATUS_COLORS[value].className}`}
          aria-hidden="true"
        />
        {label}
      </span>
    </SelectItem>
  );
}

export function OrdersLifecycleTable({ mode, orders, appLang }: Props) {
  const tOrders = useTranslations("orders");
  const { locale } = getLocaleAndCurrency(appLang);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<{
    key: OrdersLifecycleBaseSortKey;
    dir: OrdersLifecycleSortDir;
  }>({
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
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [pendingCancelOrderId, setPendingCancelOrderId] = useState<
    string | null
  >(null);
  const [cancelReason, setCancelReason] = useState("");
  const [requestDecisionDialogOpen, setRequestDecisionDialogOpen] =
    useState(false);
  const [pendingRequestDecision, setPendingRequestDecision] = useState<{
    orderId: string;
    type: RequestDecision;
  } | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const getStatusLabel = (
    value:
      | OrdersLifecycleCustomerRow["serviceStatus"]
      | NormalizedServiceStatus
      | null
      | undefined,
  ) => {
    switch (normalizeServiceStatus(value)) {
      case "requested":
        return tOrders("status.requested");
      case "completed":
        return tOrders("status.completed");
      case "accepted":
        return tOrders("status.accepted");
      case "disputed":
        return tOrders("status.disputed");
      case "scheduled":
      default:
        return tOrders("status.scheduled");
    }
  };

  const getPaymentStatusLabel = (
    value: OrdersLifecycleCustomerRow["invoiceStatus"] | null | undefined,
  ) => {
    switch (value) {
      case "paid":
        return tOrders("payment_status.paid");
      case "issued":
      case "overdue":
        return tOrders("payment_status.payment_due");
      case "draft":
      case "void":
      case "none":
      default:
        return tOrders("payment_status.not_invoiced_yet");
    }
  };

  const findTenantSlugForBooking = (bookingId: string) => {
    for (const order of orders ?? []) {
      const match = order.slots?.find((slot) => slot.id === bookingId);
      const slug = match?.serviceSnapshot?.tenantSlug;
      if (slug) return slug;
    }
    return undefined;
  };

  const findOrder = (orderId: string) =>
    (orders ?? []).find((order) => order.id === orderId);

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

  const broadcastOrderBookingsUpdated = (
    order: OrdersLifecycleCustomerRow | OrdersLifecycleTenantRow | undefined,
  ) => {
    const slotIds = (order?.slots ?? []).map((slot) => slot.id);
    const tenantSlug =
      order?.slots
        ?.find((slot) => slot.serviceSnapshot?.tenantSlug)
        ?.serviceSnapshot?.tenantSlug ?? undefined;

    if (
      !tenantSlug ||
      slotIds.length === 0 ||
      typeof window === "undefined" ||
      !("BroadcastChannel" in window)
    ) {
      return;
    }

    try {
      const ch = new BroadcastChannel(BOOKING_CH);
      ch.postMessage({
        type: "booking:updated",
        tenantSlug,
        ids: slotIds,
        ts: Date.now(),
      });
      ch.close();
    } catch {}
  };

  // Invalidate list query broadly so all pages refresh after a slot status mutation.
  const markSlotCompleted = useMutation({
    ...trpc.bookings.vendorMarkCompleted.mutationOptions(),
    onSuccess: async (_data, variables) => {
      toast.success(tOrders("toasts.slot_completed"));
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
    onError: () => {
      toast.error(tOrders("toasts.slot_update_failed"));
    },
  });

  const acceptSlot = useMutation({
    ...trpc.bookings.customerAcceptSlot.mutationOptions(),
    onSuccess: async (_data, variables) => {
      toast.success(tOrders("toasts.slot_accepted"));
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
    onError: () => {
      toast.error(tOrders("toasts.slot_accept_failed"));
    },
  });

  const disputeSlot = useMutation({
    ...trpc.bookings.customerDisputeSlot.mutationOptions(),
    onSuccess: async (_data, variables) => {
      toast.success(tOrders("toasts.dispute_submitted"));
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
    onError: () => {
      toast.error(tOrders("toasts.dispute_failed"));
    },
  });

  const getCancelErrorToast = (error: unknown) => {
    const key =
      typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

    switch (key) {
      case "orders.errors.cancel_cutoff_passed":
        return tOrders("toasts.cancel_cutoff_passed");
      case "orders.errors.cancel_payment_locked":
        return tOrders("toasts.cancel_payment_locked");
      case "orders.errors.cancel_already_canceled":
        return tOrders("toasts.cancel_already_canceled");
      case "orders.errors.cancel_invalid_slots":
        return tOrders("toasts.cancel_invalid_slots");
      case "orders.errors.cancel_release_failed":
        return tOrders("toasts.cancel_release_failed");
      case "orders.errors.cancel_not_allowed":
      default:
        return tOrders("toasts.cancel_failed");
    }
  };

  const customerCancelOrder = useMutation({
    ...trpc.orders.customerCancelSlotOrder.mutationOptions(),
    onSuccess: async (_data, variables) => {
      const canceledOrder = (orders ?? []).find(
        (order) => order.id === variables.orderId,
      );
      toast.success(
        canceledOrder?.serviceStatus === "requested"
          ? tOrders("toasts.request_canceled")
          : tOrders("toasts.order_canceled"),
      );
      setCancelDialogOpen(false);
      setPendingCancelOrderId(null);
      setCancelReason("");
      await qc.invalidateQueries({
        queryKey: trpc.orders.listMineSlotLifecycle.queryKey(),
      });
    },
    onError: (error) => {
      toast.error(getCancelErrorToast(error));
    },
  });

  const tenantCancelOrder = useMutation({
    ...trpc.orders.tenantCancelSlotOrder.mutationOptions(),
    onSuccess: async () => {
      toast.success(tOrders("toasts.order_canceled"));
      setCancelDialogOpen(false);
      setPendingCancelOrderId(null);
      setCancelReason("");
      await qc.invalidateQueries({
        queryKey: trpc.orders.listForMyTenantSlotLifecycle.queryKey(),
      });
    },
    onError: (error) => {
      toast.error(getCancelErrorToast(error));
    },
  });

  const tenantConfirmRequest = useMutation({
    ...trpc.orders.tenantConfirmSlotOrder.mutationOptions(),
    onSuccess: async (_data, variables) => {
      const order = findOrder(variables.orderId);
      toast.success(tOrders("toasts.request_confirmed"));
      setRequestDecisionDialogOpen(false);
      setPendingRequestDecision(null);
      broadcastOrderBookingsUpdated(order);
      await qc.invalidateQueries({
        queryKey: trpc.orders.listForMyTenantSlotLifecycle.queryKey(),
      });
    },
    onError: () => {
      toast.error(tOrders("toasts.request_decision_failed"));
    },
  });

  const tenantDeclineRequest = useMutation({
    ...trpc.orders.tenantDeclineSlotOrder.mutationOptions(),
    onSuccess: async (_data, variables) => {
      const order = findOrder(variables.orderId);
      toast.success(tOrders("toasts.request_declined"));
      setRequestDecisionDialogOpen(false);
      setPendingRequestDecision(null);
      setDeclineReason("");
      broadcastOrderBookingsUpdated(order);
      await qc.invalidateQueries({
        queryKey: trpc.orders.listForMyTenantSlotLifecycle.queryKey(),
      });
    },
    onError: () => {
      toast.error(tOrders("toasts.request_decision_failed"));
    },
  });

  // Tenant issues invoice for an accepted order (pay-after-acceptance flow).
  const issueInvoice = useMutation({
    ...trpc.invoices.issueForOrder.mutationOptions(),
    onSuccess: async () => {
      toast.success(tOrders("toasts.invoice_issued"));
      await qc.invalidateQueries({
        queryKey: trpc.orders.listForMyTenantSlotLifecycle.queryKey(),
      });
    },
    onError: () => {
      toast.error(tOrders("toasts.invoice_issue_failed"));
    },
  });

  // Customer starts Stripe Checkout to pay an issued invoice.
  const createInvoiceCheckout = useMutation({
    ...trpc.invoices.createCheckoutSession.mutationOptions(),
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error(tOrders("toasts.checkout_url_missing"));
      }
    },
    onError: () => {
      toast.error(tOrders("toasts.checkout_start_failed"));
    },
  });

  const sortedOrders = useMemo(() => {
    return sortOrdersLifecycleRows(orders ?? [], sort, mode);
  }, [orders, sort, mode]);
  const trimmedCancelReason = cancelReason.trim();
  const hasShortCancelReason =
    trimmedCancelReason.length > 0 && trimmedCancelReason.length < 3;
  const trimmedDeclineReason = declineReason.trim();
  const hasShortDeclineReason =
    trimmedDeclineReason.length > 0 && trimmedDeclineReason.length < 3;
  const cancelReasonHintId = hasShortCancelReason
    ? "cancel-reason-helper"
    : undefined;
  const declineReasonHintId = hasShortDeclineReason
    ? "decline-reason-helper"
    : undefined;
  const isCancelPending =
    customerCancelOrder.isPending || tenantCancelOrder.isPending;
  const isRequestDecisionPending =
    tenantConfirmRequest.isPending || tenantDeclineRequest.isPending;
  const pendingCancelOrder = (orders ?? []).find(
    (order) => order.id === pendingCancelOrderId,
  );
  const isPendingCancelRequest =
    mode === "customer" && pendingCancelOrder?.serviceStatus === "requested";
  const isDeclineDecision = pendingRequestDecision?.type === "decline";

  // Customer-only: fetch payable invoice ids per order so the Pay button can work.
  const invoiceQueries = useQueries({
    queries:
      mode === "customer"
        ? (sortedOrders ?? []).map((o) => ({
            ...trpc.invoices.getForOrder.queryOptions({ orderId: o.id }),
            // Canceled rows never surface Pay, so skip their invoice lookup too.
            enabled:
              o.status !== "canceled" &&
              ["issued", "overdue"].includes(String(o.invoiceStatus ?? "")),
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
    // Open synchronously so browsers keep the original click activation.
    const popup = window.open("", "_blank");
    if (popup) popup.opener = null;

    try {
      const invoice = await qc.fetchQuery(
        trpc.invoices.getLatestForOrderAnyStatus.queryOptions({ orderId }),
      );
      if (!invoice?.id) {
        if (popup && !popup.closed) popup.close();
        toast.error(tOrders("toasts.invoice_missing"));
        return;
      }
      const href = withLocalePrefix(`/invoices/${invoice.id}`, appLang);
      if (popup && !popup.closed) {
        popup.location.href = href;
        return;
      }
      // Fallback when the browser blocks the popup or closes it before navigation.
      window.location.assign(href);
    } catch {
      if (popup && !popup.closed) popup.close();
      toast.error(tOrders("toasts.invoice_open_failed"));
    }
  };

  const goWriteReview = (orderId: string, tenantSlug?: string) => {
    if (!tenantSlug) {
      toast.error(tOrders("toasts.review_slug_missing"));
      return;
    }
    router.push(
      withLocalePrefix(
        `/tenants/${tenantSlug}/reviews/new?order=${encodeURIComponent(orderId)}`,
        appLang,
      ),
    );
  };

  function toggleSort(key: OrdersLifecycleBaseSortKey) {
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

  const openCancelDialog = (orderId: string) => {
    setPendingCancelOrderId(orderId);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const openRequestDecisionDialog = (
    orderId: string,
    type: RequestDecision,
  ) => {
    setPendingRequestDecision({ orderId, type });
    setDeclineReason("");
    setRequestDecisionDialogOpen(true);
  };

  const submitDispute = () => {
    if (!pendingDisputeId || disputeSlot.isPending) return;
    const reason = disputeReason.trim();
    disputeSlot.mutate({
      bookingId: pendingDisputeId,
      reason: reason ? reason : undefined,
    });
  };

  const submitCancel = () => {
    if (!pendingCancelOrderId) return;
    if (hasShortCancelReason) return;

    const payload = {
      orderId: pendingCancelOrderId,
      reason: trimmedCancelReason ? trimmedCancelReason : undefined,
    };

    if (mode === "customer") {
      customerCancelOrder.mutate(payload);
      return;
    }

    tenantCancelOrder.mutate(payload);
  };

  const submitRequestDecision = () => {
    if (!pendingRequestDecision) return;
    if (isRequestDecisionPending) return;

    if (pendingRequestDecision.type === "confirm") {
      tenantConfirmRequest.mutate({ orderId: pendingRequestDecision.orderId });
      return;
    }

    if (hasShortDeclineReason) return;
    tenantDeclineRequest.mutate({
      orderId: pendingRequestDecision.orderId,
      reason: trimmedDeclineReason ? trimmedDeclineReason : undefined,
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
                {mode === "customer"
                  ? tOrders("table.provider")
                  : tOrders("table.customer")}
                <OrdersLifecycleSortIcon
                  active={sort.key === "name"}
                  dir={sort.dir}
                />
              </Button>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-background">
              <Button
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => toggleSort("date")}
              >
                {tOrders("table.date_range")}
                <OrdersLifecycleSortIcon
                  active={sort.key === "date"}
                  dir={sort.dir}
                />
              </Button>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-background">
              <Button
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => toggleSort("status")}
              >
                {tOrders("table.status")}
                <OrdersLifecycleSortIcon
                  active={sort.key === "status"}
                  dir={sort.dir}
                />
              </Button>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-background">
              <Button
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => toggleSort("payment")}
              >
                {tOrders("table.payment")}
                <OrdersLifecycleSortIcon
                  active={sort.key === "payment"}
                  dir={sort.dir}
                />
              </Button>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-background text-right whitespace-nowrap">
              {tOrders("table.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {(sortedOrders ?? []).map((o) => {
            const isOpen = !!open[o.id];
            const range = getDateRange(o.slots ?? [], locale);
            const isCanceled = o.status === "canceled";
            const canCancel = canShowSelfCancelAction(o, nowMs, {
              allowRequested: mode === "customer",
            });

            const label =
              mode === "customer"
                ? getProviderLabel(o)
                : getCustomerLabel(o as OrdersLifecycleTenantRow);
            const payableInvoice =
              mode === "customer" ? invoiceByOrderId[o.id] : null;
            const canRequestPayment =
              !isCanceled &&
              mode === "tenant" &&
              o.serviceStatus === "accepted" &&
              o.invoiceStatus === "none";
            const isTenantRequested =
              !isCanceled && mode === "tenant" && o.serviceStatus === "requested";
            const canPay =
              !isCanceled &&
              mode === "customer" &&
              ["issued", "overdue"].includes(String(o.invoiceStatus ?? "")) &&
              !!payableInvoice?.id;
            const canViewInvoice =
              !isCanceled &&
              o.invoiceStatus != null &&
              o.invoiceStatus !== "none";
            const canWriteReview = !isCanceled && o.invoiceStatus === "paid";
            const requestPaymentTooltip = tOrders("tooltips.request_payment");
            const reviewTooltip = tOrders("tooltips.write_review");
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
                      aria-label={
                        isOpen
                          ? tOrders("table.collapse")
                          : tOrders("table.expand")
                      }
                      aria-expanded={isOpen}
                      aria-controls={`order-${o.id}-details`}
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
                    {isCanceled ? (
                      <CanceledBadge label={tOrders("status.canceled")} />
                    ) : (
                      <div className="space-y-1">
                        <StatusBadge
                          value={o.serviceStatus}
                          label={getStatusLabel(o.serviceStatus)}
                        />
                        {mode === "customer" &&
                        o.serviceStatus === "requested" ? (
                          <div className="text-xs leading-snug text-muted-foreground">
                            {tOrders(
                              "table.awaiting_provider_confirmation",
                            )}
                          </div>
                        ) : mode === "tenant" &&
                          o.serviceStatus === "requested" ? (
                          <div className="text-xs leading-snug text-amber-700">
                            {tOrders("table.awaiting_your_confirmation")}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge
                      value={o.invoiceStatus}
                      label={getPaymentStatusLabel(o.invoiceStatus)}
                    />
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      {isTenantRequested ? (
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            variant="neubrutalism"
                            className="w-full max-w-[160px]"
                            onClick={() =>
                              openRequestDecisionDialog(o.id, "confirm")
                            }
                            disabled={isRequestDecisionPending}
                          >
                            <Check className="mr-1.5 h-4 w-4" />
                            {tOrders("actions.confirm_request")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full max-w-[160px]"
                            onClick={() =>
                              openRequestDecisionDialog(o.id, "decline")
                            }
                            disabled={isRequestDecisionPending}
                          >
                            <X className="mr-1.5 h-4 w-4" />
                            {tOrders("actions.decline_request")}
                          </Button>
                        </div>
                      ) : mode === "tenant" ? (
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
                                  {tOrders("actions.request_payment")}
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
                              {tOrders("actions.pay")}
                            </Button>
                          </span>
                        ) : null
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">
                              {tOrders("table.open_menu")}
                            </span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canCancel ? (
                            <>
                              <DropdownMenuItem
                                onClick={() => openCancelDialog(o.id)}
                                disabled={
                                  customerCancelOrder.isPending ||
                                  tenantCancelOrder.isPending
                                }
                              >
                                {mode === "customer" &&
                                o.serviceStatus === "requested"
                                  ? tOrders("actions.cancel_request")
                                  : tOrders("actions.cancel_order")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          ) : null}
                          <DropdownMenuItem
                            onClick={() => goViewInvoice(o.id)}
                            disabled={!canViewInvoice}
                          >
                            {tOrders("actions.view_invoice")}
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
                                  {tOrders("actions.write_review")}
                                </DropdownMenuItem>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block w-full">
                                      <DropdownMenuItem disabled>
                                        {tOrders("actions.write_review")}
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
                    <TableCell
                      id={`order-${o.id}-details`}
                      colSpan={6}
                      className="bg-muted/30 p-0"
                    >
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
                              <TableHead>{tOrders("table.date_time")}</TableHead>
                              <TableHead>{tOrders("table.service")}</TableHead>
                              <TableHead>{tOrders("table.status")}</TableHead>
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
                                !isCanceled &&
                                mode === "tenant" &&
                                isScheduled;
                              const disableTenantSelect =
                                !canCompleteNow || markSlotCompleted.isPending;
                              const showCustomerSelect =
                                !isCanceled &&
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
                                    {s.displayServiceName?.trim() ||
                                      s.serviceSnapshot?.serviceName?.trim() ||
                                      EM_DASH}
                                  </TableCell>
                                  <TableCell>
                                    <div className="h-10 flex items-center">
                                      {/* The trigger shows current state, so these labels stay on orders.status.*. */}
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
                                            <StatusSelectItem
                                              value="scheduled"
                                              label={tOrders("status.scheduled")}
                                            />
                                            <StatusSelectItem
                                              value="completed"
                                              label={tOrders("status.completed")}
                                            />
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
                                              label={tOrders("status.completed")}
                                              disabled
                                            />
                                            <StatusSelectItem
                                              value="accepted"
                                              label={tOrders("status.accepted")}
                                            />
                                            <StatusSelectItem
                                              value="disputed"
                                              label={tOrders("status.disputed")}
                                            />
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        isCanceled ? (
                                          <CanceledBadge
                                            label={tOrders("status.canceled")}
                                          />
                                        ) : (
                                          <StatusBadge
                                            value={s.serviceStatus}
                                            label={getStatusLabel(
                                              s.serviceStatus,
                                            )}
                                          />
                                        )
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
            <DialogTitle>{tOrders("dialog.dispute_title")}</DialogTitle>
            <DialogDescription>
              {tOrders("dialog.dispute_body")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">
              {tOrders("dialog.dispute_reason")}
            </Label>
            <Textarea
              id="dispute-reason"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder={tOrders("dialog.dispute_placeholder")}
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
              {tOrders("dialog.cancel")}
            </Button>
            <Button onClick={submitDispute} disabled={disputeSlot.isPending}>
              {disputeSlot.isPending
                ? tOrders("dialog.submitting")
                : tOrders("dialog.submit_dispute")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setCancelDialogOpen(false);
            setPendingCancelOrderId(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isPendingCancelRequest
                ? tOrders("dialog.cancel_request_title_customer")
                : mode === "customer"
                ? tOrders("dialog.cancel_order_title_customer")
                : tOrders("dialog.cancel_order_title_tenant")}
            </DialogTitle>
            <DialogDescription>
              {isPendingCancelRequest
                ? tOrders("dialog.cancel_request_body_customer")
                : mode === "customer"
                ? tOrders("dialog.cancel_order_body_customer")
                : tOrders("dialog.cancel_order_body_tenant")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              {tOrders("dialog.cancel_reason")}
            </Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              aria-invalid={hasShortCancelReason}
              aria-describedby={cancelReasonHintId}
              placeholder={
                mode === "customer"
                  ? tOrders("dialog.cancel_placeholder_customer")
                  : tOrders("dialog.cancel_placeholder_tenant")
              }
              rows={4}
              maxLength={500}
            />
            {hasShortCancelReason ? (
              <p
                id={cancelReasonHintId}
                className="text-sm text-destructive"
              >
                {tOrders("dialog.cancel_error_short_reason")}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={isCancelPending}
            >
              {tOrders("dialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={submitCancel}
              disabled={
                isCancelPending ||
                (!!pendingCancelOrderId && hasShortCancelReason)
              }
            >
              {isCancelPending
                ? tOrders("dialog.submitting_cancel")
                : tOrders("dialog.confirm_cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={requestDecisionDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setRequestDecisionDialogOpen(false);
            setPendingRequestDecision(null);
            setDeclineReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isDeclineDecision
                ? tOrders("dialog.decline_request_title")
                : tOrders("dialog.confirm_request_title")}
            </DialogTitle>
            <DialogDescription>
              {isDeclineDecision
                ? tOrders("dialog.decline_request_body")
                : tOrders("dialog.confirm_request_body")}
            </DialogDescription>
          </DialogHeader>
          {isDeclineDecision ? (
            <div className="space-y-2">
              <Label htmlFor="decline-reason">
                {tOrders("dialog.decline_reason")}
              </Label>
              <Textarea
                id="decline-reason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                aria-invalid={hasShortDeclineReason}
                aria-describedby={declineReasonHintId}
                placeholder={tOrders("dialog.decline_placeholder")}
                rows={4}
                maxLength={500}
              />
              {hasShortDeclineReason ? (
                <p
                  id={declineReasonHintId}
                  className="text-sm text-destructive"
                >
                  {tOrders("dialog.decline_error_short_reason")}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRequestDecisionDialogOpen(false)}
              disabled={isRequestDecisionPending}
            >
              {tOrders("dialog.cancel")}
            </Button>
            <Button
              variant={isDeclineDecision ? "destructive" : "default"}
              onClick={submitRequestDecision}
              disabled={
                isRequestDecisionPending ||
                (isDeclineDecision && hasShortDeclineReason)
              }
            >
              {isRequestDecisionPending
                ? tOrders("dialog.submitting")
                : isDeclineDecision
                  ? tOrders("dialog.decline_request")
                  : tOrders("dialog.confirm_request")}
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
