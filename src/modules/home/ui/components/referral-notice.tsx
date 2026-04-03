"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("common");

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
        // Keep referral code dynamic via message interpolation.
        ? t("toast.referral.expired", { code: parsed.code })
        : t("toast.referral.invalid");

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
        // Mark only after toast invocation to avoid false suppression.
        sessionStorage.setItem(storageKey, "1");
      } catch {
        // Ignore storage errors.
      }
    }, 0);
    return () => clearTimeout(timerId);
  }, [notice, t]);

  return null;
}
