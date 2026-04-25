import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import {
  getRootCategoryTree,
  relId,
  type CategoryTree,
  type RelValue,
} from "./category-tree";

export const categoriesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async ({ ctx }) => {
    return getRootCategoryTree(ctx);
  }),

  getAvailableForHomepage: baseProcedure.query(async ({ ctx }) => {
    const usedCategoryIds = new Set<string>();
    let page = 1;
    const MAX_PAGES = 100;

    while (page <= MAX_PAGES) {
      const tenants = await ctx.db.find({
        collection: "tenants",
        depth: 0,
        limit: 500,
        page,
        pagination: true,
        select: {
          categories: true,
          subcategories: true,
        } as const,
      });

      for (const tenant of tenants.docs) {
        for (const category of tenant.categories ?? []) {
          const id = relId(category as RelValue);
          if (id) usedCategoryIds.add(id);
        }

        for (const subcategory of tenant.subcategories ?? []) {
          const id = relId(subcategory as RelValue);
          if (id) usedCategoryIds.add(id);
        }
      }

      // Homepage availability should reflect the full tenant dataset, not just
      // the current preview page, so page through all tenants before filtering.
      if (!tenants.hasNextPage) {
        break;
      }

      page += 1;
    }

    if (page > MAX_PAGES) {
      // Keep this as a simple server-side safeguard so a malformed pagination
      // response cannot trap homepage availability reads in an endless loop.
      console.warn(
        `categories.getAvailableForHomepage hit the ${MAX_PAGES}-page safety limit.`,
      );
    }

    const categories = await getRootCategoryTree(ctx);

    return categories
      .map((category) => {
        const availableSubcategories = (category.subcategories ?? []).filter(
          (subcategory) => usedCategoryIds.has(String(subcategory.id))
        );
        const hasDirectTenants = usedCategoryIds.has(String(category.id));

        if (!hasDirectTenants && availableSubcategories.length === 0) {
          return null;
        }

        return {
          ...category,
          subcategories: availableSubcategories,
        };
      })
      .filter((category): category is CategoryTree => category !== null);
  }),
});
