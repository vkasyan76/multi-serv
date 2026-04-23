"use client";

import { useTranslations } from "next-intl";
import { type AppLang } from "@/lib/i18n/app-lang";
import { SupportChatLauncher } from "@/modules/support-chat/ui/support-chat-launcher";
import { SupportChatRouteOpener } from "@/modules/support-chat/ui/support-chat-route-opener";

export function SupportChatView({ lang }: { lang: AppLang }) {
  const t = useTranslations("supportChat");

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-neutral-50 px-4 py-10" lang={lang}>
      <SupportChatRouteOpener />
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="max-w-xl text-sm text-muted-foreground">{t("lead")}</p>
        <SupportChatLauncher>{t("launcher")}</SupportChatLauncher>
      </div>
    </main>
  );
}
