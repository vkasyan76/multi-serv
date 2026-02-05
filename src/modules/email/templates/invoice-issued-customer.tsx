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

type InvoiceIssuedCustomerTemplateProps = {
  customerName?: string;
  tenantName?: string;
  tenantSlug?: string;
  invoiceId: string;
  orderId?: string;
  amountTotalCents: number;
  currency: string;
  ordersUrl: string;
  services?: string[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  locale?: string;
};

function formatAmount(amountTotalCents: number, currency: string) {
  // Keep formatting deterministic for email rendering.
  const amountMajor = amountTotalCents / 100;
  const code = (currency || "EUR").toUpperCase();

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(amountMajor);
  } catch {
    return `${amountMajor.toFixed(2)} ${code}`;
  }
}

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

function InvoiceIssuedCustomerEmail(props: InvoiceIssuedCustomerTemplateProps) {
  const amount = formatAmount(props.amountTotalCents, props.currency);
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
      <Preview>Payment request from {tenantLabel}.</Preview>
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
            Payment Request
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 8px" }}>
            {tenantLabel} requested payment for the services below
            {dateRange ? `, carried out ${dateRange}` : ""}.
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
          <Text style={{ margin: "0 0 8px" }}>
            <strong>Invoice:</strong> {props.invoiceId}
          </Text>
          {props.orderId ? (
            <Text style={{ margin: "0 0 8px" }}>
              <strong>Order:</strong> {props.orderId}
            </Text>
          ) : null}
          <Text style={{ margin: "0 0 20px" }}>
            <strong>Total:</strong> {amount}
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
              View & Pay
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderInvoiceIssuedCustomerTemplate(
  data: Record<string, unknown>,
) {
  // Template data comes from domain events, so parse defensively.
  const invoiceId = String(data.invoiceId ?? "");
  const orderId =
    data.orderId == null || data.orderId === ""
      ? undefined
      : String(data.orderId);
  const amountTotalCents = Number(data.amountTotalCents ?? 0);
  const currency = String(data.currency ?? "eur");
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

  const subject = `Payment request from ${tenantLabel}`;
  const html = await render(
    <InvoiceIssuedCustomerEmail
      customerName={customerName}
      tenantName={tenantName}
      tenantSlug={tenantSlug}
      invoiceId={invoiceId}
      orderId={orderId}
      amountTotalCents={amountTotalCents}
      currency={currency}
      ordersUrl={ordersUrl}
      services={services}
      dateRangeStart={dateRangeStart}
      dateRangeEnd={dateRangeEnd}
      locale={locale}
    />,
  );
  const amount = formatAmount(amountTotalCents, currency);
  const dateRange = formatDateRangeUtc(dateRangeStart, dateRangeEnd, locale);
  const text = [
    customerName ? `Dear ${customerName},` : "Dear,",
    "",
    `${tenantLabel} requested payment for the services below${dateRange ? `, carried out ${dateRange}` : ""}.`,
    "",
    ...services.map((service) => `- ${service}`),
    `Invoice: ${invoiceId}`,
    orderId ? `Order: ${orderId}` : "",
    `Total: ${amount}`,
    "",
    `View & Pay: ${ordersUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
