"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

    const key = `geoSaved:${user.id}`;
    if (localStorage.getItem(key) === "1") return;

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

        const { geo } = await res.json();
        if (!geo?.country) {
          console.log("GeoBootstrap: No geolocation available (likely localhost)");
          return;
        }

        if (typeof geo.latitude !== "number" || typeof geo.longitude !== "number") {
          if (process.env.NODE_ENV !== "production") {
            console.log("GeoBootstrap: Missing latitude/longitude in /api/geo response; skipping save");
          }
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.log("GeoBootstrap: Saving coordinates (redacted)");
        }

        // ✅ Keep nested structure (matches server schema)
        await updateUserCoordinates.mutateAsync({
          coordinates: {
            country: geo.country ?? null,
            region: geo.region ?? null,
            city: geo.city ?? null,
            lat: geo.latitude,
            lng: geo.longitude,
          }
        });

        // ✅ Set the session flag only after SUCCESS
        localStorage.setItem(key, "1");

      } catch (e) {
        console.warn("GeoBootstrap: unexpected failure:", e);
      } finally {
        inflight[user.id] = false;
      }
    })();
  }, [isSignedIn, user?.id]); // Remove updateUserCoordinates from dependencies

  return null;
}
