"use client";

import { useEffect } from "react";
import { toast } from "sonner";

type ParsedNotice =
  | { kind: "invalid" }
  | { kind: "expired"; code: string };

type Props = {
  notice?: string | null;
};

const REFERRAL_CODE_RE = /^[A-Z0-9_-]{3,64}$/;

const NOTICE_MESSAGES_EN = {
  invalid: "This referral link is invalid. You can still register normally.",
  expired: (code: string) =>
    `This referral code ${code} is no longer active. You can still register normally.`,
};

function parseNotice(raw?: string | null): ParsedNotice | null {
  if (!raw) return null;
  // Cookies can arrive URL-encoded (e.g. expired%3AREF2026).
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  if (decoded === "invalid") return { kind: "invalid" };

  if (decoded.startsWith("expired:")) {
    const code = decoded.slice("expired:".length).trim();
    if (REFERRAL_CODE_RE.test(code)) {
      return { kind: "expired", code };
    }
  }

  return null;
}

export function ReferralNotice({ notice }: Props) {
  useEffect(() => {
    const parsed = parseNotice(notice);
    if (!parsed) return;

    const key =
      parsed.kind === "expired" ? `expired:${parsed.code}` : "invalid";
    const storageKey = `ref_notice_shown:${key}`;
    try {
      if (sessionStorage.getItem(storageKey) === "1") return;
    } catch {
      // Storage can be unavailable in restricted browsing modes.
    }

    const message =
      parsed.kind === "expired"
        ? NOTICE_MESSAGES_EN.expired(parsed.code)
        : NOTICE_MESSAGES_EN.invalid;

    // Lightweight UX notice: auto-dismiss + manual close.
    // Defer one tick so toast always fires after Toaster is mounted.
    const timerId = setTimeout(() => {
      // Keep global toaster defaults; center position is scoped to referral notices only.
      toast.info(<span className="block w-full text-center">{message}</span>, {
        id: storageKey,
        duration: 6000,
        closeButton: true,
        position: "top-center",
      });
      try {
        // TODO(i18n): move referral notice copy into the global translation dictionary.
        // Mark only after toast invocation to avoid false suppression.
        sessionStorage.setItem(storageKey, "1");
      } catch {
        // Ignore storage errors.
      }
    }, 0);
    return () => clearTimeout(timerId);
  }, [notice]);

  return null;
}
