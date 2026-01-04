"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_COOKIE_PREFS,
  readClientConsent,
  writeClientConsent,
  type CookieConsent,
  type CookieConsentPrefs,
} from "../consent";
import { CookieBanner } from "./cookie-banner";
import { CookiePreferencesDialog } from "./cookie-preferences-dialog";

const OPEN_COOKIE_PREFS_EVENT = "open-cookie-preferences";

export function CookieConsentRoot() {
  const [mounted, setMounted] = useState(false);

  const [consent, setConsent] = useState<CookieConsent | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefs, setPrefs] = useState<CookieConsentPrefs>(DEFAULT_COOKIE_PREFS);

  const refreshFromCookie = useCallback(() => {
    const c = readClientConsent();
    setConsent(c);

    // If cookie exists, use it as source of truth for dialog toggles
    if (c) {
      setPrefs({
        analytics: !!c.prefs.analytics,
        advertising: !!c.prefs.advertising,
      });
    } else {
      setPrefs(DEFAULT_COOKIE_PREFS);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    refreshFromCookie();
  }, [refreshFromCookie]);

  // Allow opening preferences dialog from anywhere (e.g., Footer link)
  useEffect(() => {
    if (!mounted) return;

    const handler = () => setDialogOpen(true);
    window.addEventListener(OPEN_COOKIE_PREFS_EVENT, handler);
    return () => window.removeEventListener(OPEN_COOKIE_PREFS_EVENT, handler);
  }, [mounted]);

  const shouldShowBanner = useMemo(() => {
    return mounted && !consent && !dialogOpen;
  }, [mounted, consent, dialogOpen]);

  const acceptAllAction = useCallback(() => {
    const next = writeClientConsent({ analytics: true, advertising: true });
    setConsent(next);
    setPrefs(next.prefs);
  }, []);

  const declineAllAction = useCallback(() => {
    const next = writeClientConsent({ analytics: false, advertising: false });
    setConsent(next);
    setPrefs(next.prefs);
  }, []);

  const manageAction = useCallback(() => {
    // Ensure dialog reflects latest cookie state
    refreshFromCookie();
    setDialogOpen(true);
  }, [refreshFromCookie]);

  const setOpenAction = useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      if (!open) {
        // If user cancels/closes, revert toggles back to cookie state
        refreshFromCookie();
      }
    },
    [refreshFromCookie]
  );

  const setPrefsAction = useCallback((next: CookieConsentPrefs) => {
    setPrefs({
      analytics: !!next.analytics,
      advertising: !!next.advertising,
    });
  }, []);

  const savePreferencesAction = useCallback(() => {
    const next = writeClientConsent(prefs);
    setConsent(next);
    setPrefs(next.prefs);
    setDialogOpen(false);
  }, [prefs]);

  if (!mounted) return null;

  return (
    <>
      {shouldShowBanner && (
        <CookieBanner
          onAcceptAllAction={acceptAllAction}
          onDeclineAllAction={declineAllAction}
          onManageAction={manageAction}
        />
      )}

      <CookiePreferencesDialog
        open={dialogOpen}
        setOpenAction={setOpenAction}
        prefs={prefs}
        setPrefsAction={setPrefsAction}
        onSaveAction={savePreferencesAction}
      />
    </>
  );
}
