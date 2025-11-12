"use client";

import { TenantOrbitSkeleton } from "@/modules/tenants/ui/components/visiuals/TenantOrbit";
import { TenantsCarouselSkeleton } from "@/modules/tenants/ui/components/visiuals/TenantsCarousel";

export function HomeRadarSkeleton() {
  return (
    <>
      <div className="flex w-full min-w-0 justify-center lg:justify-start pr-6 min-h-[280px]">
        <TenantOrbitSkeleton />
      </div>
      <div className="w-full lg:h-full flex justify-end">
        <div className="w-full lg:w-[min(32vw,600px)] h-full flex items-center lg:px-12">
          <TenantsCarouselSkeleton />
        </div>
      </div>
    </>
  );
}

