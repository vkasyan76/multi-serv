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

type OnboardingCompletedCustomerTemplateProps = {
  customerName?: string;
  ctaUrl: string;
};

function OnboardingCompletedCustomerEmail(
  props: OnboardingCompletedCustomerTemplateProps,
) {
  const greeting = props.customerName?.trim()
    ? `Dear ${props.customerName.trim()},`
    : "Hello,";

  return (
    <Html>
      <Head />
      <Preview>Your profile is complete.</Preview>
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
            Profile completed
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 20px" }}>
            Your profile is complete. You can now start ordering services.
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
              Open profile
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderOnboardingCompletedCustomerTemplate(
  data: Record<string, unknown>,
) {
  const customerName =
    data.customerName == null ? undefined : String(data.customerName);
  const ctaUrl = String(data.ctaUrl ?? "");

  const subject = "Profile completed";
  const html = await render(
    <OnboardingCompletedCustomerEmail
      customerName={customerName}
      ctaUrl={ctaUrl}
    />,
  );

  const text = [
    customerName ? `Dear ${customerName},` : "Hello,",
    "",
    "Your profile is complete. You can now start ordering services.",
    "",
    `Open profile: ${ctaUrl}`,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("\n");

  return { subject, html, text };
}
