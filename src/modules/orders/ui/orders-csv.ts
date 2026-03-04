type AdminOrdersSlotExportRow = {
  orderId: string;
  orderCreatedAt: string;
  lifecycleMode: string;
  orderServiceStatus: string;
  invoiceStatus: string | null;
  tenantId?: string;
  tenantName?: string | null;
  tenantSlug?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  userId?: string | null;
  slotId: string;
  slotIndex: number;
  slotCount: number;
  slotStart: string;
  slotEnd?: string | null;
  slotStatus: string;
  serviceName?: string | null;
  disputeReason?: string | null;
};

function sanitizeFilenameSegment(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
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

export function adminOrdersSlotRowsToCsv(rows: AdminOrdersSlotExportRow[]) {
  const headers = [
    "order_id",
    "order_created_at",
    "tenant_name",
    "tenant_slug",
    "tenant_id",
    "customer_name",
    "customer_email",
    "user_id",
    "lifecycle_mode",
    "order_service_status",
    "invoice_status",
    "slot_id",
    "slot_index",
    "slot_count",
    "slot_start",
    "slot_end",
    "slot_status",
    "service_name",
    "dispute_reason",
  ];

  const lines = rows.map((row) =>
    [
      row.orderId,
      row.orderCreatedAt,
      row.tenantName ?? "",
      row.tenantSlug ?? "",
      row.tenantId ?? "",
      row.customerName ?? "",
      row.customerEmail ?? "",
      row.userId ?? "",
      row.lifecycleMode ?? "",
      row.orderServiceStatus ?? "",
      row.invoiceStatus ?? "",
      row.slotId,
      String(row.slotIndex),
      String(row.slotCount),
      row.slotStart,
      row.slotEnd ?? "",
      row.slotStatus ?? "",
      row.serviceName ?? "",
      row.disputeReason ?? "",
    ]
      .map((value) => escapeCsv(String(value)))
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

export function buildOrdersCsvFilename(options: {
  scopeLabel?: string;
  customerLabel?: string;
}) {
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "");
  const descriptor = [
    options.scopeLabel || "all-tenants",
    options.customerLabel ? `customer-${options.customerLabel}` : "",
  ]
    .filter(Boolean)
    .map(sanitizeFilenameSegment)
    .filter(Boolean)
    .join("_");

  return `admin-orders-slots_${descriptor}_${timestamp}.csv`;
}
