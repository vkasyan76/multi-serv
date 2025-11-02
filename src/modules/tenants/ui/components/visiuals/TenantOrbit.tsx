"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { TenantWithRelations } from "@/modules/tenants/types";
import { gsap } from "gsap";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { generateTenantUrl } from "@/lib/utils";
import Link from "next/link";
import {
  formatCurrency,
  getLocaleAndCurrency,
} from "@/modules/profile/location-utils";

/** props */
export type TenantOrbitProps = {
  size?: number; // px
  limit?: number; // requested tenants
  maxDistanceKm?: number; // distance clamp
  baseSeconds?: number; // min rotate duration
  parallax?: number; // +seconds per radius fraction
};

type Viewer = { lat: number; lng: number; city?: string | null };

// computed later from `size`, keep placeholders to satisfy TS at top-level -for mobile
let BADGE_D = 96;
let RING_GAP = Math.max(56, Math.round(BADGE_D * 0.6));

type BadgeMode = "compact" | "normal" | "full";

function CircleBadge({
  t,
  href,
  size = 96,
  color,
  mode,
  currency,
}: {
  t: TenantWithRelations;
  href: string;
  size?: number;
  color?: string;
  mode: BadgeMode;
  currency: string;
}) {
  const city = t.user?.coordinates?.city ?? "—";
  const category = t.categories?.[0]?.name ?? "—";
  const bg = color && /^#/.test(color) ? color : undefined;

  // hourly rate (present by contract; may be null)
  const hr = t.hourlyRate;
  const price =
    typeof hr === "number" && Number.isFinite(hr)
      ? `${formatCurrency(hr, currency)}/h`
      : null;

  // tiny font steps per mode
  const nameCls = mode === "compact" ? "text-[11px]" : "text-[12px]";
  const metaCls = mode === "compact" ? "text-[10px]" : "text-[11px]";

  return (
    <Button
      asChild
      variant="secondary"
      className="rounded-full grid place-items-center text-center shadow-sm hover:shadow-md"
      style={{
        width: size,
        height: size,
        padding: 10,
        ...(bg
          ? { backgroundColor: bg, borderColor: bg, color: "#111827" }
          : {}),
      }}
      title={`${t.name} • ${category}${city ? ` • ${city}` : ""}${price ? ` • ${price}` : ""}`}
    >
      <Link
        href={href}
        prefetch={false}
        className="block h-full w-full rounded-full"
      >
        <div className="leading-tight">
          <div className={`${nameCls} font-semibold line-clamp-1`}>
            {t.name}
          </div>

          {/* Category: always visible (also on compact) */}
          <div className={`${metaCls} opacity-80 line-clamp-1`}>{category}</div>

          {mode === "full" && (
            <div className={`${metaCls} opacity-80 line-clamp-1`}>{city}</div>
          )}

          {/* Price always last; shows on all modes if available */}
          {price && (
            <div className={`${metaCls} font-semibold opacity-90 mt-0.5`}>
              {price}
            </div>
          )}
        </div>
      </Link>
    </Button>
  );
}

export default function TenantOrbit({
  size = 640,
  limit = 24,
  maxDistanceKm = 80,
  baseSeconds = 18,
  parallax = 20,
}: TenantOrbitProps) {
  const R = size / 2;

  // scale badge & spacing with overall radar size
  BADGE_D = Math.round(Math.max(56, Math.min(96, size * 0.12))); // ~12% of radar; 56–96 clamp
  RING_GAP = Math.max(40, Math.round(BADGE_D * 0.6));

  const trpc = useTRPC();

  // session + profile (for saved coordinates)
  const { data: session } = useQuery(trpc.auth.session.queryOptions());
  const { data: userProfile } = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: !!session?.user,
  });

  const { currency } = getLocaleAndCurrency();
  const mode: "compact" | "normal" | "full" =
    size < 420 ? "compact" : size < 600 ? "normal" : "full";

  // viewer: profile coords → /api/geo fallback
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const c = userProfile?.coordinates;
      if (typeof c?.lat === "number" && typeof c?.lng === "number") {
        if (!cancel)
          setViewer({ lat: c.lat, lng: c.lng, city: c.city ?? null });
        setReady(true);
        return;
      }
      try {
        const res = await fetch("/api/geo", { cache: "no-store" });
        const json = (await res.json()) as {
          geo?: { latitude?: number; longitude?: number; city?: string };
        };
        const lat = Number(json?.geo?.latitude);
        const lng = Number(json?.geo?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng) && !cancel) {
          setViewer({ lat, lng, city: json?.geo?.city ?? null });
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancel) setReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [userProfile?.coordinates]);

  // tenants (distance is computed server-side; pass viewer for anon users)
  const { data: list } = useQuery({
    ...trpc.tenants.getMany.queryOptions({
      sort: "distance",
      limit,
      distanceFilterEnabled: false,
      userLat: viewer?.lat ?? null,
      userLng: viewer?.lng ?? null,
    }),
    enabled: ready,
  });

  // ---------- layout constants (controls overlap) ----------
  const minFrac = 0.18,
    maxFrac = 0.84;
  const minR = minFrac * R,
    maxR = maxFrac * R;

  const tenants = useMemo(
    () => (list?.docs ?? []) as TenantWithRelations[],
    [list]
  );

  // distance -> continuous radius
  const radiusFromDistance = useCallback(
    (km?: number | null) => {
      const d =
        typeof km === "number" && Number.isFinite(km)
          ? Math.min(Math.max(km, 0), maxDistanceKm)
          : maxDistanceKm;
      const f = d / maxDistanceKm; // 0..1
      return minR + (maxR - minR) * f; // map to [minR, maxR]
    },
    [minR, maxR, maxDistanceKm]
  );

  // bearing utils

  const bearingDeg = useCallback(
    (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const toDeg = (r: number) => (r * 180) / Math.PI;
      const φ1 = toRad(lat1),
        φ2 = toRad(lat2),
        Δλ = toRad(lng2 - lng1);
      const y = Math.sin(Δλ) * Math.cos(φ2);
      const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
      const θ = Math.atan2(y, x);
      return (toDeg(θ) + 360) % 360;
    },
    []
  );

  type Ring = {
    id: string;
    tenant: TenantWithRelations;
    r: number;
    baseDeg: number;
    seconds: number;
  };

  // Build non-overlapping rings
  const rings: Ring[] = useMemo(() => {
    if (!tenants.length) return [];

    // Sort by distance and hard-cap how many rings physically fit
    const range = maxR - minR;
    const maxRings = Math.max(1, Math.floor(range / RING_GAP));
    const pool = [...tenants]
      .sort((a, b) => (a.distance ?? 9e9) - (b.distance ?? 9e9))
      .slice(0, maxRings);

    const fallbackSpacing = 360 / Math.max(pool.length, 1);

    // desired radius + base angle for each tenant
    const prelim = pool.map((t, i) => {
      const r0 = radiusFromDistance(t.distance);
      const uc = t.user?.coordinates;
      const haveGeo =
        viewer && typeof uc?.lat === "number" && typeof uc?.lng === "number";

      const base = haveGeo
        ? bearingDeg(viewer!.lat, viewer!.lng, uc!.lat, uc!.lng)
        : i * fallbackSpacing;

      return { t, r0, base };
    });

    // Enforce radial spacing from inner to outer
    // enforce radial spacing from inner to outer
    prelim.sort((a, b) => a.r0 - b.r0);
    let last = minR - RING_GAP;
    const out: Ring[] = [];

    prelim.forEach((p, idx) => {
      let r = Math.max(p.r0, last + RING_GAP);
      r = Math.min(r, maxR);
      last = r;

      const seconds = baseSeconds + parallax * (r / R);
      const phase = (idx % 2 === 0 ? 14 : -14) + idx * 1.25;

      out.push({
        id: p.t.slug,
        tenant: p.t,
        r,
        baseDeg: p.base + phase,
        seconds,
      });
    });

    return out;
  }, [
    tenants,
    viewer,
    R,
    baseSeconds,
    parallax,
    minR,
    maxR,
    radiusFromDistance,
    bearingDeg,
  ]);

  // GSAP spin per ring
  const ringRefs = useRef(new Map<string, HTMLDivElement>());

  // helper to bind a ref per ring id
  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    if (!el) ringRefs.current.delete(id);
    else ringRefs.current.set(id, el);
  };

  const tweens = useRef<gsap.core.Tween[]>([]);
  useEffect(() => {
    tweens.current.forEach((tw) => tw.kill());
    tweens.current = [];
    rings.forEach((ring) => {
      const el = ringRefs.current.get(ring.id);
      if (!el) return;
      gsap.set(el, { ["--spin"]: 0 } as gsap.TweenVars);
      const tw = gsap.to(el, {
        ["--spin"]: 360,
        duration: ring.seconds,
        repeat: -1,
        ease: "none",
      } as gsap.TweenVars);
      tweens.current.push(tw);
    });
    return () => {
      tweens.current.forEach((tw) => tw.kill());
      tweens.current = [];
    };
  }, [rings]);

  // typed CSS vars
  type OrbitStyle = React.CSSProperties & {
    ["--base"]?: number;
    ["--radius"]?: string;
  };

  const viewerCity = viewer?.city ?? userProfile?.coordinates?.city ?? null;

  return (
    <div
      className="relative orbit-reset"
      style={{
        width: size,
        height: size,
        border: "none",
        outline: "none",
        background: "transparent",
      }}
    >
      <style jsx>{`
        .canvas {
          position: absolute;
          inset: 0;
          background: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
        }
        .ring {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .item {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .mover {
          pointer-events: auto;
          transform: rotate(calc((var(--base) + var(--spin)) * 1deg))
            translateX(var(--radius))
            rotate(calc(-1 * (var(--base) + var(--spin)) * 1deg));
          transform-origin: 0 0;
          will-change: transform;
        }
        .orbit-reset,
        .orbit-reset * {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* guide rings + center dot (tooltip via <title/>) */}
      <svg
        className="canvas pointer-events-none select-none"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const f = (i + 1) / (size < 420 ? 4 : 6);
          const r = minR + (maxR - minR) * f;
          return (
            <circle
              key={`g${i}`}
              cx={R}
              cy={R}
              r={r}
              fill="none"
              stroke="#d1d5db"
              strokeOpacity="0.9"
              strokeWidth="1.5"
              strokeDasharray="3 7"
            />
          );
        })}
      </svg>
      {/* ⬇️ HTML overlay for tooltip, OUTSIDE the <svg> */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
              aria-label={viewerCity ? `You · ${viewerCity}` : "You"}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{viewerCity ? `You · ${viewerCity}` : "You"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* rings + compact badges */}
      {rings.map(({ id, tenant, r, baseDeg }) => {
        const style: OrbitStyle = {
          "--base": baseDeg,
          "--radius": `${Math.round(r)}px`,
        };

        const href = generateTenantUrl(tenant.slug);
        const color = tenant.categories?.[0]?.color as string | undefined;

        return (
          <div key={`ring-${id}`} ref={setRef(id)} className="ring">
            <div className="item" style={style}>
              <div className="mover">
                <CircleBadge
                  t={tenant}
                  size={BADGE_D}
                  href={href}
                  color={color}
                  mode={mode}
                  currency={currency}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
