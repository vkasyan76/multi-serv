"use client";

import { Analytics } from "@vercel/analytics/next";
import { CookieGate } from "@/modules/legal/cookies/ui/cookie-gate";

export function VercelAnalyticsConsent() {
  return (
    <CookieGate kind="analytics">
      <Analytics />
    </CookieGate>
  );
}
