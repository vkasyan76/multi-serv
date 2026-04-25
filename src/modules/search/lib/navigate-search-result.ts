"use client";

import { isAbsoluteSearchHref } from "@/modules/search/lib/resolve-global-search-href";

type SearchRouter = {
  push: (href: string) => void;
};

// Tenant results can resolve to a different origin, so the navbar needs one
// place that decides between client routing and a full-page navigation.
export function navigateSearchResult(router: SearchRouter, href: string) {
  if (isAbsoluteSearchHref(href)) {
    window.location.assign(href);
    return;
  }

  router.push(href);
}
