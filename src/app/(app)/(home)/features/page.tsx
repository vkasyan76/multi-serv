"use client";
import { useLayoutEffect, useRef, useState } from "react";
import TenantOrbit from "@/modules/tenants/ui/components/visiuals/TenantOrbit";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { TenantWithRelations } from "@/modules/tenants/types";
import Headline from "@/modules/home/ui/billboard/headline";

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function Page() {
  const trpc = useTRPC();

  // fetch tenants
  const { data } = useQuery({
    ...trpc.tenants.getMany.queryOptions({
      sort: "distance",
      limit: 36,
      distanceFilterEnabled: false,
      userLat: null,
      userLng: null,
    }),
    refetchOnWindowFocus: false,
  });
  const tenants = (data?.docs ?? []) as TenantWithRelations[];

  // responsive square for the orbit
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width || 0;
      // small padding to avoid clipping rounded badges
      setSize(clamp(Math.round(w - 24), 280, 720));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 overflow-x-hidden">
      <Headline />
      <div ref={boxRef} className="w-full min-h-[280px] flex justify-center">
        {size !== null && (
          <TenantOrbit
            size={size}
            maxDistanceKm={80}
            baseSeconds={16}
            parallax={18}
            tenants={tenants}
          />
        )}
      </div>
    </div>
  );
}
