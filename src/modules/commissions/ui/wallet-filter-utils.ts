import { addDays, startOfDay } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import {
  type AppLang,
  formatDateForLocale,
  formatMonthYearForLocale,
} from "@/modules/profile/location-utils";
import type {
  WalletPeriodFilter,
  WalletStatusFilter,
  WalletTransactionRow,
} from "./wallet-types";

const WALLET_TZ = "Europe/Berlin";
export const FULL_HISTORY_LABEL = "Full History";
export const WALLET_STATUS_LABELS: Record<WalletStatusFilter, string> = {
  all: "All",
  paid: "Paid",
  payment_due: "Payment due",
  platform_fee: "Fees",
};

export function getWalletStatusLabel(status: WalletStatusFilter) {
  return WALLET_STATUS_LABELS[status];
}

export function toBerlinRangeIso(start?: Date, end?: Date) {
  const startIso = start
    ? fromZonedTime(startOfDay(start), WALLET_TZ).toISOString()
    : undefined;
  // End is exclusive: next day at 00:00 Berlin to include the selected end date.
  const endIso = end
    ? fromZonedTime(startOfDay(addDays(end, 1)), WALLET_TZ).toISOString()
    : undefined;

  return { startIso, endIso };
}

function toBerlinStartIso(date: Date) {
  return fromZonedTime(startOfDay(date), WALLET_TZ).toISOString();
}

export function deriveInvoiceRangeDates(period: WalletPeriodFilter) {
  switch (period.mode) {
    case "year":
      return period.year
        ? {
            start: new Date(period.year, 0, 1),
            end: new Date(period.year + 1, 0, 1),
          }
        : { start: undefined, end: undefined };
    case "month":
      return period.year && period.month
        ? {
            start: new Date(period.year, period.month - 1, 1),
            end: new Date(period.year, period.month, 1),
          }
        : { start: undefined, end: undefined };
    case "range":
      return { start: period.start, end: period.end };
    case "all":
    default:
      return { start: undefined, end: undefined };
  }
}

export function deriveInvoiceRangeIso(period: WalletPeriodFilter) {
  const { start, end } = deriveInvoiceRangeDates(period);
  if (!start) return { startIso: undefined, endIso: undefined };

  if (period.mode === "range") {
    return toBerlinRangeIso(start, end);
  }

  return {
    startIso: toBerlinStartIso(start),
    endIso: end ? toBerlinStartIso(end) : undefined,
  };
}

export function formatPeriodLabel(period: WalletPeriodFilter, appLang: AppLang) {
  if (period.mode === "year") {
    return period.year ? String(period.year) : "";
  }
  if (period.mode === "month") {
    if (!period.year || !period.month) return "";
    const date = new Date(period.year, period.month - 1, 1);
    return formatMonthYearForLocale(date, "short", appLang);
  }
  if (period.mode === "range") {
    if (!period.start) return "";
    const startLabel = formatDateForLocale(
      period.start,
      { timeZone: WALLET_TZ },
      appLang,
    );
    const endLabel = period.end
      ? formatDateForLocale(period.end, { timeZone: WALLET_TZ }, appLang)
      : "";
    if (!endLabel || endLabel === startLabel) return startLabel;
    return `${startLabel} - ${endLabel}`;
  }
  return "";
}

function sanitizeFilenameSegment(input: string) {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function buildWalletCsvFilename(options: {
  period: WalletPeriodFilter;
  status: WalletStatusFilter;
  appLang: AppLang;
}) {
  const periodLabel =
    formatPeriodLabel(options.period, options.appLang) || FULL_HISTORY_LABEL;
  const statusLabel =
    options.status === "all" ? "" : getWalletStatusLabel(options.status);
  const descriptorRaw = [periodLabel, statusLabel].filter(Boolean).join(" ");
  const descriptor = sanitizeFilenameSegment(descriptorRaw);

  if (!descriptor) return "transactions.csv";
  return `transactions_${descriptor}.csv`;
}

function escapeCsv(value: string) {
  // Neutralize spreadsheet formulas when CSV is opened in Excel/Sheets.
  if (/^[\t\r ]*[=+@]/.test(value) || /^[\t\r ]*-[A-Za-z(]/.test(value)) {
    value = `'${value}`;
  }
  if (value.includes('"')) {
    value = value.replace(/"/g, '""');
  }
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value}"`;
  }
  return value;
}

export function walletRowsToCsv(rows: WalletTransactionRow[]) {
  const headers = [
    "invoice_date",
    "description",
    "type",
    "amount_cents",
    "order_start",
    "order_end",
    "occurred_at",
    "currency",
    "invoice_id",
    "payment_intent_id",
  ];

  const lines = rows.map((row) =>
    [
      row.invoiceDate ?? "",
      row.description ?? "",
      row.type ?? "",
      String(row.amountCents ?? 0),
      row.serviceStart ?? "",
      row.serviceEnd ?? "",
      row.occurredAt ?? "",
      row.currency ?? "",
      row.invoiceId ?? "",
      row.paymentIntentId ?? "",
    ]
      .map((value) => escapeCsv(String(value)))
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

export function adminWalletRowsToCsv(rows: WalletTransactionRow[]) {
  const headers = [
    "invoice_date",
    "description",
    "type",
    "amount_cents",
    "order_start",
    "order_end",
    "occurred_at",
    "currency",
    "invoice_id",
    "payment_intent_id",
    "tenant_name",
    "tenant_slug",
    "tenant_id",
    "applied_fee_rate_bps",
    "applied_rule_id",
    "promotion_id",
    "promotion_name",
    "promotion_type",
    "promotion_allocation_id",
  ];

  const lines = rows.map((row) =>
    [
      row.invoiceDate ?? "",
      row.description ?? "",
      row.type ?? "",
      String(row.amountCents ?? 0),
      row.serviceStart ?? "",
      row.serviceEnd ?? "",
      row.occurredAt ?? "",
      row.currency ?? "",
      row.invoiceId ?? "",
      row.paymentIntentId ?? "",
      row.tenantName ?? "",
      row.tenantSlug ?? "",
      row.tenantId ?? "",
      typeof row.appliedFeeRateBps === "number"
        ? String(row.appliedFeeRateBps)
        : "",
      row.appliedRuleId ?? "",
      row.promotionId ?? "",
      row.promotionName ?? "",
      row.promotionType ?? "",
      row.promotionAllocationId ?? "",
    ]
      .map((value) => escapeCsv(String(value)))
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
