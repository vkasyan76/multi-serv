import "server-only";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocaleSegment } from "@/i18n/routing";
import { type AppLang } from "@/lib/i18n/app-lang";
import { getMessages } from "next-intl/server";
import { IntlProvider } from "@/i18n/intl-provider";
import { CookieConsentRoot } from "@/modules/legal/cookies/ui/cookie-consent-root";
import { VercelAnalyticsConsent } from "@/modules/legal/cookies/ui/consents/vercel-analytics-consent";

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

  // Keep locale-scoped NextIntl context reactive on locale navigation.
  const messages = await getMessages();
  return (
    <IntlProvider locale={appLang} messages={messages}>
      {children}
      {/* Keep cookie UI inside locale-scoped intl context. */}
      <CookieConsentRoot />
      <VercelAnalyticsConsent />
    </IntlProvider>
  );
}
