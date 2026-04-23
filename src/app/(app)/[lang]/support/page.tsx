import { isLocaleSegment } from "@/i18n/routing";
import { type AppLang } from "@/lib/i18n/app-lang";
import { SupportChatView } from "@/modules/support-chat/ui/support-chat-view";
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

  return <SupportChatView lang={rawLang as AppLang} />;
}
