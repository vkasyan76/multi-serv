import { withLocalePrefix } from "@/i18n/routing";
import { generateTenantUrl } from "@/lib/utils";
import type { ResolveSearchHrefInput } from "@/modules/search/types";

export function resolveGlobalSearchHref(
  input: ResolveSearchHrefInput
): string {
  switch (input.kind) {
    case "tenant":
      return generateTenantUrl(input.tenantSlug, input.lang);

    case "category":
      return withLocalePrefix(`/${input.categorySlug}`, input.lang);

    case "subcategory":
      return withLocalePrefix(
        `/${input.categorySlug}/${input.subcategorySlug}`,
        input.lang
      );

    case "marketplace": {
      const href = withLocalePrefix("/all", input.lang);
      const params = new URLSearchParams();
      const trimmed = input.query.trim();

      if (trimmed) {
        params.set("search", trimmed);
      }

      const query = params.toString();
      return query ? `${href}?${query}` : href;
    }
  }
}

// Stage 1 anchors the later navigation split here:
// - relative href -> router.push(...)
// - absolute href -> window.location.assign(...)
export function isAbsoluteSearchHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
