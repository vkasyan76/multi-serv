import "server-only";
import { buildDedupeKey } from "./dedupe";
import { sendEmail } from "./send";
import type {
  EmailEventType,
  ResolvedEmailEvent,
  SendDomainEmailArgs,
} from "./types";
import { renderInvoiceIssuedCustomerTemplate } from "./templates/invoice-issued-customer";
import { renderInvoiceIssuedTenantTemplate } from "./templates/invoice-issued-tenant";
import { renderOrderCompletedCustomerTemplate } from "./templates/order-completed-customer";
import { renderOrderAcceptedTenantTemplate } from "./templates/order-accepted-tenant";
import { renderOrderDisputedTenantTemplate } from "./templates/order-disputed-tenant";

type TemplateRenderer = (data: Record<string, unknown>) => Promise<{
  subject: string;
  html: string;
  text?: string;
}>;

// Event -> template renderer map. We register only events we actually send.
const TEMPLATE_REGISTRY: Partial<Record<EmailEventType, TemplateRenderer>> = {};

export function registerEmailTemplate(
  eventType: EmailEventType,
  renderer: TemplateRenderer,
) {
  TEMPLATE_REGISTRY[eventType] = renderer;
}

async function resolveEmailEvent(
  input: SendDomainEmailArgs,
): Promise<ResolvedEmailEvent> {
  const renderer = TEMPLATE_REGISTRY[input.eventType];
  if (!renderer) {
    throw new Error(`Missing email template for ${input.eventType}`);
  }

  const toEmail = input.toEmail.trim().toLowerCase();
  const { subject, html, text } = await renderer(input.data ?? {});
  const dedupeKey = buildDedupeKey({
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    recipient: toEmail,
  });

  return {
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    recipientUserId: input.recipientUserId ?? null,
    toEmail,
    deliverability: input.deliverability,
    subject,
    html,
    text,
    dedupeKey,
  };
}

function isDuplicateDedupeError(err: unknown) {
  const e = err as { code?: unknown; message?: unknown };
  return (
    e?.code === 11000 ||
    String(e?.message ?? "").toLowerCase().includes("duplicate key")
  );
}

export async function sendDomainEmail(input: SendDomainEmailArgs) {
  const event = await resolveEmailEvent(input);

  // Reserve by dedupe key first. Duplicate key means "already handled".
  let logId: string;
  try {
    const log = await input.db.create({
      collection: "email_event_logs",
      data: {
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        recipientUser: event.recipientUserId ?? undefined,
        toEmail: event.toEmail,
        dedupeKey: event.dedupeKey,
        provider: "resend",
        status: "pending",
      },
      overrideAccess: true,
      depth: 0,
    });
    logId = log.id;
  } catch (err) {
    if (isDuplicateDedupeError(err)) {
      return { status: "skipped", reason: "duplicate_dedupe_key" } as const;
    }
    throw err;
  }

  try {
    const result = await sendEmail({
      to: event.toEmail,
      subject: event.subject,
      html: event.html,
      text: event.text,
      deliverability: event.deliverability,
      headers: {
        "X-Infinisimo-Dedupe-Key": event.dedupeKey,
        "X-Infinisimo-Event-Type": event.eventType,
      },
    });

    // Finalize reserved log row with the actual provider/policy result.
    await input.db.update({
      collection: "email_event_logs",
      id: logId,
      data:
        result.status === "sent"
          ? {
              status: "sent",
              providerMessageId: result.providerMessageId,
              error: null,
            }
          : {
              status: "skipped",
              error: result.reason,
            },
      overrideAccess: true,
      depth: 0,
    });

    return result;
  } catch (err) {
    await input.db.update({
      collection: "email_event_logs",
      id: logId,
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : "unknown_error",
      },
      overrideAccess: true,
      depth: 0,
    });
    throw err;
  }
}

// Register built-in templates once on module load.
registerEmailTemplate(
  "invoice.issued.customer",
  renderInvoiceIssuedCustomerTemplate,
);
registerEmailTemplate("invoice.issued.tenant", renderInvoiceIssuedTenantTemplate);
registerEmailTemplate(
  "order.completed.customer",
  renderOrderCompletedCustomerTemplate,
);
registerEmailTemplate(
  "order.accepted.tenant",
  renderOrderAcceptedTenantTemplate,
);
registerEmailTemplate(
  "order.disputed.tenant",
  renderOrderDisputedTenantTemplate,
);
