export type PeriodMode = "all" | "year" | "month" | "range";

export type WalletStatusFilter =
  | "all"
  | "paid"
  | "payment_due"
  | "platform_fee";

export type WalletPeriodFilter = {
  mode: PeriodMode;
  year?: number;
  month?: number;
  start?: Date;
  end?: Date;
};

export type WalletFilters = {
  period: WalletPeriodFilter;
  status: WalletStatusFilter;
};

export type WalletTenantOption = {
  id: string;
  name: string;
  slug: string;
};

export type WalletTransactionRow = {
  id: string;
  type: "payment_received" | "payment_outstanding" | "platform_fee";
  occurredAt: string;
  description: string;
  amountCents: number;
  currency: string;
  invoiceId: string;
  paymentIntentId?: string;
  serviceStart?: string;
  serviceEnd?: string;
  invoiceDate?: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  // Snapshot/audit fields for admin transactions visibility and CSV export.
  appliedFeeRateBps?: number;
  appliedRuleId?: string;
  promotionId?: string;
  promotionAllocationId?: string;
  promotionType?: "first_n" | "time_window_rate";
  // Admin enrichment: human-readable campaign label for reporting UX.
  promotionName?: string;
};
