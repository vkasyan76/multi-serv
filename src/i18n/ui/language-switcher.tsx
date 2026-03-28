"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactCountryFlag from "react-country-flag";

import {
  SUPPORTED_LANGUAGES,
  normalizeToSupported,
  type AppLang,
} from "@/lib/i18n/app-lang";
import {
  mirrorLocaleCookie,
  stripLeadingLocale,
  withLocalePrefix,
} from "@/i18n/routing";
import { useTRPC } from "@/trpc/client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LANGUAGE_TO_COUNTRY: Record<AppLang, string> = {
  en: "GB",
  de: "DE",
  fr: "FR",
  it: "IT",
  es: "ES",
  pt: "PT",
  pl: "PL",
  ro: "RO",
  uk: "UA",
};

type Props = {
  className?: string;
  onNavigate?: () => void;
  isAuthenticated?: boolean;
};

export function LanguageSwitcher({
  className,
  onNavigate,
  isAuthenticated = false,
}: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");

  const { restPathname, lang: routeLang } = useMemo(
    () => stripLeadingLocale(pathname || "/"),
    [pathname],
  );

  const currentLang = normalizeToSupported(routeLang);
  const [pendingLang, setPendingLang] = useState<AppLang | null>(null);
  const effectiveLang = pendingLang ?? currentLang;
  const currentLabel =
    SUPPORTED_LANGUAGES.find((l) => l.code === effectiveLang)?.label ??
    effectiveLang;

  useEffect(() => {
    // Route locale stays authoritative; clear the optimistic selection once
    // navigation catches up to the new locale.
    setPendingLang(null);
  }, [currentLang]);

  const persistLanguage = useMutation(
    trpc.auth.updateLanguagePreference.mutationOptions({
      onSuccess: async ({ language }) => {
        // Keep profile language in sync until the fresh server response lands.
        queryClient.setQueryData(
          trpc.auth.getUserProfile.queryOptions().queryKey,
          (prev) =>
            prev
              ? {
                  ...prev,
                  language,
                }
              : prev,
        );

        await queryClient.invalidateQueries({
          queryKey: trpc.auth.getUserProfile.queryOptions().queryKey,
        });
      },
      onError: (error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to persist language preference", error);
        }
      },
    }),
  );

  const onChange = (next: string) => {
    const newLang = normalizeToSupported(next);
    if (newLang === effectiveLang) return;

    // Update the trigger immediately so the old route locale does not linger
    // in the switcher while the next localized route is loading.
    setPendingLang(newLang);

    const nextPath = withLocalePrefix(restPathname, newLang);
    const query = searchParams?.toString() ?? "";
    const url = query ? `${nextPath}?${query}` : nextPath;

    // Keep the bootstrap cookie aligned with explicit user language changes.
    mirrorLocaleCookie(newLang);
    router.push(url);
    if (isAuthenticated) {
      persistLanguage.mutate({ language: newLang });
    }
    onNavigate?.();
  };

  return (
    <Select value={effectiveLang} onValueChange={onChange}>
      <SelectTrigger
        className={className}
        aria-label={t("a11y.language_selector")}
      >
        <SelectValue>
          <span className="flex items-center gap-2">
            <ReactCountryFlag
              countryCode={LANGUAGE_TO_COUNTRY[effectiveLang]}
              svg
              style={{ width: "1.2em", height: "1.2em" }}
            />
            <span className="truncate">{currentLabel}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map(({ code, label }) => (
          <SelectItem key={code} value={code}>
            <span className="flex items-center gap-2">
              <ReactCountryFlag
                countryCode={LANGUAGE_TO_COUNTRY[code]}
                svg
                style={{ width: "1.2em", height: "1.2em" }}
              />
              <span>{label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
