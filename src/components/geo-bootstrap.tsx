"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { countryNameFromCode, normalizeToSupported } from "@/modules/profile/location-utils";

// In-memory guard to prevent concurrent writes (Strict Mode / multi-tab protection)
const inflight: Record<string, boolean> = {};

export default function GeoBootstrap() {
  const { isSignedIn, user } = useUser();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  const updateUserCoordinates = useMutation(
    trpc.auth.updateUserCoordinates.mutationOptions({
      onSuccess: async () => {
        // Invalidate any user/profile query so UI sees coords immediately
        try {
          await queryClient.invalidateQueries({
            queryKey: trpc.auth.getUserProfile.queryOptions().queryKey,
          });
        } catch {
          /* noop */
        }
        console.log("GeoBootstrap: Coordinates saved successfully");
      },
      onError: (err) => {
        console.warn("GeoBootstrap: Failed to save coordinates:", err);
      },
    })
  );

  useEffect(() => {
    if (!isSignedIn || !user?.id || startedRef.current) return;
    startedRef.current = true;

    // REMOVED: localStorage read gate - this was blocking updates for non-onboarded users
    // const key = `geoSaved:${user.id}`;
    // if (localStorage.getItem(key) === "1") return;

    (async () => {
      // Prevent concurrent writes for the same user
      if (inflight[user.id]) return;
      inflight[user.id] = true;

      try {
        console.log("GeoBootstrap: Detecting user location...");

        const res = await fetch("/api/geo", { cache: "no-store" });
        if (!res.ok) {
          console.warn("GeoBootstrap: /api/geo failed:", res.status);
          return;
        }

        // FIX 1: Parse JSON ONCE (fixes double res.json() bug)
        const { geo, language, mock, source } = await res.json();
        
        // Skip saving mock data (obvious fake locations like Australia)
        if (mock === true || source === "dev-mock") {
          if (process.env.NODE_ENV !== "production") {
            console.warn("GeoBootstrap: mock geo detected; skipping save");
          }
          return;
        }
        
        if (!geo?.country) {
          console.log("GeoBootstrap: No geolocation available (likely localhost)");
          return;
        }

        // FIX 2: Coerce lat/lng to numbers (Vercel may return strings)
        const latNum = Number(geo?.latitude);
        const lngNum = Number(geo?.longitude);

        // FIX 3: Robust numeric check with better error logging
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
          if (process.env.NODE_ENV !== "production") {
            console.log("GeoBootstrap: invalid lat/lng from /api/geo, skipping", geo);
          }
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.log("GeoBootstrap: Saving coordinates (redacted)");
        }

        // FIX 4: Use normalized values in mutation
        const normalizedLang = normalizeToSupported(language);
        
        // If your helper supports a locale arg, pass it. If not, just call with the code.
        const displayCountry =
          // countryNameFromCode(geo.country, normalizedLang) ?? 
          countryNameFromCode(geo.country) ?? geo.country;

        await updateUserCoordinates.mutateAsync({
          coordinates: {
            country: geo.country ?? null,      // Keep ISO code in coordinates (e.g., "DE")
            region: geo.region ?? null,
            city: geo.city ?? null,
            lat: latNum,                       // Use normalized number
            lng: lngNum,                       // Use normalized number
          },
          country: displayCountry,             // Human-readable (e.g., "Germany")
          language: normalizedLang,            // Supported code (e.g., "de")
        });

        // REMOVED: localStorage write gate - this was preventing updates for non-onboarded users
        // If you ever want a gate, only set/check it AFTER onboardingCompleted === true
        // if (userProfile?.onboardingCompleted) {
        //   localStorage.setItem(`geoSaved:${user.id}`, "1");
        // }

      } catch (e) {
        console.warn("GeoBootstrap: unexpected failure:", e);
      } finally {
        inflight[user.id] = false;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user?.id]); // updateUserCoordinates is stable from tRPC mutation

  return null;
}
