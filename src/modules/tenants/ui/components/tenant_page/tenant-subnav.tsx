"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState, useRef } from "react";

const SECTIONS = [
  { id: "about", label: "About" },
  { id: "services", label: "Services" },
  { id: "availability", label: "Availability" },
  { id: "reviews", label: "Reviews" },
];

interface TenantSubnavProps {
  headerOffsetPx?: { base: number; sm: number };
}

export function TenantSubnav({
  headerOffsetPx = { base: 56, sm: 64 }, // height of this single sticky row
}: TenantSubnavProps) {
  const [active, setActive] = useState("about");
  const [, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastClickTimeRef = useRef<number>(0);

  // Optional: read hash once on mount, then never touch URL again
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === id)) setActive(id);
    // No hashchange listener; we no longer mutate the hash
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Scrollspy: highlight only (no history writes)
  useEffect(() => {
    const hdr =
      window.innerWidth < 640 ? headerOffsetPx.base : headerOffsetPx.sm;

    const io = new IntersectionObserver(
      (entries) => {
        // Don't update if we just clicked (within 1 second)
        const timeSinceLastClick = Date.now() - lastClickTimeRef.current;
        if (timeSinceLastClick < 1000) return;

        // Find the section that's most visible in the viewport
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;

        // Sort by intersection ratio (most visible first)
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target?.id;

        if (id) {
          setActive((prev) => (prev === id ? prev : id));
        }
      },
      {
        // More lenient rootMargin for small pages
        rootMargin: `-${hdr}px 0px -20% 0px`, // Reduced from -60% to -20%
        // Simpler thresholds to reduce conflicts
        threshold: [0, 0.25, 0.5, 0.75],
      }
    );

    // Also listen for scroll events to handle top of page
    const handleScroll = () => {
      const timeSinceLastClick = Date.now() - lastClickTimeRef.current;
      if (timeSinceLastClick < 1000) return;

      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const isLargeScreen = window.innerWidth >= 1024; // lg breakpoint
      const headerHeight = isLargeScreen
        ? 64
        : window.innerWidth < 640
          ? 104
          : 120;

      // If we're very close to the top, activate "About"
      if (scrollTop <= headerHeight + 50) {
        setActive("about");
        return;
      }
    };

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });

    // Add scroll listener
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [headerOffsetPx.base, headerOffsetPx.sm]);

  const onSelect = (id: string) => {
    // Track click time to prevent IntersectionObserver interference
    lastClickTimeRef.current = Date.now();

    // Set active immediately for better UX
    setActive(id);

    // Set scrolling state to prevent flickering
    setIsScrolling(true);

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Scroll to section
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });

    // Reset scrolling state after animation completes
    scrollTimeoutRef.current = setTimeout(
      () => {
        setIsScrolling(false);
      },
      prefersReduced ? 100 : 800
    ); // Shorter timeout for reduced motion
  };

  return (
    // Middle cell of the navbar grid: center on all sizes, allow scroll on XS
    <div className="justify-self-center max-w-full">
      <Tabs value={active} onValueChange={onSelect}>
        <TabsList
          className="
            inline-flex max-w-full whitespace-nowrap overflow-x-auto scrollbar-hide
            items-center justify-center gap-2 sm:gap-3
            rounded-full border bg-white/80 shadow-sm px-2 py-1
          "
        >
          {SECTIONS.map((s) => (
            <TabsTrigger
              key={s.id}
              value={s.id}
              className="
                rounded-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base
                data-[state=active]:bg-black data-[state=active]:text-white
                data-[state=inactive]:text-gray-900
                transition-colors duration-200
              "
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
