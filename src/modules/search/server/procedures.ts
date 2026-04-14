import { z } from "zod";

import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { normalizeSearchText } from "@/modules/search/lib/normalize-search-text";
import { resolveGlobalSearchHref } from "@/modules/search/lib/resolve-global-search-href";
import { scoreGlobalSearch } from "@/modules/search/lib/score-global-search";
import type { SearchSuggestion } from "@/modules/search/types";
import {
  buildAliasSearchItems,
  loadTaxonomySearchItems,
  loadTenantSearchItems,
} from "./sources";

export const searchRouter = createTRPCRouter({
  suggest: baseProcedure
    .input(
      z.object({
        query: z.string().trim().max(100),
        limit: z.number().min(1).max(10).default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      const rawQuery = input.query.trim();
      const normalizedQuery = normalizeSearchText(rawQuery);

      if (normalizedQuery.length < 2) {
        return [] as SearchSuggestion[];
      }

      // Important contract: `limit` applies to ranked suggestions only. The
      // explicit marketplace fallback row is appended after ranking, so the
      // final array can contain up to `limit + 1` rows.
      const rankedLimit = input.limit;

      const [
        { items: taxonomyItems, byCategorySlug, bySubcategoryKey },
        tenantItems,
      ] = await Promise.all([
        loadTaxonomySearchItems(ctx),
        loadTenantSearchItems(ctx, rawQuery, rankedLimit),
      ]);

      const aliasItems = buildAliasSearchItems(ctx.appLang);
      const internalItems = [...taxonomyItems, ...tenantItems, ...aliasItems];
      const scored = scoreGlobalSearch(normalizedQuery, internalItems);
      const suggestionsByHref = new Map<string, SearchSuggestion>();

      for (const entry of scored) {
        let suggestion: SearchSuggestion | null = null;

        switch (entry.item.kind) {
          case "tenant":
            suggestion = {
              kind: "tenant",
              label: entry.item.label,
              href: resolveGlobalSearchHref({
                kind: "tenant",
                lang: ctx.appLang,
                tenantSlug: entry.item.tenantSlug,
              }),
              score: entry.score,
              autoSelect: entry.autoSelect,
            };
            break;

          case "category":
            suggestion = {
              kind: "category",
              label: entry.item.label,
              href: resolveGlobalSearchHref({
                kind: "category",
                lang: ctx.appLang,
                categorySlug: entry.item.categorySlug,
              }),
              score: entry.score,
              autoSelect: entry.autoSelect,
            };
            break;

          case "subcategory":
            suggestion = {
              kind: "subcategory",
              label: entry.item.label,
              parentLabel: entry.item.parentLabel,
              href: resolveGlobalSearchHref({
                kind: "subcategory",
                lang: ctx.appLang,
                categorySlug: entry.item.categorySlug,
                subcategorySlug: entry.item.subcategorySlug,
              }),
              score: entry.score,
              autoSelect: entry.autoSelect,
            };
            break;

          case "alias": {
            const target =
              entry.item.target.kind === "category"
                ? byCategorySlug.get(entry.item.target.categorySlug)
                : bySubcategoryKey.get(
                    `${entry.item.target.categorySlug}::${entry.item.target.subcategorySlug}`
                  );

            if (!target) {
              break;
            }

            if (target.kind === "category") {
              suggestion = {
                kind: "category",
                label: target.label,
                href: resolveGlobalSearchHref({
                  kind: "category",
                  lang: ctx.appLang,
                  categorySlug: target.categorySlug,
                }),
                score: entry.score,
                autoSelect: entry.autoSelect,
              };
            } else {
              suggestion = {
                kind: "subcategory",
                label: target.label,
                parentLabel: target.parentLabel,
                href: resolveGlobalSearchHref({
                  kind: "subcategory",
                  lang: ctx.appLang,
                  categorySlug: target.categorySlug,
                  subcategorySlug: target.subcategorySlug,
                }),
                score: entry.score,
                autoSelect: entry.autoSelect,
              };
            }
            break;
          }
        }

        if (!suggestion) continue;

        const existing = suggestionsByHref.get(suggestion.href);
        if (!existing || suggestion.score > existing.score) {
          suggestionsByHref.set(suggestion.href, suggestion);
        }
      }

      const suggestions = Array.from(suggestionsByHref.values())
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .slice(0, rankedLimit);

      suggestions.push({
        kind: "marketplace",
        label: rawQuery,
        href: resolveGlobalSearchHref({
          kind: "marketplace",
          lang: ctx.appLang,
          query: rawQuery,
        }),
        score: -1,
        autoSelect: false,
      });

      return suggestions;
    }),
});
