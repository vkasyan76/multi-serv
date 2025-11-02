"use client";

import { useEffect, useRef, useState } from "react";
import TenantOrbit from "@/modules/tenants/ui/components/visiuals/TenantOrbit";

// clamp helper (same as features page)
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function Home() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(720); // desktop default

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const w = entry.contentRect.width;
      // leave some breathing room; cap to desktop value
      const next = clamp(Math.round(w - 24), 280, 720);
      setSize(next);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="container mx-auto px-4 pt-6 pb-4">
      {/* Headline only on large screens */}
      <div className="hidden lg:block text-center mb-4">
        <h1 className="text-4xl font-bold text-gray-900">
          <span className="whitespace-nowrap">
            Infinisimo
            <sup className="ml-0.5 text-[0.65em]" aria-hidden>
              ®
            </sup>
          </span>{" "}
          connects professionals
        </h1>
        <p className="text-xl text-gray-600 mt-1">
          Your solution is only a click away.
        </p>
      </div>

      {/* Radar */}
      <div className="flex justify-center">
        <TenantOrbit
          size={size}
          limit={36}
          maxDistanceKm={80}
          baseSeconds={16}
          parallax={18}
        />
      </div>
    </div>
  );
}
