import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { CategoriesGetManyOutput } from "@/modules/categories/types";
import { cn } from "@/lib/utils";
import { withLocalePrefix } from "@/i18n/routing";
import type { AppLang } from "@/lib/i18n/app-lang";

interface Props {
  category: CategoriesGetManyOutput[1];
  lang: AppLang;
  isOpen: boolean;
  activeSubcategory?: string;
}

export const SubcategoryMenu = ({
  category,
  lang,
  isOpen,
  activeSubcategory,
}: Props) => {
  if (
    !isOpen ||
    !category.subcategories ||
    category.subcategories.length === 0
  ) {
    return null;
  }

  const backgroundColor = category.color || "#F5F5F5";
  // Keep submenu treatment visually consistent across category colors. White
  // text reads more intentional here than switching between dark/light modes.
  const textColor = "#ffffff";
  const textShadow =
    "0 1px 2px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.85)";
  const rowHoverClass = "hover:bg-white/12";
  const activeRowClass = "bg-white/18";
  const dividerClass = "border-white/15";
  const panelBorderClass = "border-white/20";
  const chevronClass = "text-white/75";

  return (
    <div
      className="absolute z-100"
      style={{
        top: "100%",
        left: 0,
      }}
    >
      {/* Invisible bridge to maintain hover */}
      <div className="h-3 w-60" />
      <div
        style={{ backgroundColor }}
        className={cn(
          "w-64 overflow-hidden rounded-xl border shadow-[4px_4px_12px_rgba(0,0,0,0.18)] -translate-x-[2px] -translate-y-[2px]",
          panelBorderClass
        )}
      >
        <div>
          {category.subcategories?.map((subcategory) => (
            <Link
              key={subcategory.slug}
              href={withLocalePrefix(
                `/${category.slug}/${subcategory.slug}`,
                lang,
              )}
              className={cn(
                "flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left text-sm font-medium leading-snug transition-colors last:border-b-0",
                rowHoverClass,
                dividerClass,
                activeSubcategory === subcategory.slug && activeRowClass
              )}
              style={{
                color: textColor,
                textShadow,
              }}
            >
              <span className="min-w-0 flex-1">{subcategory.name}</span>
              <ChevronRightIcon className={cn("size-4 shrink-0", chevronClass)} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
