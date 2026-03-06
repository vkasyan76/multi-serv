import "server-only";
import { notFound } from "next/navigation";
import { getMessages, setRequestLocale } from "next-intl/server";
import { isLocaleSegment } from "@/i18n/routing";
import { type AppLang } from "@/lib/i18n/app-lang";
import { IntlProvider } from "@/i18n/intl-provider";

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

  const messages = await getMessages();

  return (
    <IntlProvider locale={appLang} messages={messages}>
      {children}
    </IntlProvider>
  );
}
