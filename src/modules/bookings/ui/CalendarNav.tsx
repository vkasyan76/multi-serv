"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { addDays, startOfDay } from "date-fns";

export type CalendarMode = "week" | "month";

type Props = {
  anchor: Date;
  onAnchorChange: (next: Date) => void;
  /** Optional precomputed label. If omitted, we derive from locale/anchor. */
  label?: string;
  /** Locale for label (defaults to browser). */
  locale?: string;
  className?: string;
};

export default function CalendarNav({
  anchor,
  onAnchorChange,
  label,
  locale,
  className,
}: Props) {
  const loc = locale || (typeof navigator !== "undefined" ? navigator.language : "en-US");

  const derivedLabel = React.useMemo(() => {
    if (label) return label;
    // Always show 7-day range format since we're only showing week view
    const fmt = new Intl.DateTimeFormat(loc, { weekday: "short", month: "short", day: "numeric" });
    return `${fmt.format(anchor)} — ${fmt.format(addDays(anchor, 6))}`;
  }, [label, anchor, loc]);

  const stepDays = (delta: number) => onAnchorChange(addDays(anchor, delta));
  const stepWeeks = (delta: number) => onAnchorChange(addDays(anchor, delta * 7));
  const goToday = () => onAnchorChange(startOfDay(new Date()));

  return (
    <div className={"mb-3 flex items-center justify-center gap-2 " + (className ?? "")}>
      <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => stepWeeks(-1)}>
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => stepDays(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="min-w-[220px] text-sm text-muted-foreground text-center select-none">
        {derivedLabel}
      </div>

      <Button variant="outline" size="icon" aria-label="Next day" onClick={() => stepDays(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Next week" onClick={() => stepWeeks(1)}>
        <ChevronsRight className="h-4 w-4" />
      </Button>

      {/* Today button - part of navigation controls */}
      <Button variant="secondary" size="sm" className="ml-3" onClick={goToday}>
        Today
      </Button>
    </div>
  );
}
