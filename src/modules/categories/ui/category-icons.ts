import {
  CarFrontIcon,
  SofaIcon,
  SparklesIcon,
  TruckIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

// Keep category picker icons code-based for now; the homepage category set is
// stable enough that a small slug registry is simpler than CMS-managed assets.
const CATEGORY_ICON_BY_SLUG: Record<string, LucideIcon> = {
  "auto-repair": CarFrontIcon,
  "furniture-assembly": SofaIcon,
  "cleaning": SparklesIcon,
  "plumbing": WrenchIcon,
  "relocation": TruckIcon,
};

export function getCategoryIcon(slug?: string | null): LucideIcon | null {
  if (!slug) return null;
  return CATEGORY_ICON_BY_SLUG[slug] ?? null;
}
