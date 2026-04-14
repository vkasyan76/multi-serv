import type { AppLang } from "@/lib/i18n/app-lang";

export type SearchInternalKind =
  | "tenant"
  | "category"
  | "subcategory"
  | "alias";

export type SearchPublicKind =
  | "tenant"
  | "category"
  | "subcategory"
  | "marketplace";

type SearchInternalBase = {
  label: string;
  normalizedLabel: string;
  // Stage 1 keeps the scorer contract explicit: anything compared here should
  // already be normalized before it reaches the ranking helper.
  normalizedKeywords?: string[];
  parentLabel?: string;
};

export type SearchSynonymTarget =
  | {
      kind: "category";
      categorySlug: string;
      subcategorySlug?: undefined;
    }
  | {
      kind: "subcategory";
      categorySlug: string;
      subcategorySlug: string;
    };

export type SearchInternalTenantItem = SearchInternalBase & {
  kind: "tenant";
  tenantSlug: string;
};

export type SearchInternalCategoryItem = SearchInternalBase & {
  kind: "category";
  categorySlug: string;
};

export type SearchInternalSubcategoryItem = SearchInternalBase & {
  kind: "subcategory";
  categorySlug: string;
  subcategorySlug: string;
};

export type SearchInternalAliasItem = SearchInternalBase & {
  kind: "alias";
  // Alias rows never leave the server as visible result types; they only carry
  // canonical targets that later resolve into category/subcategory suggestions.
  target: SearchSynonymTarget;
};

export type SearchInternalItem =
  | SearchInternalTenantItem
  | SearchInternalCategoryItem
  | SearchInternalSubcategoryItem
  | SearchInternalAliasItem;

export type SearchSuggestion = {
  kind: SearchPublicKind;
  label: string;
  parentLabel?: string;
  href: string;
  score: number;
  autoSelect: boolean;
};

export type SearchSynonym = {
  term: string;
  locale?: AppLang;
  target: SearchSynonymTarget;
};

export type SearchScoreResult = {
  item: SearchInternalItem;
  score: number;
  autoSelect: boolean;
};

export type ResolveSearchHrefInput =
  | {
      kind: "tenant";
      lang: AppLang;
      tenantSlug: string;
    }
  | {
      kind: "category";
      lang: AppLang;
      categorySlug: string;
    }
  | {
      kind: "subcategory";
      lang: AppLang;
      categorySlug: string;
      subcategorySlug: string;
    }
  | {
      kind: "marketplace";
      lang: AppLang;
      query: string;
    };
