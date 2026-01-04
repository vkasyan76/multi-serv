"use client";

import { CookieGate } from "@/modules/legal/cookies/ui/cookie-gate";

export function AdvertisingConsent() {
  // Intentionally empty until we integrate an advertising vendor (e.g., Google Ads, MetaPixel, etc.).
  // Then we add it in teh app layout just like Vercel Analytics consent.
  return <CookieGate kind="advertising">{null}</CookieGate>;
}
