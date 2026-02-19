"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { normalizeToSupported, type AppLang } from "@/lib/i18n/app-lang";

type ParsedNotice =
  | { kind: "invalid" }
  | { kind: "expired"; code: string };

type Props = {
  notice?: string | null;
};

const REFERRAL_CODE_RE = /^[A-Z0-9_-]{3,64}$/;

const NOTICE_MESSAGES: Record<
  AppLang,
  {
    invalid: string;
    expired: (code: string) => string;
  }
> = {
  en: {
    invalid: "This referral link is invalid. You can still register normally.",
    expired: (code) =>
      `This referral code ${code} is no longer active. You can still register normally.`,
  },
  de: {
    invalid:
      "Dieser Empfehlungslink ist ungueltig. Du kannst dich trotzdem normal registrieren.",
    expired: (code) =>
      `Der Empfehlungscode ${code} ist nicht mehr aktiv. Du kannst dich trotzdem normal registrieren.`,
  },
  fr: {
    invalid:
      "Ce lien de parrainage est invalide. Vous pouvez quand meme vous inscrire normalement.",
    expired: (code) =>
      `Ce code de parrainage ${code} n'est plus actif. Vous pouvez quand meme vous inscrire normalement.`,
  },
  it: {
    invalid:
      "Questo link di referral non e valido. Puoi comunque registrarti normalmente.",
    expired: (code) =>
      `Il codice referral ${code} non e piu attivo. Puoi comunque registrarti normalmente.`,
  },
  es: {
    invalid:
      "Este enlace de referido no es valido. Aun puedes registrarte normalmente.",
    expired: (code) =>
      `Este codigo de referido ${code} ya no esta activo. Aun puedes registrarte normalmente.`,
  },
  pt: {
    invalid:
      "Este link de indicacao e invalido. Voce ainda pode se registrar normalmente.",
    expired: (code) =>
      `Este codigo de indicacao ${code} nao esta mais ativo. Voce ainda pode se registrar normalmente.`,
  },
};

function getNoticeLang(): AppLang {
  if (typeof document !== "undefined") {
    const htmlLang = document.documentElement?.lang;
    if (htmlLang) return normalizeToSupported(htmlLang);
  }

  if (typeof navigator !== "undefined") {
    const preferred =
      navigator.languages?.find((lang) => !!lang) ?? navigator.language;
    if (preferred) return normalizeToSupported(preferred);
  }

  return "en";
}

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
    const lang = getNoticeLang();
    const copy = NOTICE_MESSAGES[lang];

    const key =
      parsed.kind === "expired" ? `expired:${parsed.code}` : "invalid";
    const storageKey = `ref_notice_shown:${key}`;
    if (sessionStorage.getItem(storageKey) === "1") {
      return;
    }

    const message =
      parsed.kind === "expired"
        ? copy.expired(parsed.code)
        : copy.invalid;

    // Lightweight UX notice: auto-dismiss + manual close.
    // Defer one tick so toast always fires after Toaster is mounted.
    setTimeout(() => {
      // Keep global toaster defaults; center position is scoped to referral notices only.
      toast.info(<span className="block w-full text-center">{message}</span>, {
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
