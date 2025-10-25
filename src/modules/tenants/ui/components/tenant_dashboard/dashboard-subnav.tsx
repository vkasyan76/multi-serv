"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SECTIONS = [
  { id: "calendar", label: "Calendar" },
  { id: "orders", label: "Orders" },
  { id: "messages", label: "Messages" },
  { id: "finance", label: "Finance" },
] as const;

export default function DashboardSubnav() {
  const [active, setActive] = useState<string>("calendar");

  // light scrollspy so the pill stays in sync when you scroll
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target?.id;
        if (id) setActive(id);
      },
      { rootMargin: "-80px 0px -40% 0px", threshold: [0, 0.25, 0.5] }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });

    return () => io.disconnect();
  }, []);

  const onSelect = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <Tabs value={active} onValueChange={onSelect}>
      <TabsList className="rounded-full border bg-white/80 shadow-sm px-2 py-1">
        {SECTIONS.map((s) => (
          <TabsTrigger
            key={s.id}
            value={s.id}
            className="rounded-full px-3 sm:px-4 py-2 text-sm
                       data-[state=active]:bg-black data-[state=active]:text-white"
          >
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
