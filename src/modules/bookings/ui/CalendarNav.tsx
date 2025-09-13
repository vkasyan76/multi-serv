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
  /** Compact layout for mobile: wrap, truncate label, hide week jumps */
  compact?: boolean;
  showWeekJumps?: boolean; // default true
};

export default function CalendarNav(props: Props) {
  const {
    anchor,
    onAnchorChange,
    label,
    locale,
    className,
    compact = false,
    showWeekJumps = true,
  } = props;

  const loc =
    locale || (typeof navigator !== "undefined" ? navigator.language : "en-GB");

  const derivedLabel = React.useMemo(() => {
    if (label) return label;
    // Always show 7-day range format since we're only showing week view
    const fmt = new Intl.DateTimeFormat(loc, { weekday: "short", month: "short", day: "numeric" });
    return `${fmt.format(anchor)} — ${fmt.format(addDays(anchor, 6))}`;
  }, [label, anchor, loc]);

  const stepDays = (delta: number) => onAnchorChange(addDays(anchor, delta));
  const stepWeeks = (delta: number) => onAnchorChange(addDays(anchor, delta * 7));
  const goToday = () => onAnchorChange(startOfDay(new Date()));

  // Compact mode hides week jumps and enables flex wrapping/truncation
  const showJumps = showWeekJumps && !compact;

  return (
    <div
      className={[
        "mb-3 flex items-center justify-center gap-2",
        compact ? "flex-wrap" : "flex-nowrap",
        className ?? ""
      ].join(" ")}
    >
      {showJumps && (
        <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => stepWeeks(-1)}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      )}
      <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => stepDays(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* min-w-0 allows truncation; max-w keeps it inside the card */}
      <div
        className={[
          "min-w-0",
          compact ? "max-w-[70vw]" : "sm:max-w-none",
          "text-sm text-muted-foreground text-center select-none truncate"
        ].join(" ")}
      >
        {derivedLabel}
      </div>

      <Button variant="outline" size="icon" aria-label="Next day" onClick={() => stepDays(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      {showJumps && (
        <Button variant="outline" size="icon" aria-label="Next week" onClick={() => stepWeeks(1)}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      )}

      {/* Today button */}
      <Button
        variant="secondary"
        size="sm"
        className="ml-0 sm:ml-3"
        onClick={goToday}
      >
        Today
      </Button>
    </div>
  );
}
