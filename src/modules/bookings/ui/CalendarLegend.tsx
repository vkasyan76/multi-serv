"use client";

export function CalendarLegend() {
  const Square = ({ className }: { className: string }) => (
    <span className={`inline-block size-3 ${className}`} />
  );

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Square className="bg-emerald-400" /> Available
      </span>
      <span className="flex items-center gap-1.5">
        <Square className="bg-amber-400" /> Booked
      </span>
    </div>
  );
}
