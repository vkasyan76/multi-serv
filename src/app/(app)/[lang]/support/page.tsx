import { isLocaleSegment } from "@/i18n/routing";
import { type AppLang } from "@/lib/i18n/app-lang";
import { SupportChatEntryPlaceholder } from "@/modules/support-chat/ui/support-chat-entry-placeholder";
import { notFound } from "next/navigation";

export default async function SupportPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const rawLang = lang.toLowerCase();

  if (!isLocaleSegment(rawLang)) {
    notFound();
  }

  return <SupportChatEntryPlaceholder lang={rawLang as AppLang} />;
}
