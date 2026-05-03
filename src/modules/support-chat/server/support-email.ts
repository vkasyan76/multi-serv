import "server-only";

import type { Payload } from "payload";
import type { AppLang } from "@/lib/i18n/app-lang";
import type { SendEmailArgs } from "@/modules/email/types";
import { verifySelectedOrderContextToken } from "@/modules/support-chat/server/account-aware/action-tokens";

type SupportEmailUser = {
  id?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  roles?: string[] | null;
  language?: string | null;
  country?: string | null;
  location?: string | null;
  createdAt?: string | null;
  coordinates?: {
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    street?: string | null;
    streetNumber?: string | null;
    countryISO?: string | null;
    countryName?: string | null;
  } | null;
};

type SupportEmailTenant = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  country?: string | null;
  hourlyRate?: number | null;
  services?: string[] | null;
  categories?: Array<string | { name?: string | null; slug?: string | null }> | null;
  subcategories?: Array<string | { name?: string | null; slug?: string | null }> | null;
  phone?: string | null;
  website?: string | null;
  onboardingStatus?: string | null;
  chargesEnabled?: boolean | null;
  payoutsEnabled?: boolean | null;
  stripeDetailsSubmitted?: boolean | null;
  vatRegistered?: boolean | null;
  vatIdValid?: boolean | null;
};

type SupportEmailProfile = {
  user: SupportEmailUser & {
    id: string;
    email: string;
  };
  tenants: SupportEmailTenant[];
};

type EmailRow = [label: string, value: unknown];

export type SupportEmailSender = (
  args: SendEmailArgs,
) => Promise<{ status: "sent"; providerMessageId?: string } | { status: "skipped"; reason: string }>;

export type SendSupportEmailHandoffInput = {
  db: Payload;
  clerkUserId: string;
  message: string;
  locale: AppLang;
  threadId?: string;
  currentUrl?: string;
  selectedOrderContext?: {
    type: "selected_order";
    token: string;
  };
  sendEmailImpl?: SupportEmailSender;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function supportInbox() {
  return normalizeEmail(process.env.SUPPORT_EMAIL_TO);
}

function isPresentValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function formatBoolean(value: unknown) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return null;
}

function formatList(value: unknown) {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const relation = item as { name?: unknown; slug?: unknown };
        if (typeof relation.name === "string" && relation.name.trim()) {
          return relation.name.trim();
        }
        if (typeof relation.slug === "string" && relation.slug.trim()) {
          return relation.slug.trim();
        }
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
  return items.length > 0 ? items.join(", ") : null;
}

function formatValue(value: unknown): string | null {
  if (!isPresentValue(value)) return null;
  if (typeof value === "boolean") return formatBoolean(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (Array.isArray(value)) return formatList(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.trim();
  return null;
}

function compactRows(rows: EmailRow[]) {
  return rows
    .map(([label, value]) => [label, formatValue(value)] as const)
    .filter((row): row is readonly [string, string] => Boolean(row[1]));
}

function addressSummary(user: SupportEmailProfile["user"]) {
  if (user.location) return user.location;
  const coordinates = user.coordinates;
  if (!coordinates) return null;
  return [
    [coordinates.street, coordinates.streetNumber].filter(Boolean).join(" "),
    coordinates.postalCode,
    coordinates.city,
    coordinates.region,
    coordinates.countryName ?? coordinates.countryISO,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");
}

function supportEmailDisplayName(user: SupportEmailProfile["user"]) {
  const fullName = [user.firstName, user.lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");

  return (
    fullName ||
    user.username?.trim() ||
    user.email?.trim() ||
    user.id ||
    "Infinisimo user"
  );
}

function userProfileRows(input: {
  profile: SupportEmailProfile;
  clerkUserId: string;
}) {
  const { user } = input.profile;
  return compactRows([
    ["Email", user.email],
    ["Payload user ID", user.id],
    ["Clerk user ID", input.clerkUserId],
    ["First name", user.firstName],
    ["Last name", user.lastName],
    ["Username", user.username],
    ["Roles", user.roles],
    ["Preferred language", user.language],
    ["Country", user.country ?? user.coordinates?.countryName],
    ["Country ISO", user.coordinates?.countryISO],
    ["City", user.coordinates?.city],
    ["Region / state", user.coordinates?.region],
    ["Postal code", user.coordinates?.postalCode],
    ["Address summary", addressSummary(user)],
    ["Created at", user.createdAt],
  ]);
}

function tenantProfileRows(tenant: SupportEmailTenant) {
  return compactRows([
    ["Tenant ID", tenant.id],
    ["Tenant name", tenant.name],
    ["Tenant slug", tenant.slug],
    ["Business country", tenant.country],
    ["Hourly rate", tenant.hourlyRate == null ? null : `EUR ${tenant.hourlyRate}`],
    ["Services", tenant.services],
    ["Categories", tenant.categories],
    ["Subcategories", tenant.subcategories],
    ["Phone", tenant.phone],
    ["Website", tenant.website],
    ["Stripe onboarding status", tenant.onboardingStatus],
    ["Stripe details submitted", tenant.stripeDetailsSubmitted],
    ["Charges enabled", tenant.chargesEnabled],
    ["Payouts enabled", tenant.payoutsEnabled],
    ["VAT registered", tenant.vatRegistered],
    ["VAT ID valid", tenant.vatIdValid],
  ]);
}

function requestContextRows(input: {
  locale: AppLang;
  threadId?: string;
  currentUrl?: string;
}) {
  return compactRows([
    ["Locale", input.locale],
    ["Thread ID", input.threadId],
    ["Current URL", input.currentUrl],
    ["Timestamp", new Date().toISOString()],
  ]);
}

function selectedOrderRows(
  selectedOrder: ReturnType<typeof selectedOrderMetadata>,
) {
  if (!selectedOrder?.verified) return [];
  return compactRows([
    ["Reference type", selectedOrder.referenceType],
    ["Reference", selectedOrder.reference],
    ["Label", selectedOrder.label],
  ]);
}

async function resolveSupportEmailProfile(input: {
  db: Payload;
  clerkUserId: string;
}): Promise<SupportEmailProfile | null> {
  const result = await input.db.find({
    collection: "users",
    where: { clerkUserId: { equals: input.clerkUserId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const user = result.docs?.[0] as SupportEmailUser | undefined;
  const email = normalizeEmail(user?.email);
  if (!user?.id || !email) return null;

  const tenantResult = await input.db.find({
    collection: "tenants",
    where: { user: { equals: user.id } },
    limit: 3,
    depth: 1,
    overrideAccess: true,
  });

  return {
    user: { ...user, id: user.id, email },
    tenants: (tenantResult.docs ?? []) as SupportEmailTenant[],
  };
}

function selectedOrderMetadata(input: {
  selectedOrderContext?: SendSupportEmailHandoffInput["selectedOrderContext"];
  threadId?: string;
}) {
  if (!input.selectedOrderContext || !input.threadId) return null;

  const verified = verifySelectedOrderContextToken({
    token: input.selectedOrderContext.token,
    threadId: input.threadId,
  });

  if (!verified.ok) return { verified: false as const };

  return {
    verified: true as const,
    referenceType: verified.input.referenceType,
    reference: verified.input.reference,
    label: verified.displayLabel,
  };
}

function buildSupportEmailBody(input: {
  profile: SupportEmailProfile;
  clerkUserId: string;
  message: string;
  locale: AppLang;
  threadId?: string;
  currentUrl?: string;
  selectedOrder: ReturnType<typeof selectedOrderMetadata>;
}) {
  const displayName = supportEmailDisplayName(input.profile.user);
  const userRows = userProfileRows({
    profile: input.profile,
    clerkUserId: input.clerkUserId,
  });
  const tenantSections = input.profile.tenants
    .map((tenant) => ({
      title: tenant.name
        ? `Service provider profile: ${tenant.name}`
        : "Service provider profile",
      rows: tenantProfileRows(tenant),
    }))
    .filter((section) => section.rows.length > 0);
  const contextRows = requestContextRows({
    locale: input.locale,
    threadId: input.threadId,
    currentUrl: input.currentUrl,
  });
  const orderRows = selectedOrderRows(input.selectedOrder);

  const textSections = [
    `Support request from ${displayName}`,
    "",
    "Message:",
    input.message,
    "",
    renderTextSection("User profile", userRows),
    ...tenantSections.map((section) =>
      renderTextSection(section.title, section.rows),
    ),
    renderTextSection("Request context", contextRows),
    orderRows.length > 0 ? renderTextSection("Selected order", orderRows) : null,
  ].filter((line): line is string => line !== null);

  const text = textSections.join("\n");
  const htmlSections = [
    `<h2>Support request from ${escapeHtml(displayName)}</h2>`,
    "<h3>Message</h3>",
    `<p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    renderHtmlTable("User profile", userRows),
    ...tenantSections.map((section) =>
      renderHtmlTable(section.title, section.rows),
    ),
    renderHtmlTable("Request context", contextRows),
    orderRows.length > 0 ? renderHtmlTable("Selected order", orderRows) : null,
  ].filter((section): section is string => section !== null);
  const html = `<div>${htmlSections.join("\n")}</div>`;

  return { text, html, displayName };
}

function renderTextSection(
  title: string,
  rows: readonly (readonly [string, string])[],
) {
  return [
    `${title}:`,
    ...rows.map(([label, value]) => `- ${label}: ${value}`),
  ].join("\n");
}

function renderHtmlTable(
  title: string,
  rows: readonly (readonly [string, string])[],
) {
  if (rows.length === 0) return null;
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><th style="padding:6px 10px;text-align:left;border:1px solid #ddd;background:#f6f6f6;vertical-align:top">${escapeHtml(label)}</th><td style="padding:6px 10px;border:1px solid #ddd;vertical-align:top">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `<h3>${escapeHtml(title)}</h3><table style="border-collapse:collapse;margin:0 0 16px 0">${body}</table>`;
}

async function defaultSendEmail(args: SendEmailArgs) {
  const { sendEmail } = await import("@/modules/email/send");
  return sendEmail(args);
}

export async function sendSupportEmailHandoff(
  input: SendSupportEmailHandoffInput,
) {
  const to = supportInbox();
  if (!to) {
    return { ok: false as const, reason: "missing_support_inbox" as const };
  }

  const profile = await resolveSupportEmailProfile({
    db: input.db,
    clerkUserId: input.clerkUserId,
  });

  if (!profile) {
    return { ok: false as const, reason: "missing_user_email" as const };
  }

  const selectedOrder = selectedOrderMetadata({
    selectedOrderContext: input.selectedOrderContext,
    threadId: input.threadId,
  });

  const body = buildSupportEmailBody({
    profile,
    clerkUserId: input.clerkUserId,
    message: input.message,
    locale: input.locale,
    threadId: input.threadId,
    currentUrl: input.currentUrl,
    selectedOrder,
  });

  const sendEmailImpl = input.sendEmailImpl ?? defaultSendEmail;
  const result = await sendEmailImpl({
    to,
    replyTo: profile.user.email,
    subject: `Support request from ${body.displayName}`,
    text: body.text,
    html: body.html,
    headers: {
      "X-Infinisimo-Email-Type": "support-chat-handoff",
      "X-Infinisimo-User-Id": input.clerkUserId,
    },
  });

  return { ok: true as const, result };
}
