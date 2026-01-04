"use client";

import { useCallback, useEffect, useState } from "react";
// IMPORTANT: import from the same place CookieConsentRoot imports it from.
// In your repo this is typically: "../consent"
import { readClientConsent } from "../consent";

const CONSENT_UPDATED_EVENT = "cookie-consent-updated";

type Props = {
  children: React.ReactNode;
  kind?: "analytics" | "advertising";
};

export function CookieGate({ children, kind = "analytics" }: Props) {
  const [enabled, setEnabled] = useState(false);

  const refresh = useCallback(() => {
    const c = readClientConsent();
    const prefs = c?.prefs ?? null;

    if (!prefs) {
      setEnabled(false); // no consent yet => treat as OFF for non-essential
      return;
    }

    const allowed =
      kind === "analytics"
        ? !!prefs.analytics
        : kind === "advertising"
          ? !!prefs.advertising
          : false;

    setEnabled(allowed);
  }, [kind]);

  useEffect(() => {
    refresh();

    // Update live when consent changes (recommended)
    window.addEventListener(CONSENT_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, refresh);
  }, [refresh]);

  if (!enabled) return null;
  return <>{children}</>;
}
