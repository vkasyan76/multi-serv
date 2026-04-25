import type { HomepageCategoriesOutput } from "@/modules/categories/types";
import type { HomeMarketplaceFilters } from "../home-marketplace-filters";

export type HomeCategoryOption = {
  label: string;
  value: string;
  workType: HomeMarketplaceFilters["workType"] | null;
};

export function buildHomeCategoryOptions(
  categories: HomepageCategoriesOutput
): HomeCategoryOption[] {
  return categories.map((category) => ({
    label: category.name,
    value: category.slug,
    workType: category.workType ?? null,
  }));
}

export function filterHomeCategoryOptions(
  options: HomeCategoryOption[],
  workType: HomeMarketplaceFilters["workType"]
) {
  return workType
    ? options.filter((option) => option.workType === workType)
    : options;
}

export function keepCategoryForWorkType(
  options: HomeCategoryOption[],
  nextWorkType: HomeMarketplaceFilters["workType"],
  currentCategory: string
) {
  return (
    !currentCategory ||
    options.some(
      (option) =>
        option.value === currentCategory &&
        (!nextWorkType || option.workType === nextWorkType)
    )
  );
}
