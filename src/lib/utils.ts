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
