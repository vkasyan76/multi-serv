"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactCountryFlag from "react-country-flag";

import {
  DEFAULT_APP_LANG,
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
import LoadingPage from "@/components/shared/loading";

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

  // Route locale is authoritative in Phase 6, so the switcher intentionally
  // follows the localized pathname instead of deriving active language from a
  // separate client-side preference source.
  const currentLang = normalizeToSupported(routeLang);
  const [pendingLang, setPendingLang] = useState<AppLang | null>(null);
  const [isPending, startTransition] = useTransition();
  const effectiveLang = pendingLang ?? currentLang;
  // Reuse the canonical locale registry for both label and flag display.
  const currentLanguage =
    SUPPORTED_LANGUAGES.find((language) => language.code === effectiveLang) ??
    SUPPORTED_LANGUAGES.find((language) => language.code === DEFAULT_APP_LANG)!;

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
  const isSwitching = isPending || persistLanguage.isPending;

  const onChange = (next: string) => {
    // Keep language writes single-flight so profile preference updates cannot
    // land out of order if the user taps the switcher again mid-save.
    if (isSwitching) return;

    const newLang = normalizeToSupported(next);
    if (newLang === effectiveLang) return;

    // Update the trigger immediately so the old route locale does not linger
    // in the switcher while the next localized route is loading.
    setPendingLang(newLang);

    const nextPath = withLocalePrefix(restPathname, newLang);
    const query = searchParams?.toString() ?? "";
    // Preserve in-page anchors so language switches do not jump the user away
    // from the currently targeted section.
    const hash =
      typeof window !== "undefined" ? window.location.hash ?? "" : "";
    const url = `${query ? `${nextPath}?${query}` : nextPath}${hash}`;

    // Keep the bootstrap cookie aligned with explicit user language changes.
    mirrorLocaleCookie(newLang);
    // Show the loader immediately while the next locale route is still
    // switching, before the route-level skeleton has time to paint.
    startTransition(() => {
      router.push(url);
    });
    if (isAuthenticated) {
      persistLanguage.mutate({ language: newLang });
    }
    onNavigate?.();
  };

  return (
    <>
      {isPending ? <LoadingPage /> : null}
      <Select
        value={effectiveLang}
        onValueChange={onChange}
        disabled={isSwitching}
      >
        <SelectTrigger
          className={className}
          aria-label={t("a11y.language_selector")}
          aria-busy={isSwitching}
        >
          <SelectValue>
            <span className="flex items-center gap-2">
              <ReactCountryFlag
                countryCode={currentLanguage.countryCode}
                svg
                style={{ width: "1.2em", height: "1.2em" }}
              />
              <span className="truncate">{currentLanguage.label}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map(({ code, label, countryCode }) => (
            <SelectItem key={code} value={code}>
              <span className="flex items-center gap-2">
                <ReactCountryFlag
                  countryCode={countryCode}
                  svg
                  style={{ width: "1.2em", height: "1.2em" }}
                />
                <span>{label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
