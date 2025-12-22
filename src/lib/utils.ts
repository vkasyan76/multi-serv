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

export const platformHomeHref = () =>
  process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === "true"
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}` // e.g. https://infinisimo.com
    : `/`;
