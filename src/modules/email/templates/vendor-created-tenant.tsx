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
  locale?: string;
  promotion?: {
    id: string;
    type: "first_n" | "time_window_rate";
    rateBps: number;
    endsAt?: string | null;
  };
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

function formatRatePercent(rateBps: number, locale?: string): string {
  const fractionDigits = rateBps % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(toLocaleTag(locale), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(rateBps / 100);
}

function formatBerlinDateOnly(
  iso: string | null | undefined,
  locale?: string,
): string | null {
  if (!iso) return null;
  const asDate = new Date(iso);
  if (Number.isNaN(asDate.getTime())) return null;
  return new Intl.DateTimeFormat(toLocaleTag(locale), {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asDate);
}

function getPromotionCopy(
  promotion: VendorCreatedTenantTemplateProps["promotion"],
  locale?: string,
) {
  if (!promotion) return null;
  const rateText = formatRatePercent(promotion.rateBps, locale);

  if (promotion.type === "time_window_rate") {
    const endsAt = formatBerlinDateOnly(promotion.endsAt, locale);
    return {
      heading: "Referral campaign eligibility",
      body: endsAt
        ? `You may be eligible for a reduced platform fee of ${rateText}% until ${endsAt} (Europe/Berlin).`
        : `You may be eligible for a reduced platform fee of ${rateText}%.`,
    };
  }

  return {
    heading: "Referral campaign eligibility",
    body: `You may be eligible for a reduced platform fee of ${rateText}% while campaign capacity remains.`,
  };
}

function VendorCreatedTenantEmail(props: VendorCreatedTenantTemplateProps) {
  const greeting = props.recipientName?.trim()
    ? `Dear ${props.recipientName.trim()},`
    : "Hello,";
  const slug = (props.tenantSlug ?? "").trim();
  const promo = getPromotionCopy(props.promotion, props.locale);

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
          {promo ? (
            <Section
              style={{
                margin: "0 0 20px",
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "12px 14px",
              }}
            >
              <Text
                style={{
                  margin: "0 0 8px",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {promo.heading}
              </Text>
              <Text style={{ margin: "0 0 8px", color: "#111827" }}>
                {promo.body}
              </Text>
              <Text style={{ margin: 0, color: "#4b5563" }}>
                Other campaign rules and priority may apply at checkout.
              </Text>
            </Section>
          ) : null}
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
  function parsePromotion(input: unknown): VendorCreatedTenantTemplateProps["promotion"] {
    if (!input || typeof input !== "object") return undefined;
    const typed = input as Record<string, unknown>;
    const id = typeof typed.id === "string" ? typed.id : "";
    const type = typed.type;
    const rateBpsRaw = typed.rateBps;
    const endsAtRaw = typed.endsAt;
    const endsAt =
      typeof endsAtRaw === "string" || endsAtRaw == null ? endsAtRaw : null;
    const rateBps =
      typeof rateBpsRaw === "number" ? rateBpsRaw : Number(rateBpsRaw);

    if (!id) return undefined;
    if (type !== "first_n" && type !== "time_window_rate") return undefined;
    if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) {
      return undefined;
    }
    if (endsAt && Number.isNaN(new Date(endsAt).getTime())) return undefined;

    return { id, type, rateBps, endsAt: endsAt ?? null };
  }

  const recipientName =
    data.recipientName == null ? undefined : String(data.recipientName);
  const tenantSlug =
    data.tenantSlug == null ? undefined : String(data.tenantSlug);
  const ctaUrl = String(data.ctaUrl ?? "").trim();
  const locale = data.locale == null ? undefined : String(data.locale);
  const promotion = parsePromotion(data.promotion);
  if (!ctaUrl) {
    throw new Error("ctaUrl is required for vendor-created-tenant template");
  }

  const subject = "Provider profile created";
  const html = await render(
    <VendorCreatedTenantEmail
      recipientName={recipientName}
      tenantSlug={tenantSlug}
      ctaUrl={ctaUrl}
      locale={locale}
      promotion={promotion}
    />,
  );

  const promo = getPromotionCopy(promotion, locale);
  const text = [
    recipientName ? `Dear ${recipientName},` : "Hello,",
    "",
    `Your provider profile${tenantSlug ? ` (${tenantSlug})` : ""} is ready. You can now start offering services.`,
    "",
    ...(promo
      ? [
          promo.heading,
          promo.body,
          "Other campaign rules and priority may apply at checkout.",
          "",
        ]
      : []),
    `Open provider profile: ${ctaUrl}`,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("\n");

  return { subject, html, text };
}
