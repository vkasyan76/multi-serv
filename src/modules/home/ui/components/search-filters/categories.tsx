"use client";

import { CategoriesGetManyOutput } from "@/modules/categories/types";
import { CategoryDropdown } from "./categories-dropdown";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListFilterIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoriesSidebar } from "./categories-sidebar";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  data: CategoriesGetManyOutput;
}

export const Categories = ({ data }: Props) => {
  const params = useParams();
  const t = useTranslations("common");
  const viewAllLabel = t("buttons.view_all");

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // Start conservatively so long localized labels cannot push the permanent
  // action control out of view before the first measurement pass runs.
  const [visibleCount, setVisibleCount] = useState(0);
  const [isAnyHovered, setIsAnyHovered] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const categoryParam = params.category as string | undefined;
  const activeCategory = categoryParam || "all";

  const activeCategoryIndex = data.findIndex(
    (category) => category.slug === activeCategory,
  );

  const isActiveCategoryHidden =
    activeCategoryIndex >= visibleCount && activeCategoryIndex !== -1;

  const measurementKey = data
    .map((category) => `${category.id}:${category.name}`)
    .join("|");

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;

    if (!container || !measure) return;

    const calculateVisible = () => {
      // Only the category strip is allowed to shrink. The action control lives
      // outside that strip so "View all" always remains visible in the navbar.
      const availableWidth = container.offsetWidth;
      const items = Array.from(measure.children);

      let totalWidth = 0;
      let visible = 0;

      for (const item of items) {
        const width = item.getBoundingClientRect().width;

        if (totalWidth + width > availableWidth) {
          break;
        }

        totalWidth += width;
        visible++;
      }

      setVisibleCount(visible);
    };

    calculateVisible();

    // Recalculate for viewport/layout changes and for locale-driven label
    // changes instead of relying on a later ResizeObserver tick.
    const resizeObserver = new ResizeObserver(calculateVisible);
    resizeObserver.observe(container);
    resizeObserver.observe(measure);

    return () => resizeObserver.disconnect();
  }, [measurementKey, viewAllLabel]);

  return (
    <div className="relative w-full">
      <CategoriesSidebar
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
      />

      {/* Hidden measurement row: render every category at its natural width so
      we can trim the visible strip without ever sacrificing the action button. */}
      <div
        ref={measureRef}
        className="pointer-events-none absolute flex opacity-0"
        style={{ position: "fixed", top: -9999, left: -9999 }}
        aria-hidden="true"
      >
        {data.map((category) => (
          <div key={category.id} className="shrink-0">
            <CategoryDropdown
              category={category}
              isActive={activeCategory === category.slug}
              isNavigationHovered={false}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div
          ref={containerRef}
          className="min-w-0 flex-1"
          onMouseEnter={() => setIsAnyHovered(true)}
          onMouseLeave={() => setIsAnyHovered(false)}
        >
          <div className="flex flex-nowrap items-center">
            {/* Trim category chips only. "View all" stays in its own lane so it
            remains visible even when translated labels become much longer. */}
            {data.slice(0, visibleCount).map((category) => (
              <div key={category.id} className="shrink-0">
                <CategoryDropdown
                  category={category}
                  isActive={activeCategory === category.slug}
                  isNavigationHovered={isAnyHovered}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0">
          <Button
            variant="elevated"
            className={cn(
              "h-11 rounded-full border-transparent bg-transparent px-4 text-black hover:border-primary hover:bg-white",
              isActiveCategoryHidden &&
                !isAnyHovered &&
                "border-primary bg-white",
            )}
            onClick={() => setIsSidebarOpen(true)}
          >
            {viewAllLabel}
            <ListFilterIcon className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};
