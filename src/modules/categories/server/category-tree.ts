import { DEFAULT_APP_LANG } from "@/lib/i18n/app-lang";
import type { Category } from "@/payload-types";
import type { TRPCContext } from "@/trpc/init";

export type CategoryTree = Category & {
  workType: Category["workType"] | null;
  subcategories: (Category & {
    workType: Category["workType"] | null;
    subcategories: undefined;
  })[];
};

export type RelValue =
  | string
  | { id?: string | null; _id?: string | null }
  | null
  | undefined;

export function relId(value: RelValue): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.id === "string") return value.id;
  if (typeof value._id === "string") return value._id;
  return null;
}

export function formatRootCategories(docs: Category[]): CategoryTree[] {
  return docs.map((doc) => ({
    ...doc,
    // Keep workType explicit in the read contract so later grouping/filtering
    // logic does not need a second pass over categories vs subcategories.
    workType: doc.workType ?? null,
    subcategories: (doc.subcategories?.docs ?? []).map((subcategoryDoc) => ({
      ...(subcategoryDoc as Category),
      workType: (subcategoryDoc as Category).workType ?? null,
      subcategories: undefined,
    })),
  }));
}

// Shared full taxonomy read used by both the categories router and navbar
// search. Search must read the full localized taxonomy, not homepage-filtered
// availability, or valid category/subcategory routes would disappear.
export async function getRootCategoryTree(
  ctx: Pick<TRPCContext, "db" | "appLang">
): Promise<CategoryTree[]> {
  const data = await ctx.db.find({
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

  return formatRootCategories(data.docs as Category[]);
}
