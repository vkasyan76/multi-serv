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
    if (sessionStorage.getItem(storageKey) === "1") {
      return;
    }

    const message =
      parsed.kind === "expired"
        ? `This referral code ${parsed.code} is no longer active. You can still register normally.`
        : "This referral link is invalid. You can still register normally.";

    // Lightweight UX notice: auto-dismiss + manual close.
    // Defer one tick so toast always fires after Toaster is mounted.
    setTimeout(() => {
      // Keep global toaster defaults; center position is scoped to referral notices only.
      toast.info(message, {
        id: storageKey,
        duration: 6000,
        closeButton: true,
        position: "top-center",
      });
    }, 0);
    sessionStorage.setItem(storageKey, "1");
  }, [notice]);

  return null;
}
