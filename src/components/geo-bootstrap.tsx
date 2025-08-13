"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function GeoBootstrap() {
  const { isSignedIn, user } = useUser();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

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
    if (!isSignedIn || !user?.id) return;

    const key = `geoSaved:${user.id}`;
    if (localStorage.getItem(key) === "1") return;

    (async () => {
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

        console.log("GeoBootstrap: Saving coordinates:", geo);

        // ✅ Keep nested structure (matches server schema)
        await updateUserCoordinates.mutateAsync({
          coordinates: {
            country: geo.country ?? null,
            region: geo.region ?? null,
            city: geo.city ?? null,
            lat: typeof geo.latitude === "number" ? geo.latitude : null,
            lng: typeof geo.longitude === "number" ? geo.longitude : null,
          }
        });

        // ✅ Set the session flag only after SUCCESS
        localStorage.setItem(key, "1");
        console.log("GeoBootstrap: Coordinates saved successfully");

      } catch (e) {
        console.warn("GeoBootstrap: unexpected failure:", e);
      }
    })();
  }, [isSignedIn, user?.id, updateUserCoordinates]); // Include updateUserCoordinates in dependencies

  return null;
}
