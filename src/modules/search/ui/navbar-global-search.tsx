"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function NavbarGlobalSearch() {
  const t = useTranslations("common");

  return (
    <div className="flex h-11 w-full min-w-0 items-center gap-3 rounded-full border border-black/10 bg-[#F4F4F0] px-4 text-base text-neutral-500">
      <SearchIcon className="size-4 shrink-0" />
      <span className="truncate">
        {t("nav.global_search_placeholder")}
      </span>
    </div>
  );
}
