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

type PayoutsEnabledTenantTemplateProps = {
  tenantName?: string;
  ctaUrl: string;
};

function PayoutsEnabledTenantEmail(props: PayoutsEnabledTenantTemplateProps) {
  const greeting = props.tenantName?.trim()
    ? `Dear ${props.tenantName.trim()},`
    : "Hello,";

  return (
    <Html>
      <Head />
      <Preview>Your payouts are enabled.</Preview>
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
            Payouts enabled
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 20px" }}>
            Your payouts are enabled. You can now accept payments.
          </Text>
          <Section style={{ margin: "20px 0 8px" }}>
            <Button
              href={props.ctaUrl}
              style={{
                backgroundColor: "#111827",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "12px 18px",
                textDecoration: "none",
              }}
            >
              Open payouts
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderPayoutsEnabledTenantTemplate(
  data: Record<string, unknown>,
) {
  const tenantName =
    data.tenantName == null ? undefined : String(data.tenantName);
  const ctaUrl = String(data.ctaUrl ?? "").trim();
  if (!ctaUrl) {
    throw new Error("ctaUrl is required for payouts-enabled-tenant template");
  }

  const subject = "Payouts enabled";
  const html = await render(
    <PayoutsEnabledTenantEmail tenantName={tenantName} ctaUrl={ctaUrl} />,
  );

  const text = [
    tenantName ? `Dear ${tenantName},` : "Hello,",
    "",
    "Your payouts are enabled. You can now accept payments.",
    "",
    `Open payouts: ${ctaUrl}`,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("\n");

  return { subject, html, text };
}
