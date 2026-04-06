import { DEFAULT_APP_LANG } from "@/lib/i18n/app-lang";
import { Category } from "@/payload-types";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";

type CategoryTree = Category & {
  workType: Category["workType"] | null;
  subcategories: (Category & {
    workType: Category["workType"] | null;
    subcategories: undefined;
  })[];
};

type RelValue =
  | string
  | { id?: string | null; _id?: string | null }
  | null
  | undefined;

function relId(value: RelValue): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.id === "string") return value.id;
  if (typeof value._id === "string") return value._id;
  return null;
}

function formatRootCategories(docs: Category[]): CategoryTree[] {
  return docs.map((doc) => ({
    ...doc,
    // Keep workType explicit in the read contract so future filter/sorting UI
    // can group both root categories and subcategories without another API pass.
    workType: doc.workType ?? null,
    subcategories: (doc.subcategories?.docs ?? []).map((subcategoryDoc) => ({
      ...(subcategoryDoc as Category),
      workType: (subcategoryDoc as Category).workType ?? null,
      subcategories: undefined,
    })),
  }));
}

export const categoriesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async ({ ctx }) => {
    const data = await ctx.db.find({
      collection: "categories",
      depth: 1, // Populate subcategories, subcategories.[0] will be a type of "Category"
      locale: ctx.appLang,
      fallbackLocale: DEFAULT_APP_LANG,
      pagination: false, // Disable pagination to get all categories
      where: {
        parent: {
          exists: false,
        },
      },
      sort: "name", // Sort categories by name
    });

    return formatRootCategories(data.docs as Category[]);
  }),

  getAvailableForHomepage: baseProcedure.query(async ({ ctx }) => {
    const usedCategoryIds = new Set<string>();
    let page = 1;

    while (true) {
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

    const categories = await ctx.db.find({
      collection: "categories",
      depth: 1,
      locale: ctx.appLang,
      fallbackLocale: DEFAULT_APP_LANG,
      pagination: false,
      where: {
        parent: {
          exists: false,
        },
      },
      sort: "name",
    });

    return formatRootCategories(categories.docs as Category[])
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
