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

type VendorCreatedTenantTemplateProps = {
  recipientName?: string;
  tenantSlug?: string;
  ctaUrl: string;
};

function VendorCreatedTenantEmail(props: VendorCreatedTenantTemplateProps) {
  const greeting = props.recipientName?.trim()
    ? `Dear ${props.recipientName.trim()},`
    : "Hello,";
  const slug = (props.tenantSlug ?? "").trim();

  return (
    <Html>
      <Head />
      <Preview>Your provider profile is ready.</Preview>
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
            Provider profile created
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 20px" }}>
            Your provider profile {slug ? `(${slug}) ` : ""}is ready. You can
            now start offering services.
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
              Open provider profile
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderVendorCreatedTenantTemplate(
  data: Record<string, unknown>,
) {
  const recipientName =
    data.recipientName == null ? undefined : String(data.recipientName);
  const tenantSlug =
    data.tenantSlug == null ? undefined : String(data.tenantSlug);
  const ctaUrl = String(data.ctaUrl ?? "").trim();
  if (!ctaUrl) {
    throw new Error("ctaUrl is required for vendor-created-tenant template");
  }

  const subject = "Provider profile created";
  const html = await render(
    <VendorCreatedTenantEmail
      recipientName={recipientName}
      tenantSlug={tenantSlug}
      ctaUrl={ctaUrl}
    />,
  );

  const text = [
    recipientName ? `Dear ${recipientName},` : "Hello,",
    "",
    `Your provider profile${tenantSlug ? ` (${tenantSlug})` : ""} is ready. You can now start offering services.`,
    "",
    `Open provider profile: ${ctaUrl}`,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("\n");

  return { subject, html, text };
}
