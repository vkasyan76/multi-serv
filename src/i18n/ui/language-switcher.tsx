"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import {
  SUPPORTED_LANGUAGES,
  normalizeToSupported,
  type AppLang,
} from "@/lib/i18n/app-lang";
import { stripLeadingLocale, withLocalePrefix } from "@/i18n/routing";

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
};

export function LanguageSwitcher({ className, onNavigate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");

  const { restPathname, lang: routeLang } = useMemo(
    () => stripLeadingLocale(pathname || "/"),
    [pathname],
  );

  const currentLang = normalizeToSupported(routeLang);
  const currentLabel =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.label ??
    currentLang;

  const onChange = (next: string) => {
    const newLang = normalizeToSupported(next);
    if (newLang === currentLang) return;

    const nextPath = withLocalePrefix(restPathname, newLang);
    const query = searchParams?.toString() ?? "";
    const url = query ? `${nextPath}?${query}` : nextPath;

    router.push(url);
    onNavigate?.();
  };

  return (
    <Select value={currentLang} onValueChange={onChange}>
      <SelectTrigger
        className={className}
        aria-label={t("a11y.language_selector")}
      >
        <SelectValue>
          <span className="flex items-center gap-2">
            <ReactCountryFlag
              countryCode={LANGUAGE_TO_COUNTRY[currentLang]}
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
