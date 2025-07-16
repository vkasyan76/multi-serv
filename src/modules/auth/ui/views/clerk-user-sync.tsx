"use client";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export const ClerkUserSync = () => {
  const { isSignedIn } = useUser();
  const trpc = useTRPC();
  const sync = useMutation(trpc.auth.syncClerkUser.mutationOptions());

  useEffect(() => {
    if (isSignedIn && sync.isIdle) {
      sync.mutate();
    }
  }, [isSignedIn, sync]);

  return null;
};
