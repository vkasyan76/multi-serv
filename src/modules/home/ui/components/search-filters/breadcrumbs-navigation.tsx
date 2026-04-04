import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/modules/categories/category-icons";
import type { AppLang } from "@/lib/i18n/app-lang";

interface Props {
  lang: AppLang;
  activeCategory?: string | null; // this is a slug, that's why we use string | null
  activeCategoryName?: string | null;
  activeCategoryIcon?: string | null;
  activeSubcategoryName?: string | null;
}

export const BreadcrumbNavigation = ({
  lang,
  activeCategory,
  activeCategoryName,
  activeCategoryIcon,
  activeSubcategoryName,
}: Props) => {
  if (!activeCategoryName || activeCategory === "all") return null;

  // Breadcrumb links must preserve the active locale instead of jumping back to
  // the non-localized route tree.
  const categoryHref = `/${lang}/${activeCategory}`;
  // Keep the text shadow separate from color classes so category, separator,
  // and current-page text can keep their intended visual hierarchy.
  const crumbShadowClass =
    "[text-shadow:0_1px_2px_rgba(0,0,0,0.7),0_0_1px_rgba(0,0,0,0.65)]";

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-wrap gap-y-1">
        {activeSubcategoryName ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className={cn(
                  "inline-flex items-center gap-2 text-[1.35rem] font-semibold text-white no-underline transition-opacity hover:opacity-85",
                  crumbShadowClass
                )}
              >
                <Link href={categoryHref}>
                  {activeCategoryIcon ? (
                    <CategoryIcon
                      icon={activeCategoryIcon}
                      className="size-5 shrink-0"
                      label={activeCategoryName}
                    />
                  ) : null}
                  <span>{activeCategoryName}</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator
              className={cn("text-lg font-medium text-white", crumbShadowClass)}
            >
              /
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage
                className={cn("text-lg font-medium text-white", crumbShadowClass)}
              >
                {activeSubcategoryName}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage
              className={cn(
                "inline-flex items-center gap-2 text-[1.35rem] font-semibold text-white",
                crumbShadowClass
              )}
            >
              {activeCategoryIcon ? (
                <CategoryIcon
                  icon={activeCategoryIcon}
                  className="size-5 shrink-0"
                  label={activeCategoryName}
                />
              ) : null}
              <span>{activeCategoryName}</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
