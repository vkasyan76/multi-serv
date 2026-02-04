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

type OrderAcceptedTenantTemplateProps = {
  tenantName?: string;
  customerName?: string;
  orderId: string;
  dashboardUrl: string;
  services?: string[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  locale?: string;
};

function toLocaleTag(language?: string) {
  switch ((language ?? "").toLowerCase()) {
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

function OrderAcceptedTenantEmail(props: OrderAcceptedTenantTemplateProps) {
  const greeting = props.tenantName?.trim()
    ? `Dear ${props.tenantName.trim()},`
    : "Dear,";
  const customerName = (props.customerName ?? "your customer").trim();
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
      <Preview>Order accepted by {customerName}.</Preview>
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
            Order Accepted
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 8px" }}>
            {customerName} accepted the completed service below
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

export async function renderOrderAcceptedTenantTemplate(
  data: Record<string, unknown>,
) {
  const orderId = String(data.orderId ?? "");
  const dashboardUrl = String(data.dashboardUrl ?? "");
  const tenantName =
    data.tenantName == null ? undefined : String(data.tenantName);
  const customerName =
    data.customerName == null ? undefined : String(data.customerName);
  const servicesRaw = data.services;
  const services = Array.isArray(servicesRaw)
    ? servicesRaw.map((s) => String(s)).filter(Boolean)
    : [];
  const dateRangeStart =
    data.dateRangeStart == null ? undefined : String(data.dateRangeStart);
  const dateRangeEnd =
    data.dateRangeEnd == null ? undefined : String(data.dateRangeEnd);
  const locale = data.locale == null ? undefined : String(data.locale);

  const subject = customerName
    ? `Order accepted by ${customerName}`
    : "Order accepted";
  const html = await render(
    <OrderAcceptedTenantEmail
      tenantName={tenantName}
      customerName={customerName}
      orderId={orderId}
      dashboardUrl={dashboardUrl}
      services={services}
      dateRangeStart={dateRangeStart}
      dateRangeEnd={dateRangeEnd}
      locale={locale}
    />,
  );
  const dateRange = formatDateRangeUtc(dateRangeStart, dateRangeEnd, locale);
  const text = [
    tenantName ? `Dear ${tenantName},` : "Dear,",
    "",
    `${customerName ?? "Your customer"} accepted the completed service below${dateRange ? ` (${dateRange})` : ""}.`,
    "",
    ...services.map((service) => `- ${service}`),
    `Order: ${orderId}`,
    "",
    `View Dashboard: ${dashboardUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
