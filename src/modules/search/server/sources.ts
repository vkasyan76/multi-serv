import { getRootCategoryTree } from "@/modules/categories/server/category-tree";
import { normalizeSearchText } from "@/modules/search/lib/normalize-search-text";
import { SEARCH_SYNONYMS } from "@/modules/search/search-synonyms";
import type {
  SearchInternalAliasItem,
  SearchInternalCategoryItem,
  SearchInternalSubcategoryItem,
  SearchInternalTenantItem,
} from "@/modules/search/types";
import type { TRPCContext } from "@/trpc/init";
import type { Where } from "payload";

function buildTenantCandidateTerms(rawQuery: string) {
  const normalized = normalizeSearchText(rawQuery);
  const slugishRaw = rawQuery.trim().toLowerCase().replace(/\s+/g, "-");
  const slugishNormalized = normalized.replace(/\s+/g, "-");

  return Array.from(
    new Set(
      [rawQuery.trim(), normalized, slugishRaw, slugishNormalized].filter(
        (value) => value.length >= 2
      )
    )
  );
}

export async function loadTaxonomySearchItems(
  ctx: Pick<TRPCContext, "db" | "appLang">
): Promise<{
  items: Array<SearchInternalCategoryItem | SearchInternalSubcategoryItem>;
  byCategorySlug: Map<string, SearchInternalCategoryItem>;
  bySubcategoryKey: Map<string, SearchInternalSubcategoryItem>;
}> {
  const categories = await getRootCategoryTree(ctx);

  const items: Array<SearchInternalCategoryItem | SearchInternalSubcategoryItem> =
    [];
  const byCategorySlug = new Map<string, SearchInternalCategoryItem>();
  const bySubcategoryKey = new Map<string, SearchInternalSubcategoryItem>();

  for (const category of categories) {
    const categoryItem: SearchInternalCategoryItem = {
      kind: "category",
      label: category.name,
      normalizedLabel: normalizeSearchText(category.name),
      categorySlug: category.slug,
    };
    items.push(categoryItem);
    byCategorySlug.set(category.slug, categoryItem);

    for (const subcategory of category.subcategories ?? []) {
      const subcategoryItem: SearchInternalSubcategoryItem = {
        kind: "subcategory",
        label: subcategory.name,
        normalizedLabel: normalizeSearchText(subcategory.name),
        parentLabel: category.name,
        categorySlug: category.slug,
        subcategorySlug: subcategory.slug,
      };
      items.push(subcategoryItem);
      bySubcategoryKey.set(
        `${category.slug}::${subcategory.slug}`,
        subcategoryItem
      );
    }
  }

  return { items, byCategorySlug, bySubcategoryKey };
}

export async function loadTenantSearchItems(
  ctx: Pick<TRPCContext, "db" | "appLang">,
  rawQuery: string,
  limit = 20
): Promise<SearchInternalTenantItem[]> {
  // MVP assumption: no persisted normalized tenant field exists, so we first
  // ask Payload for a bounded candidate set, then normalize/score in memory.
  // The minimum of 20 is an MVP product choice, not a technical requirement.
  const candidateTerms = buildTenantCandidateTerms(rawQuery);
  const candidateLimit = Math.min(Math.max(limit * 3, 20), 50);
  const tenantOrClauses: Where[] = [];

  for (const term of candidateTerms) {
    tenantOrClauses.push({ name: { like: term } });
    tenantOrClauses.push({ slug: { like: term } });
  }

  const tenants = await ctx.db.find({
    collection: "tenants",
    depth: 0,
    locale: ctx.appLang,
    page: 1,
    limit: candidateLimit,
    pagination: true,
    sort: "name",
    where: {
      or: tenantOrClauses,
    },
    select: {
      name: true,
      slug: true,
    } as const,
  });

  return tenants.docs.flatMap((tenant) => {
    if (
      typeof tenant.name !== "string" ||
      tenant.name.trim().length === 0 ||
      typeof tenant.slug !== "string" ||
      tenant.slug.trim().length === 0
    ) {
      return [];
    }

    return [
      {
        kind: "tenant" as const,
        label: tenant.name.trim(),
        normalizedLabel: normalizeSearchText(tenant.name),
        normalizedKeywords: [normalizeSearchText(tenant.slug)],
        tenantSlug: tenant.slug.trim(),
      },
    ];
  });
}

export function buildAliasSearchItems(
  appLang: TRPCContext["appLang"]
): SearchInternalAliasItem[] {
  return SEARCH_SYNONYMS.filter(
    (entry) => !entry.locale || entry.locale === appLang
  ).map((entry) => ({
    kind: "alias",
    label: entry.term,
    // Alias items participate in the same normalized scorer contract as real
    // taxonomy and tenant items.
    normalizedLabel: normalizeSearchText(entry.term),
    target: entry.target,
  }));
}
