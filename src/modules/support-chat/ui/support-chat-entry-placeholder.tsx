import { type AppLang } from "@/lib/i18n/app-lang";
import {
  SUPPORT_CHAT_ACCOUNT_AWARE,
  SUPPORT_CHAT_PHASE,
} from "@/modules/support-chat/lib/boundaries";
import { useTranslations } from "next-intl";

export function SupportChatEntryPlaceholder({ lang }: { lang: AppLang }) {
  const t = useTranslations("supportChat");

  return (
    <main className="container mx-auto px-4 py-10" lang={lang}>
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>

        <p className="text-sm text-neutral-700">{t("lead")}</p>

        <p className="text-sm text-neutral-700">
          {t("phaseCopy", { phase: SUPPORT_CHAT_PHASE })}
        </p>

        {!SUPPORT_CHAT_ACCOUNT_AWARE ? (
          <p className="text-sm text-neutral-700">{t("accountAwareNotice")}</p>
        ) : null}
      </div>
    </main>
  );
}
