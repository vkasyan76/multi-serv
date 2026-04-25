"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SECTIONS = [
  { id: "transactions", label: "Transactions" },
  { id: "orders", label: "Orders" },
  { id: "support-chat", label: "Support Chat" },
  { id: "payload", label: "Payload" },
] as const;

const SECTION_IDS = SECTIONS.map((section) => section.id);

function normalizeHash(hash: string) {
  const id = hash.replace(/^#/, "");
  // Keep old links working after "finance" -> "transactions" rename.
  if (id === "finance") return "transactions";
  return SECTION_IDS.includes(id as (typeof SECTION_IDS)[number]) ? id : null;
}

export default function AdminDashboardSubnav() {
  const [active, setActive] = useState<string>("transactions");
  const activeRef = useRef<string>("transactions");

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const hashId = normalizeHash(window.location.hash);
    const nextActive = hashId ?? "transactions";
    if (nextActive === activeRef.current) return;
    activeRef.current = nextActive;
    setActive(nextActive);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) return;
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target?.id;
        if (!id) return;
        if (id === activeRef.current) return;
        activeRef.current = id;
        setActive(id);
        window.history.replaceState(null, "", `#${id}`);
      },
      { rootMargin: "-80px 0px -40% 0px", threshold: [0, 0.25, 0.5] },
    );

    let rafId = 0;
    rafId = window.requestAnimationFrame(() => {
      SECTIONS.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) io.observe(el);
      });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      io.disconnect();
    };
  }, []);

  const onSelect = (id: string) => {
    if (id !== activeRef.current) {
      activeRef.current = id;
      setActive(id);
      window.history.replaceState(null, "", `#${id}`);
    }
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <Tabs value={active} onValueChange={onSelect}>
      <TabsList className="rounded-full border bg-white/80 shadow-sm px-2 py-1">
        {SECTIONS.map((section) => (
          <TabsTrigger
            key={section.id}
            value={section.id}
            aria-current={active === section.id ? "page" : undefined}
            className="rounded-full px-3 sm:px-4 py-2 text-sm data-[state=active]:bg-black data-[state=active]:text-white"
          >
            {section.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
