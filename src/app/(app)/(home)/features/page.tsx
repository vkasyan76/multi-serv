"use client";

import { useEffect, useRef, useState } from "react";
import TenantOrbit from "@/modules/tenants/ui/components/visiuals/TenantOrbit";

// clamp helper
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const Page = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(720); // desktop default

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry!.contentRect.width;
      // leave some breathing room; cap to desktop value
      const next = clamp(Math.round(w - 24), 280, 720);
      setSize(next);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="container mx-auto px-4 py-8 flex justify-center border-0 outline-0 shadow-none bg-transparent"
    >
      <TenantOrbit
        size={size}
        limit={36}
        maxDistanceKm={80}
        baseSeconds={16}
        parallax={18}
      />
    </div>
  );
};

export default Page;
