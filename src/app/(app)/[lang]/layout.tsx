import "server-only";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocaleSegment } from "@/i18n/routing";
import { type AppLang } from "@/lib/i18n/app-lang";

export default async function LocaleSegmentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const rawLang = lang.toLowerCase();

  // URL locale is authoritative for /[lang] routes.
  if (!isLocaleSegment(rawLang)) {
    notFound();
  }

  const appLang: AppLang = rawLang;

  // Pin next-intl request locale to the URL segment for deterministic message loading.
  setRequestLocale(appLang);

  // Root (app)/layout owns NextIntl provider; this layout only validates/pins URL locale.
  return children;
}
