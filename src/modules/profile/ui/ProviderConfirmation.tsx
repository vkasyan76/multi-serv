"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Wrench,
  AlertCircle,
  MapPin,
  Search,
  Settings,
  Calendar,
  X,
} from "lucide-react";

type Mode = "prereq" | "confirm";

interface ProviderConfirmationProps {
  mode: Mode;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  isSubmitting?: boolean;
}

// Ensure this component is treated as client-only
export default function ProviderConfirmation({
  mode,
  onPrimaryAction,
  onSecondaryAction,
  isSubmitting,
}: ProviderConfirmationProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Focus management for accessibility
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const isPrereq = mode === "prereq";

  return (
    <div className="min-h-screen flex items-start justify-center p-4 sm:p-6 pt-20 sm:pt-24">
      <Card
        className="relative w-full max-w-lg mx-auto border-0 shadow-lg"
        role="dialog"
        aria-live="polite"
        aria-labelledby="provider-confirmation-title"
      >
        <button
          onClick={onSecondaryAction}
          aria-label="Close and return to general settings"
          className="absolute top-2 right-2 inline-flex items-center justify-center
                     h-8 w-8 rounded-full bg-background shadow-md
                     hover:bg-muted focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-ring transition"
        >
          <X className="h-4 w-4" />
        </button>
        <CardHeader className="text-center">
          <div
            className={`mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center
            ${isPrereq ? "bg-orange-100" : "bg-blue-100"}`}
          >
            {isPrereq ? (
              <AlertCircle className="w-6 h-6 text-orange-600" />
            ) : (
              <Wrench className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <CardTitle
            ref={titleRef}
            tabIndex={-1}
            className="text-xl font-bold text-foreground"
            id="provider-confirmation-title"
          >
            {isPrereq
              ? "Complete your general profile to continue"
              : "Become a service provider"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 text-sm">
          {isPrereq ? (
            <>
              {/* Alert Card - Simplified content focused on location requirement */}
              <p className="text-muted-foreground text-center">
                Your location is needed so customers can find you.
              </p>
              <div className="space-y-3 flex flex-col items-center">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Add your location to appear in local searches
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Confirmation Card - Keep existing content unchanged */}
              <p className="text-muted-foreground text-center">
                Start offering your services and connect with clients in your
                area
              </p>
              <div className="space-y-3 flex flex-col items-center">
                <div className="flex items-center gap-3">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Appear in search results for your location
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Set your hourly rate and service categories
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Manage your availability and bookings
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            {isPrereq ? (
              // Alert Card - Single button that redirects to General Profile
              <Button
                onClick={onSecondaryAction}
                className="w-full sm:w-auto min-w-[200px]"
              >
                Complete General Settings
              </Button>
            ) : (
              // Confirmation Card - Two buttons as intended
              <>
                <Button
                  onClick={onPrimaryAction}
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 min-w-[140px]"
                >
                  {isSubmitting && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden
                    />
                  )}
                  Create Provider Profile
                </Button>
                <Button
                  variant="outline"
                  onClick={onSecondaryAction}
                  className="w-full sm:flex-1 min-w-[140px]"
                >
                  Maybe next time
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
