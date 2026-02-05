import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";

type OrderCreatedCustomerTemplateProps = {
  customerName?: string;
  tenantName?: string;
  tenantSlug?: string;
  orderId: string;
  ordersUrl: string;
  services?: string[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  locale?: string;
};

function toLocaleTag(language?: string) {
  const normalized = (language ?? "").trim();
  if (normalized && /[-_]/.test(normalized)) {
    return normalized.replace("_", "-");
  }
  switch (normalized.toLowerCase()) {
    case "de":
      return "de-DE";
    case "fr":
      return "fr-FR";
    case "es":
      return "es-ES";
    case "it":
      return "it-IT";
    case "pt":
      return "pt-PT";
    default:
      return "en-US";
  }
}

function formatDateRangeUtc(
  startIso?: string,
  endIso?: string,
  language?: string,
) {
  if (!startIso && !endIso) return null;
  const startMs = Date.parse(startIso ?? "");
  const endMs = Date.parse(endIso ?? startIso ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

  const fmt = new Intl.DateTimeFormat(toLocaleTag(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const startStr = fmt.format(new Date(startMs));
  const endStr = fmt.format(new Date(endMs));
  return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
}

function formatTenantLabel(tenantSlug?: string, tenantName?: string) {
  const slug = (tenantSlug ?? "").trim();
  const name = (tenantName ?? "").trim();
  if (slug && name) return `${slug} (${name})`;
  return slug || name || "the tenant";
}

function OrderCreatedCustomerEmail(props: OrderCreatedCustomerTemplateProps) {
  const greeting = props.customerName?.trim()
    ? `Dear ${props.customerName.trim()},`
    : "Dear,";
  const tenantLabel = formatTenantLabel(props.tenantSlug, props.tenantName);
  const dateRange = formatDateRangeUtc(
    props.dateRangeStart,
    props.dateRangeEnd,
    props.locale,
  );
  const services = Array.isArray(props.services)
    ? props.services.map((s) => String(s).trim()).filter(Boolean)
    : [];

  return (
    <Html>
      <Head />
      <Preview>Order received from {tenantLabel}.</Preview>
      <Body style={{ backgroundColor: "#f6f7f8", padding: "24px 0" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            padding: "24px",
            maxWidth: "560px",
          }}
        >
          <Heading style={{ margin: "0 0 16px", fontSize: "24px" }}>
            Order received
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 8px" }}>
            Your order with {tenantLabel} has been created
            {dateRange ? ` (${dateRange})` : ""}.
          </Text>
          {services.length ? (
            <Section style={{ margin: "8px 0 16px" }}>
              <ul style={{ margin: "0", paddingLeft: "20px" }}>
                {services.map((service, idx) => (
                  <li key={`${service}-${idx}`}>{service}</li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Text style={{ margin: "0 0 20px" }}>
            <strong>Order:</strong> {props.orderId}
          </Text>
          <Section style={{ margin: "20px 0 8px" }}>
            <Button
              href={props.ordersUrl}
              style={{
                backgroundColor: "#111827",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "12px 18px",
                textDecoration: "none",
              }}
            >
              View Orders
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderOrderCreatedCustomerTemplate(
  data: Record<string, unknown>,
) {
  const orderId = String(data.orderId ?? "");
  const ordersUrl = String(data.ordersUrl ?? "");
  const customerName =
    data.customerName == null ? undefined : String(data.customerName);
  const tenantName =
    data.tenantName == null ? undefined : String(data.tenantName);
  const tenantSlug =
    data.tenantSlug == null ? undefined : String(data.tenantSlug);
  const servicesRaw = data.services;
  const services = Array.isArray(servicesRaw)
    ? servicesRaw.map((s) => String(s)).filter(Boolean)
    : [];
  const dateRangeStart =
    data.dateRangeStart == null ? undefined : String(data.dateRangeStart);
  const dateRangeEnd =
    data.dateRangeEnd == null ? undefined : String(data.dateRangeEnd);
  const locale = data.locale == null ? undefined : String(data.locale);
  const tenantLabel = formatTenantLabel(tenantSlug, tenantName);

  const subject = `Order received from ${tenantLabel}`;
  const html = await render(
    <OrderCreatedCustomerEmail
      customerName={customerName}
      tenantName={tenantName}
      tenantSlug={tenantSlug}
      orderId={orderId}
      ordersUrl={ordersUrl}
      services={services}
      dateRangeStart={dateRangeStart}
      dateRangeEnd={dateRangeEnd}
      locale={locale}
    />,
  );
  const dateRange = formatDateRangeUtc(dateRangeStart, dateRangeEnd, locale);
  const text = [
    customerName ? `Dear ${customerName},` : "Dear,",
    "",
    `Your order with ${tenantLabel} has been created${dateRange ? ` (${dateRange})` : ""}.`,
    "",
    ...services.map((service) => `- ${service}`),
    `Order: ${orderId}`,
    "",
    `View Orders: ${ordersUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
