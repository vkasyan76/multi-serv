"use client";

import { useEffect, useRef, useState } from "react";
import TenantOrbit from "@/modules/tenants/ui/components/visiuals/TenantOrbit";
// import Billboard from "@/modules/home/ui/billboard/billboard";
// import { Poppins } from "next/font/google";
import { cn } from "@/lib/utils";
import LoadingPage from "@/components/shared/loading";
import TenantsCarousel from "@/modules/tenants/ui/components/visiuals/TenatCarrousel";

// const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"] });

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function Home() {
  const radarRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(720);
  const [orbitReady, setOrbitReady] = useState(false); // loader

  useEffect(() => {
    if (!radarRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const w = entry.contentRect.width;
      setSize(clamp(Math.round(w - 24), 280, 900));
    });
    ro.observe(radarRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="container mx-auto px-4 pt-6 pb-4">
      {/* wrapper to host the overlay and give it height */}
      <div className="relative min-h-[60vh]">
        {/* overlay loader while orbit data is loading */}
        {!orbitReady && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <LoadingPage />
          </div>
        )}

        {/* your original grid — kept mounted; just hidden until ready */}
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-[5fr_2fr] gap-10 items-center transition-opacity duration-200",
            !orbitReady && "opacity-0 pointer-events-none"
          )}
        >
          {/* Radar (left) */}
          <div ref={radarRef} className="w-full min-w-0 flex justify-center">
            <TenantOrbit
              size={size}
              limit={36}
              maxDistanceKm={80}
              baseSeconds={16}
              parallax={18}
              onReady={() => setOrbitReady(true)}
            />
          </div>

          {/* Billboard (right) */}
          <div className="w-full lg:h-full flex justify-end">
            <div className="w-full lg:max-w-[min(38vw,680px)] h-full flex items-center">
              <TenantsCarousel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
