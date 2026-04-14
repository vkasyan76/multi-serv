import type {
  SearchInternalItem,
  SearchScoreResult,
} from "@/modules/search/types";

function scoreCandidate(
  normalizedQuery: string,
  item: SearchInternalItem
): number {
  const label = item.normalizedLabel;
  const keywords = item.normalizedKeywords ?? [];
  const haystacks = [label, ...keywords];

  const exactLabel = label === normalizedQuery;
  const exactKeyword = keywords.includes(normalizedQuery);
  const prefix = haystacks.some((value) => value.startsWith(normalizedQuery));
  const wordBoundary = haystacks.some((value) =>
    value.split(" ").some((part) => part.startsWith(normalizedQuery))
  );
  const contains = haystacks.some((value) => value.includes(normalizedQuery));

  if (item.kind === "tenant" && exactLabel) return 1000;
  if (item.kind === "subcategory" && exactLabel) return 920;
  if (item.kind === "category" && exactLabel) return 900;
  if (item.kind === "alias" && (exactLabel || exactKeyword)) return 880;

  if (prefix) {
    if (item.kind === "subcategory") return 720;
    if (item.kind === "category") return 700;
    if (item.kind === "tenant") return 680;
    return 660;
  }

  if (wordBoundary) return 520;
  if (contains) return 360;

  return 0;
}

export function scoreGlobalSearch(
  normalizedQuery: string,
  items: SearchInternalItem[]
): SearchScoreResult[] {
  const scored = items
    .map((item) => ({
      item,
      score: scoreCandidate(normalizedQuery, item),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label)
    );

  const second = scored[1];

  return scored.map((entry, index) => {
    const exactish = entry.score >= 900;
    const gap = !second ? entry.score : entry.score - second.score;

    return {
      item: entry.item,
      score: entry.score,
      // Stage 1 keeps auto-select intentionally conservative so later wiring
      // cannot silently redirect broad queries before UI behavior is tuned.
      autoSelect:
        index === 0 &&
        entry.item.kind !== "alias" &&
        exactish &&
        gap >= 40,
    };
  });
}
