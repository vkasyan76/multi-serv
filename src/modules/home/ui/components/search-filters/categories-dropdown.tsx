"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { SubcategoryMenu } from "./subcategory-menu";
// import { CustomCategory } from "../types";
import { CategoriesGetManyOutput } from "@/modules/categories/types";
import Link from "next/link";
import { withLocalePrefix } from "@/i18n/routing";
import type { AppLang } from "@/lib/i18n/app-lang";

interface Props {
  category: CategoriesGetManyOutput[1];
  lang: AppLang;
  isActive?: boolean;
  activeSubcategory?: string;
  useLightText?: boolean;
  isNavigationHovered?: boolean;
}

export const CategoryDropdown = ({
  category,
  lang,
  isActive,
  activeSubcategory,
  useLightText,
  isNavigationHovered,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // const { getDropDownPosition } = useDropDownPosition(dropdownRef);

  const onMouseEnter = () => {
    if (category.subcategories) {
      setIsOpen(true);
    }
  };

  const onMouseLeave = () => {
    setIsOpen(false);
  };

  // Category navigation must preserve the active locale. Bare category slugs
  // trigger middleware redirects in production, which delays visible loading
  // feedback and makes the content area appear blank before the fallback.
  const categoryHref =
    category.slug === "all"
      ? withLocalePrefix("/", lang)
      : withLocalePrefix(`/${category.slug}`, lang);

  return (
    <div
      className="relative"
      ref={dropdownRef}
      // to imitate hovering:
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative">
        <Button
          variant="elevated"
          className={cn(
            "h-11 rounded-full border-transparent bg-transparent px-4 hover:border-primary hover:bg-white",
            // On colored category/subcategory pages, idle labels need lighter
            // treatment for contrast. Active/open chips still fall back to the
            // existing white-pill + dark-text styling.
            useLightText && !isActive && !isOpen
              ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7),0_0_1px_rgba(0,0,0,0.65)] hover:text-black"
              : "text-black",
            isActive &&
              !isNavigationHovered &&
              "border border-primary bg-white",
            isOpen &&
              "bg-white border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-x-[4px] -translate-y-[4px]",
          )}
        >
          <Link href={categoryHref}>{category.name}</Link>
        </Button>
        {category.subcategories && category.subcategories.length > 0 && (
          <div
            className={cn(
              // Keep the pointer because it anchors the chip to its submenu,
              // but let it inherit the category color instead of a hard black.
              "absolute left-1/2 -bottom-2 h-0 w-0 -translate-x-1/2 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent opacity-0 drop-shadow-sm",
              isOpen && "opacity-100"
            )}
            style={{
              borderBottomColor: category.color || "#F5F5F5",
            }}
          />
        )}
      </div>
      <SubcategoryMenu
        category={category}
        lang={lang}
        isOpen={isOpen}
        activeSubcategory={activeSubcategory}
      />
    </div>
  );
};
