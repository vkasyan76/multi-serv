import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { normalizeToSupported } from "@/lib/i18n/app-lang";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getTenantLocalePrefix(appLang?: string | null) {
  return appLang ? `/${normalizeToSupported(appLang)}` : "";
}

export function generateTenantUrl(tenantSlug: string, appLang?: string | null) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isSubdomainRoutingEnabled =
    process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true";
  const localePrefix = getTenantLocalePrefix(appLang);

  if (isDevelopment || !isSubdomainRoutingEnabled) {
    return localePrefix
      ? `${localePrefix}/tenants/${tenantSlug}`
      : `/tenants/${tenantSlug}`;
  }

  const protocol = "https";
  const domain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

  return `${protocol}://${tenantSlug}.${domain}${localePrefix}`;
}

export const tenantPublicHref = (slug: string, appLang?: string | null) => {
  const localePrefix = getTenantLocalePrefix(appLang);

  return process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true"
    ? generateTenantUrl(slug, appLang)
    : localePrefix
      ? `${localePrefix}/tenants/${slug}`
      : `/tenants/${slug}`;
};

export const platformHomeHref = () => {
  if (process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING !== "true") {
    return "/";
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  if (
    !rootDomain ||
    rootDomain === "undefined" ||
    rootDomain.startsWith("http://") ||
    rootDomain.startsWith("https://")
  ) {
    // Fall back to local platform routing when the root domain is not configured safely.
    return "/";
  }

  return `https://${rootDomain}`;
};

function stripTrailingSlash(v: string) {
  return v.replace(/\/+$/, "");
}

/**
 * Always returns an absolute origin (no path), e.g.
 * - dev: http://localhost:3000
 * - prod (no subdomains): https://infinisimo.com
 * - prod (subdomains): https://tenantSlug.infinisimo.com
 */
export function getTenantOrigin(tenantSlug?: string | null) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isSubdomainRoutingEnabled =
    process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true";

  const appUrl = stripTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  );

  if (isDevelopment || !isSubdomainRoutingEnabled) {
    return appUrl;
  }

  if (!tenantSlug) {
    throw new Error("tenantSlug is required when subdomain routing is enabled");
  }

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root) throw new Error("NEXT_PUBLIC_ROOT_DOMAIN missing");

  return `https://${tenantSlug}.${root}`;
}
