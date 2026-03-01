"use client";

import { Badge } from "@/components/ui/badge";
import type { Booking, Order } from "@/payload-types";
import type { NormalizedServiceStatus } from "@/modules/bookings/ui/service-status";
import {
  SERVICE_STATUS_COLORS,
  SERVICE_STATUS_LABELS,
} from "@/modules/bookings/ui/service-status";

export const EM_DASH = "\u2014";
const RANGE_ARROW = "\u2192";

export type OrderServiceStatus = Order["serviceStatus"];
export type InvoiceStatus = Order["invoiceStatus"];
export type SlotServiceStatus = NormalizedServiceStatus;

export type SlotLifecycleSlot = Pick<Booking, "id" | "start" | "end"> & {
  serviceStatus: SlotServiceStatus;
  disputeReason: string | null;
  serviceSnapshot: NonNullable<Booking["serviceSnapshot"]> | null;
};

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

export type OrdersLifecycleAdminRow = OrdersLifecycleTenantRow & {
  tenantId?: string;
  tenantName?: string;
  tenantSlug?: string;
};

// Keep badge rendering shared so tenant and admin lifecycle tables stay visually aligned.
function normalizeDisplayServiceStatus(
  value: OrderServiceStatus | SlotServiceStatus | null | undefined,
): NormalizedServiceStatus {
  if (value === "completed" || value === "accepted" || value === "disputed") {
    return value;
  }
  return "scheduled";
}

function statusTextClass(s: NormalizedServiceStatus) {
  return s === "accepted" ? "text-white" : "text-slate-900";
}

export function StatusBadge({
  value,
}: {
  value: OrderServiceStatus | SlotServiceStatus;
}) {
  const st = normalizeDisplayServiceStatus(value);
  return (
    <Badge
      variant="secondary"
      className={`border-0 ${SERVICE_STATUS_COLORS[st].className} ${statusTextClass(st)}`}
    >
      {SERVICE_STATUS_LABELS[st]}
    </Badge>
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

export function PaymentStatusBadge({
  value,
}: {
  value?: InvoiceStatus | null;
}) {
  const meta = paymentBadgeMeta(value);
  return (
    <Badge variant="secondary" className={`border-0 ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

export function formatDateTime(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    // Keep lifecycle rows rendering if an unexpected locale slips through.
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
}

export function getDateRange(slots: SlotLifecycleSlot[], locale: string) {
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

export function getProviderLabel(order: OrdersLifecycleCustomerRow) {
  const first = order.slots?.[0];
  return first?.serviceSnapshot?.tenantName ?? EM_DASH;
}

export function getCustomerLabel(order: OrdersLifecycleTenantRow) {
  const cs = order.customerSnapshot;
  const name = `${cs.firstName ?? ""} ${cs.lastName ?? ""}`.trim();
  if (name) return name;
  return cs.email ?? order.userId ?? EM_DASH;
}

export function getTenantLabel(order: OrdersLifecycleAdminRow) {
  return order.tenantName ?? order.tenantSlug ?? EM_DASH;
}
