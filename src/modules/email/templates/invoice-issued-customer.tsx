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
  invoiceId: string;
  orderId?: string;
  amountTotalCents: number;
  currency: string;
  invoiceUrl: string;
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

function InvoiceIssuedCustomerEmail(props: InvoiceIssuedCustomerTemplateProps) {
  const amount = formatAmount(props.amountTotalCents, props.currency);
  const greeting = props.customerName?.trim()
    ? `Hi ${props.customerName.trim()},`
    : "Hi,";

  return (
    <Html>
      <Head />
      <Preview>Your invoice is ready - view and pay online.</Preview>
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
            Invoice issued
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 8px" }}>
            Your invoice has been issued and is ready for payment.
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
              href={props.invoiceUrl}
              style={{
                backgroundColor: "#111827",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "12px 18px",
                textDecoration: "none",
              }}
            >
              View & Pay Invoice
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
  const invoiceUrl = String(data.invoiceUrl ?? "");
  const customerName =
    data.customerName == null ? undefined : String(data.customerName);

  const subject = `Invoice ${invoiceId} is ready`;
  const html = await render(
    <InvoiceIssuedCustomerEmail
      customerName={customerName}
      invoiceId={invoiceId}
      orderId={orderId}
      amountTotalCents={amountTotalCents}
      currency={currency}
      invoiceUrl={invoiceUrl}
    />,
  );
  const amount = formatAmount(amountTotalCents, currency);
  const text = [
    customerName ? `Hi ${customerName},` : "Hi,",
    "",
    "Your invoice is ready for payment.",
    `Invoice: ${invoiceId}`,
    orderId ? `Order: ${orderId}` : "",
    `Total: ${amount}`,
    "",
    `View & Pay: ${invoiceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
