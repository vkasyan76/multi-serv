import type { Payload } from "payload";

export type EmailEventType =
  | "onboarding.completed.customer"
  | "vendor.created.tenant"
  | "payouts.enabled.tenant"
  | "order.created.customer"
  | "order.created.tenant"
  | "order.confirmed.customer"
  | "order.declined.customer"
  | "order.canceled.customer"
  | "order.canceled.tenant"
  | "order.completed.customer"
  | "order.accepted.tenant"
  | "order.disputed.tenant"
  | "invoice.issued.customer"
  | "invoice.issued.tenant"
  | "invoice.paid.customer"
  | "invoice.paid.tenant"
  | "message.received.customer"
  | "message.received.tenant";

export type EntityType =
  | "order"
  | "booking"
  | "invoice"
  | "message"
  | "user"
  | "tenant";

export type EmailDeliverabilityStatus =
  | "ok"
  | "soft_suppressed"
  | "hard_suppressed";

export type EmailDeliverabilityReason =
  | "complaint"
  | "bounce_transient"
  | "bounce_permanent"
  | "manual";

export type EmailDeliverability = {
  status?: EmailDeliverabilityStatus | null;
  reason?: EmailDeliverabilityReason | null;
  retryAfter?: string | Date | null;
};

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  deliverability?: EmailDeliverability;
  headers?: Record<string, string>;
};

export type ResolvedEmailEvent = {
  eventType: EmailEventType;
  entityType: EntityType;
  entityId: string;
  recipientUserId?: string | null;
  toEmail: string;
  deliverability?: EmailDeliverability;
  subject: string;
  html: string;
  text?: string;
  dedupeKey: string;
};

export type SendDomainEmailArgs = {
  // Payload instance from server context (tRPC ctx.db).
  db: Payload;
  eventType: EmailEventType;
  entityType: EntityType;
  entityId: string;
  recipientUserId?: string | null;
  toEmail: string;
  deliverability?: EmailDeliverability;
  data?: Record<string, unknown>;
};
