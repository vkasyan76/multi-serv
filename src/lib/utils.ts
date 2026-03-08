import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateTenantUrl(tenantSlug: string) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isSubdomainRoutingEnabled =
    process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true"; // Set it to “true” env variables can only be strings

  // In development or subdomain routing disabled mode, use normal routing
  if (isDevelopment || !isSubdomainRoutingEnabled) {
    // return `${process.env.NEXT_PUBLIC_APP_URL}/tenants/${tenantSlug}`;
    return `/tenants/${tenantSlug}`; // relative path for SPA nav & prefetch
  }

  const protocol = "https";
  const domain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

  // In production, use subdomain routing
  return `${protocol}://${tenantSlug}.${domain}`;
}

// used in tenant dashboard navbar
export const tenantPublicHref = (slug: string) =>
  process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true"
    ? generateTenantUrl(slug) // -> change form  ? "/" after we stopped using rewrites for dashboard
    : `/tenants/${slug}`;

//  alternative (simple version)
// export const tenantPublicHref = (slug: string) => generateTenantUrl(slug);

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

  return `https://${rootDomain}`; // e.g. https://infinisimo.com
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

  // Base app URL for dev / non-subdomain mode
  const appUrl = stripTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  );

  if (isDevelopment || !isSubdomainRoutingEnabled) {
    return appUrl;
  }

  if (!tenantSlug) {
    // caller must provide slug in subdomain mode
    throw new Error("tenantSlug is required when subdomain routing is enabled");
  }

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root) throw new Error("NEXT_PUBLIC_ROOT_DOMAIN missing");

  return `https://${tenantSlug}.${root}`;
}
