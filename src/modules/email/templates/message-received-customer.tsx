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

type MessageReceivedCustomerTemplateProps = {
  recipientName?: string;
  senderName?: string;
  messagePreview: string;
  ctaUrl: string;
};

function MessageReceivedCustomerEmail(
  props: MessageReceivedCustomerTemplateProps,
) {
  const greeting = props.recipientName?.trim()
    ? `Dear ${props.recipientName.trim()},`
    : "Dear,";
  const from = (props.senderName ?? "the provider").trim();
  const preview = (props.messagePreview ?? "").trim();

  return (
    <Html>
      <Head />
      <Preview>New message from {from}</Preview>
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
            New message
          </Heading>
          <Text style={{ margin: "0 0 12px" }}>{greeting}</Text>
          <Text style={{ margin: "0 0 8px" }}>
            You received a new message from <strong>{from}</strong>.
          </Text>
          {preview ? (
            <Section
              style={{
                backgroundColor: "#FEF3C7",
                borderRadius: "8px",
                padding: "12px 14px",
                margin: "12px 0 16px",
              }}
            >
              <Text style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                “{preview}”
              </Text>
            </Section>
          ) : null}
          <Text style={{ margin: "0 0 8px", fontSize: "12px", color: "#6b7280" }}>
            Click below to reply:
          </Text>
          <Section style={{ margin: "20px 0 8px" }}>
            <Button
              href={props.ctaUrl}
              style={{
                backgroundColor: "#111827",
                borderRadius: "8px",
                padding: "12px 18px",
                textDecoration: "none",
                display: "inline-block",
                fontWeight: 600,
              }}
            >
              <span style={{ color: "#ffffff", textDecoration: "none" }}>
                Open provider page
              </span>
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderMessageReceivedCustomerTemplate(
  data: Record<string, unknown>,
) {
  const recipientName =
    data.recipientName == null ? undefined : String(data.recipientName);
  const senderName =
    data.senderName == null ? undefined : String(data.senderName);
  const messagePreview = String(data.messagePreview ?? "");
  const ctaUrl = String(data.ctaUrl ?? "").trim();
  if (!ctaUrl) {
    throw new Error(
      "ctaUrl is required for message-received-customer template",
    );
  }

  const subject = senderName
    ? `New message from ${senderName}`
    : "New message received";
  const html = await render(
    <MessageReceivedCustomerEmail
      recipientName={recipientName}
      senderName={senderName}
      messagePreview={messagePreview}
      ctaUrl={ctaUrl}
    />,
  );

  const text = [
    recipientName ? `Dear ${recipientName},` : "Dear,",
    "",
    `You received a new message from ${senderName ?? "the provider"}.`,
    "",
    messagePreview ? `Preview: ${messagePreview}` : undefined,
    "",
    `Open provider page: ${ctaUrl}`,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("\n");

  return { subject, html, text };
}
