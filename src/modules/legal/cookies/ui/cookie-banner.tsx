"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";

type CookieBannerProps = {
  onAcceptAllAction: () => void;
  onDeclineAllAction: () => void;
  onManageAction: () => void;
};

export function CookieBanner({
  onAcceptAllAction,
  onDeclineAllAction,
  onManageAction,
}: CookieBannerProps) {
  const t = useTranslations("common");
  const params = useParams<{ lang?: string }>();
  const lang = normalizeToSupported(params?.lang);

  // Cookie policy URL follows the active locale segment.
  const href = (pathnameWithQuery: string) => {
    const [pathPart, query = ""] = pathnameWithQuery.split("?");
    const localizedPath = withLocalePrefix(pathPart || "/", lang);
    return query ? `${localizedPath}?${query}` : localizedPath;
  };

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="text-sm leading-relaxed text-muted-foreground">
          {/* Rich translation keeps sentence structure language-safe around inline link/button. */}
          {t.rich("cookie.banner.full", {
            policy: (chunks) => (
              <Link
                href={href("/legal/cookies")}
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                {chunks}
              </Link>
            ),
            manage: (chunks) => (
              <button
                type="button"
                onClick={onManageAction}
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                {chunks}
              </button>
            ),
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onDeclineAllAction}
          >
            {t("buttons.decline")}
          </Button>

          <Button
            type="button"
            className="w-full sm:w-auto bg-black text-white hover:bg-pink-400 hover:text-black"
            onClick={onAcceptAllAction}
          >
            {t("buttons.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
