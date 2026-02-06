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

type InvoicePaidTenantTemplateProps = {
  tenantName?: string;
  customerName?: string;
  invoiceId: string;
  orderId?: string;
  amountTotalCents: number;
  currency: string;
  dashboardUrl: string;
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

function InvoicePaidTenantEmail(props: InvoicePaidTenantTemplateProps) {
  const greeting = props.tenantName?.trim()
    ? `Dear ${props.tenantName.trim()},`
    : "Dear,";
  const customerName = (props.customerName ?? "your customer").trim();
  const amount = formatAmount(
    props.amountTotalCents,
    props.currency,
    props.locale,
  );

  return (
    <Html>
      <Head />
      <Preview>Invoice paid by {customerName}.</Preview>
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
            Invoice paid
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 8px" }}>
            {customerName} paid the invoice below.
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
              href={props.dashboardUrl}
              style={{
                backgroundColor: "#111827",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "12px 18px",
                textDecoration: "none",
              }}
            >
              View Dashboard
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderInvoicePaidTenantTemplate(
  data: Record<string, unknown>,
) {
  const invoiceId = String(data.invoiceId ?? "");
  const orderId =
    data.orderId == null || data.orderId === ""
      ? undefined
      : String(data.orderId);
  const amountTotalCents = Number(data.amountTotalCents ?? 0);
  const currency = String(data.currency ?? "eur");
  const dashboardUrl = String(data.dashboardUrl ?? "");
  const tenantName =
    data.tenantName == null ? undefined : String(data.tenantName);
  const customerName =
    data.customerName == null ? undefined : String(data.customerName);
  const locale = data.locale == null ? undefined : String(data.locale);

  const subject = customerName
    ? `Invoice paid by ${customerName}`
    : `Invoice ${invoiceId} paid`;
  const html = await render(
    <InvoicePaidTenantEmail
      tenantName={tenantName}
      customerName={customerName}
      invoiceId={invoiceId}
      orderId={orderId}
      amountTotalCents={amountTotalCents}
      currency={currency}
      dashboardUrl={dashboardUrl}
      locale={locale}
    />,
  );
  const amount = formatAmount(amountTotalCents, currency, locale);
  const text = [
    tenantName ? `Dear ${tenantName},` : "Dear,",
    "",
    `${customerName ?? "Your customer"} paid the invoice below.`,
    `Invoice: ${invoiceId}`,
    orderId ? `Order: ${orderId}` : undefined,
    `Total: ${amount}`,
    "",
    `View Dashboard: ${dashboardUrl}`,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("\n");

  return { subject, html, text };
}
