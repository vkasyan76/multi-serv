"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useId,
} from "react";

import type { TenantWithRelations } from "@/modules/tenants/types";
import { gsap } from "gsap";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  getLocaleAndCurrency,
  type AppLang,
  DEFAULT_APP_LANG,
} from "@/modules/profile/location-utils";

/** props */
export type TenantOrbitProps = {
  size?: number;
  maxDistanceKm?: number;
  baseSeconds?: number;
  parallax?: number;
  tenants: TenantWithRelations[]; // 🔹 data comes from parent
  onReady?: (count: number) => void;
  viewer?: { lat: number; lng: number; city?: string | null }; // to detrmine coordinates of the viewer
  selectedSlug?: string;
  onSelect?: (slug: string) => void;
  /** NEW: app language used for formatting prices */
  appLang?: AppLang;
};

type Viewer = { lat: number; lng: number; city?: string | null };

// computed later from `size`, keep placeholders to satisfy TS at top-level -for mobile
let BADGE_D = 96;
let RING_GAP = Math.max(56, Math.round(BADGE_D * 0.6));
// Show more tenants on the orbit (visual tweak):
// let RING_GAP = Math.max(28, Math.round(BADGE_D * 0.45));

type BadgeMode = "compact" | "normal" | "full";

function CircleBadge({
  t,
  size = 96,
  color,
  mode,
  currency,
  appLang,
  selected,
  onSelect,
}: {
  t: TenantWithRelations;
  size?: number;
  color?: string;
  mode: BadgeMode;
  currency: string;
  appLang: AppLang;
  selected?: boolean;
  onSelect?: (slug: string) => void;
}) {
  const city = t.user?.coordinates?.city ?? "—";
  const category = t.categories?.[0]?.name ?? "—";
  const bg = color && /^#/.test(color) ? color : undefined;

  // hourly rate (present by contract; may be null)
  const hr = t.hourlyRate;
  const price =
    typeof hr === "number" && Number.isFinite(hr)
      ? `${formatCurrency(hr, currency, appLang)}/h`
      : null;

  // tiny font steps per mode
  const nameCls = mode === "compact" ? "text-[11px]" : "text-[12px]";
  const metaCls = mode === "compact" ? "text-[10px]" : "text-[11px]";

  return (
    <Button
      variant="secondary"
      className={`rounded-full grid place-items-center text-center shadow-sm hover:shadow-md
             transition-transform duration-200 will-change-transform
             hover:scale-150 focus-visible:scale-110 ${
               selected
                 ? "ring-2 ring-red-500 scale-[1.03] before:content-[''] before:absolute before:-inset-1 before:rounded-full before:ring-2 before:ring-red-500/40 before:animate-pulse before:pointer-events-none"
                 : ""
             }`}
      style={{
        width: size,
        height: size,
        padding: 10,
        ...(bg
          ? { backgroundColor: bg, borderColor: bg, color: "#111827" }
          : {}),
      }}
      title={`${t.name} • ${category}${city ? ` • ${city}` : ""}${price ? ` • ${price}` : ""}`}
      onClick={onSelect ? () => onSelect(t.slug) : undefined}
    >
      <div className="leading-tight">
        <div className={`${nameCls} font-semibold line-clamp-1`}>{t.name}</div>

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
    </Button>
  );
}

export default function TenantOrbit({
  size = 640,
  maxDistanceKm = 80,
  baseSeconds = 18,
  parallax = 20,
  tenants: inputTenants, // <- get tenants from parent
  onReady,
  viewer: viewerProp, // viewer coordinates
  selectedSlug,
  onSelect,
  appLang = DEFAULT_APP_LANG,
}: TenantOrbitProps) {
  const R = size / 2;

  // ring radii range (keeps your original overlap behavior)
  const minFrac = 0.18,
    maxFrac = 0.84;
  const minR = minFrac * R,
    maxR = maxFrac * R;

  // scale badge & spacing with overall radar size
  BADGE_D = Math.round(Math.max(56, Math.min(96, size * 0.12))); // ~12% of radar; 56–96 clamp
  RING_GAP = Math.max(40, Math.round(BADGE_D * 0.6));

  const BG_PAD = Math.min(24, Math.max(8, Math.round(size * 0.035))); // white rim beyond the last dashed ring (px)
  const gradId = useId();
  const bgRadius = Math.min(maxR + BG_PAD, R);
  // const bgRadius = R; // to be 100% sure the tint always reaches the edge
  const outerHex = "#e8f5e9"; // warmer option: "#f3f4f0"; stronger: "#e6e9ee"
  // or "#ecfdf5" (teal-green 50), "#e8f5e9" (greenish), "hsl(142 70% 95%)", "#eaf9f0" minty, "#eceff3" greyish

  // UI bits we still use below
  const { currency } = getLocaleAndCurrency(appLang);
  const mode: "compact" | "normal" | "full" =
    size < 420 ? "compact" : size < 600 ? "normal" : "full";

  // viewer: keep only IP fallback (bearing/center dot), no profile dependency
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    let cancel = false;
    // Prefer the prop (DB coords from page)
    if (viewerProp) {
      setViewer({
        lat: viewerProp.lat,
        lng: viewerProp.lng,
        city: viewerProp.city ?? null,
      });
      return () => {
        cancel = true;
      };
    }
    (async () => {
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
      }
    })();
    return () => {
      cancel = true;
    };
  }, [viewerProp]);

  // tenants are provided by parent
  const tenants = useMemo(() => inputTenants ?? [], [inputTenants]);

  // optional notify parent
  useEffect(() => {
    onReady?.(tenants.length);
  }, [tenants.length, onReady]);

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

  const viewerCity = viewerProp?.city ?? viewer?.city ?? null;

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
        <defs>
          <radialGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            cx={R}
            cy={R}
            r={bgRadius}
          >
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="65%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={outerHex} />
          </radialGradient>
        </defs>
        {/* White background disk behind the orbit */}
        <circle
          cx={R}
          cy={R}
          r={bgRadius}
          fill={`url(#${gradId})`}
          stroke="#e5e7eb"
          strokeOpacity="0.7"
          strokeWidth="1"
        />

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
              stroke="#cfd4da"
              strokeOpacity="1"
              strokeWidth="1.4"
              strokeDasharray="2 6"
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
              <span className="relative block w-6 h-6">
                <span className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-ping" />
                <span className="absolute inset-1.5 rounded-full bg-red-500" />
              </span>
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

        const color = tenant.categories?.[0]?.color as string | undefined;

        return (
          <div key={`ring-${id}`} ref={setRef(id)} className="ring">
            <div className="item" style={style}>
              <div className="mover">
                <CircleBadge
                  t={tenant}
                  size={BADGE_D}
                  color={color}
                  mode={mode}
                  currency={currency}
                  appLang={appLang}
                  selected={tenant.slug === selectedSlug}
                  onSelect={onSelect}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
