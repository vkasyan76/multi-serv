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

type InvoicePaidCustomerTemplateProps = {
  customerName?: string;
  tenantName?: string;
  invoiceId: string;
  orderId?: string;
  amountTotalCents: number;
  currency: string;
  ordersUrl: string;
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

function formatAmount(
  amountTotalCents: number,
  currency: string,
  locale?: string,
) {
  const amountMajor = amountTotalCents / 100;
  const code = (currency || "EUR").toUpperCase();
  const localeTag = toLocaleTag(locale);
  try {
    return new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency: code,
    }).format(amountMajor);
  } catch {
    return `${amountMajor.toFixed(2)} ${code}`;
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

function InvoicePaidCustomerEmail(props: InvoicePaidCustomerTemplateProps) {
  const greeting = props.customerName?.trim()
    ? `Dear ${props.customerName.trim()},`
    : "Dear,";
  const amount = formatAmount(
    props.amountTotalCents,
    props.currency,
    props.locale,
  );
  const tenantName =
    (props.tenantName ?? "").trim() || "the provider";
  const dateRange = formatDateRangeUtc(
    props.dateRangeStart,
    props.dateRangeEnd,
    props.locale,
  );

  return (
    <Html>
      <Head />
      <Preview>Your payment was processed.</Preview>
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
            Payment processed
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 8px" }}>
            Your payment to {tenantName} was processed.
          </Text>
          <Text style={{ margin: "0 0 8px" }}>
            <strong>Invoice:</strong> {props.invoiceId}
          </Text>
          {props.orderId ? (
            <Text style={{ margin: "0 0 8px" }}>
              <strong>Order:</strong> {props.orderId}
            </Text>
          ) : null}
          {dateRange ? (
            <Text style={{ margin: "0 0 8px" }}>
              <strong>Service date:</strong> {dateRange}
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
              View Orders
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderInvoicePaidCustomerTemplate(
  data: Record<string, unknown>,
) {
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
  const dateRangeStart =
    data.dateRangeStart == null ? undefined : String(data.dateRangeStart);
  const dateRangeEnd =
    data.dateRangeEnd == null ? undefined : String(data.dateRangeEnd);
  const locale = data.locale == null ? undefined : String(data.locale);

  const subject = "Your payment was processed";
  const html = await render(
    <InvoicePaidCustomerEmail
      customerName={customerName}
      tenantName={tenantName}
      invoiceId={invoiceId}
      orderId={orderId}
      amountTotalCents={amountTotalCents}
      currency={currency}
      ordersUrl={ordersUrl}
      dateRangeStart={dateRangeStart}
      dateRangeEnd={dateRangeEnd}
      locale={locale}
    />,
  );
  const amount = formatAmount(amountTotalCents, currency, locale);
  const dateRange = formatDateRangeUtc(dateRangeStart, dateRangeEnd, locale);
  const text = [
    customerName ? `Dear ${customerName},` : "Dear,",
    "",
    `Your payment to ${tenantName ?? "the provider"} was processed.`,
    `Invoice: ${invoiceId}`,
    orderId ? `Order: ${orderId}` : undefined,
    dateRange ? `Service date: ${dateRange}` : undefined,
    `Total: ${amount}`,
    "",
    `View Orders: ${ordersUrl}`,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("\n");

  return { subject, html, text };
}
