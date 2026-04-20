import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { SupportChatEntryPlaceholder } from "@/modules/support-chat/ui/support-chat-entry-placeholder";

export default async function SupportPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  normalizeToSupported(lang);

  return <SupportChatEntryPlaceholder />;
}
