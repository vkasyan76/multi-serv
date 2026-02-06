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

function formatAmount(amountTotalCents: number, currency: string) {
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

function InvoicePaidCustomerEmail(props: InvoicePaidCustomerTemplateProps) {
  const greeting = props.customerName?.trim()
    ? `Dear ${props.customerName.trim()},`
    : "Dear,";
  const amount = formatAmount(props.amountTotalCents, props.currency);
  const tenantName = (props.tenantName ?? "the provider").trim();

  return (
    <Html>
      <Head />
      <Preview>Payment received for your invoice.</Preview>
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
            Payment received
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 8px" }}>
            Your payment to {tenantName} was received.
          </Text>
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
  const locale = data.locale == null ? undefined : String(data.locale);

  const subject = `Payment received for invoice ${invoiceId}`;
  const html = await render(
    <InvoicePaidCustomerEmail
      customerName={customerName}
      tenantName={tenantName}
      invoiceId={invoiceId}
      orderId={orderId}
      amountTotalCents={amountTotalCents}
      currency={currency}
      ordersUrl={ordersUrl}
      locale={locale}
    />,
  );
  const amount = formatAmount(amountTotalCents, currency);
  const text = [
    customerName ? `Dear ${customerName},` : "Dear,",
    "",
    `Your payment to ${tenantName ?? "the provider"} was received.`,
    `Invoice: ${invoiceId}`,
    orderId ? `Order: ${orderId}` : "",
    `Total: ${amount}`,
    "",
    `View Orders: ${ordersUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
