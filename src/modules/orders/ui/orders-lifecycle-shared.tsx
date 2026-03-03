"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
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
type ServiceStatus = Order["serviceStatus"];

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

export type OrdersLifecycleBaseSortKey =
  | "date"
  | "name"
  | "status"
  | "payment";
export type OrdersLifecycleAdminSortKey =
  | OrdersLifecycleBaseSortKey
  | "created"
  | "tenant";
export type OrdersLifecycleSortDir = "asc" | "desc";

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

export function formatCompactDate(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
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
  // Keep a usable provider label even if the tenant name snapshot is blank.
  return (
    (first?.serviceSnapshot?.tenantName ??
      first?.serviceSnapshot?.tenantSlug ??
      "").trim() || EM_DASH
  );
}

export function getCustomerLabel(order: OrdersLifecycleTenantRow) {
  const cs = order.customerSnapshot;
  const name = `${cs.firstName ?? ""} ${cs.lastName ?? ""}`.trim();
  if (name) return name;
  return cs.email ?? order.userId ?? EM_DASH;
}

export function getTenantLabel(order: OrdersLifecycleAdminRow) {
  return (order.tenantName ?? order.tenantSlug ?? "").trim() || EM_DASH;
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

export function OrdersLifecycleSortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: OrdersLifecycleSortDir;
}) {
  if (!active) return <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 h-4 w-4 opacity-70" />
  ) : (
    <ArrowDown className="ml-1 h-4 w-4 opacity-70" />
  );
}

// Tenant sort behavior is shared verbatim so admin stays aligned on the common columns.
export function sortOrdersLifecycleRows<
  T extends OrdersLifecycleCustomerRow | OrdersLifecycleTenantRow,
>(
  rows: T[],
  sort: {
    key: OrdersLifecycleBaseSortKey;
    dir: OrdersLifecycleSortDir;
  },
  mode: "customer" | "tenant",
) {
  const list = [...rows];

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
}

export function sortAdminOrdersLifecycleRows(
  rows: OrdersLifecycleAdminRow[],
  sort: {
    key: OrdersLifecycleAdminSortKey;
    dir: OrdersLifecycleSortDir;
  },
) {
  const list = [...rows];

  list.sort((a, b) => {
    let av: number | string = "";
    let bv: number | string = "";

    if (sort.key === "tenant") {
      av = getTenantLabel(a);
      bv = getTenantLabel(b);
    } else if (sort.key === "created") {
      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      // Invalid timestamps should not outrank real orders in the default newest-first admin view.
      av = Number.isNaN(aCreated) ? Number.NEGATIVE_INFINITY : aCreated;
      bv = Number.isNaN(bCreated) ? Number.NEGATIVE_INFINITY : bCreated;
    } else if (sort.key === "date") {
      av = getMinStartMs(a.slots ?? []);
      bv = getMinStartMs(b.slots ?? []);
    } else if (sort.key === "status") {
      av = statusWeight(a.serviceStatus);
      bv = statusWeight(b.serviceStatus);
    } else if (sort.key === "payment") {
      av = invoiceWeight(a.invoiceStatus);
      bv = invoiceWeight(b.invoiceStatus);
    } else {
      av = getCustomerLabel(a);
      bv = getCustomerLabel(b);
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
}
