// src/modules/profile/ui/GeneralProfileForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { profileSchema } from "@/modules/profile/schemas";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  SUPPORTED_LANGUAGES,
  getInitialLanguage,
  extractAddressComponents,
} from "../location-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { autocomplete } from "@/lib/google";
import type {
  PlacePrediction,
  SelectedLocation,
} from "@/modules/tenants/types";

import { toast } from "sonner";
import { FieldErrors } from "react-hook-form";
import { PROFILE_FIELD_LABELS } from "@/modules/profile/schemas";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import LoadingPage from "@/components/shared/loading";
import { Loader2 } from "lucide-react";
import SettingsHeader from "./SettingsHeader"; // responsive reusable profile tabs header

interface GeneralProfileFormProps {
  onSuccess?: () => void;
}

export function GeneralProfileForm({ onSuccess }: GeneralProfileFormProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Fetch user profile data from database
  const { data: userProfile, isLoading } = useQuery(
    trpc.auth.getUserProfile.queryOptions()
  );

  const updateUserProfile = useMutation(
    trpc.auth.updateUserProfile.mutationOptions({
      onSuccess: () => {
        toast.success("Profile updated successfully!");
        // Invalidate the getUserProfile query to update the cache
        queryClient.invalidateQueries({
          queryKey: trpc.auth.getUserProfile.queryOptions().queryKey,
        });
        onSuccess?.(); // Call the onSuccess callback if provided
      },
      onError: (error) => {
        console.error("Error updating profile:", error);
        toast.error(
          error.message || "Failed to update profile. Please try again."
        );
      },
    })
  );

  const form = useForm<z.infer<typeof profileSchema>>({
    mode: "onBlur",
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
      email: "",
      location: "",
      country: "",
      language: getInitialLanguage(),
    },
  });

  // Add state variables and watch
  const selectedLanguage = useWatch({
    control: form.control,
    name: "language",
    defaultValue: getInitialLanguage(),
  });
  const [locationInput, setLocationInput] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);
  const [sessionToken, setSessionToken] = useState<string | undefined>();

  // Add session token management
  useEffect(() => {
    // Generate new session token on component mount
    setSessionToken(crypto.randomUUID());
  }, []);

  // Determine if profile has been completed before
  const isProfileCompleted = userProfile?.onboardingCompleted || false;

  const usernameLocked = isProfileCompleted; // Lock username if onboarding completed

  // Populate form with user data when it loads
  useEffect(() => {
    if (userProfile) {
      form.setValue("username", userProfile.username || "");
      form.setValue("email", userProfile.email || "");
      form.setValue("language", userProfile.language || "en");

      // Only populate location and country if user has completed onboarding
      // or if they have manually set a location
      if (isProfileCompleted || userProfile.coordinates?.manuallySet) {
        form.setValue("location", userProfile.location || "");
        form.setValue("country", userProfile.country || "");

        if (userProfile.location) {
          setLocationInput(userProfile.location);
        }

        // Set selected location if country exists - only display fields, not coordinate details
        if (userProfile.country) {
          setSelectedLocation({
            formattedAddress: userProfile.location || "",
            countryName: userProfile.country,
            countryISO: userProfile.coordinates?.countryISO,
            // Don't populate old coordinate details - they will be fetched fresh when user selects new location
            lat: undefined,
            lng: undefined,
            city: undefined,
            region: undefined,
            postalCode: undefined,
            street: undefined,
          });
        }
      } else {
        // For first-time users, show placeholder and don't auto-populate
        form.setValue("location", "");
        form.setValue("country", "");
        setLocationInput("");
        setSelectedLocation(null);
      }
    }
  }, [userProfile, form, isProfileCompleted]);

  useEffect(() => {
    if (!locationInput) {
      setPredictions([]);
      return;
    }
    const debounceTimer = setTimeout(() => {
      const fetchPredictions = async () => {
        const results = await autocomplete(
          locationInput,
          selectedLanguage,
          sessionToken
        );
        setPredictions(results);
      };
      fetchPredictions();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [locationInput, selectedLanguage, sessionToken]);

  const handleLocationSelect = async (prediction: PlacePrediction) => {
    try {
      // Fetch place details for structured data
      const response = await fetch(
        `/api/place-details?placeId=${prediction.place_id}&language=${selectedLanguage}&sessiontoken=${sessionToken}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch place details");
      }

      const placeDetails = await response.json();
      const addressComponents = extractAddressComponents(
        placeDetails.address_components
      );

      // Check if the street number is included:

      if (!(addressComponents.streetNumber ?? "").trim()) {
        toast.error(
          "Please choose a full street address that includes a house number."
        );
        return;
      }

      // Single, direct state update
      const next: SelectedLocation = {
        formattedAddress: placeDetails.formatted_address,
        lat: placeDetails.geometry?.location?.lat,
        lng: placeDetails.geometry?.location?.lng,
        city: addressComponents.city ?? undefined,
        region: addressComponents.region ?? undefined,
        postalCode: addressComponents.postalCode ?? undefined,
        street: addressComponents.street ?? undefined,
        streetNumber: addressComponents.streetNumber ?? undefined,
        countryISO: addressComponents.countryISO ?? undefined,
        countryName: addressComponents.countryName ?? undefined,
      };
      setSelectedLocation(next);
      setLocationInput(placeDetails.formatted_address);
      setPredictions([]);

      form.setValue("location", placeDetails.formatted_address, {
        shouldValidate: true,
      });
      form.setValue("country", addressComponents.countryName || "", {
        shouldValidate: true,
      });
    } catch (error) {
      console.error("Error fetching place details:", error);
      toast.error("Failed to get location details. Please try again.");
    }
  };

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    // Address check:
    if (!isProfileCompleted) {
      if (!selectedLocation) {
        form.setError("location", {
          type: "manual",
          message: "Please select an address from the suggestions.",
        });
        toast.error("Please select an address from the suggestions.");
        return;
      }

      // Ensure street number is present
      const streetNumber = (selectedLocation.streetNumber ?? "").trim();
      if (!streetNumber) {
        form.setError("location", {
          type: "manual",
          message: "Address must include a house number.",
        });
        toast.error("Address must include a house number.");
        return;
      }
    }

    // Sanitize coordinates to ensure no old data is sent
    const sanitizeCoordinates = (location: SelectedLocation | null) => {
      if (
        !location ||
        !Number.isFinite(location.lat ?? NaN) ||
        !Number.isFinite(location.lng ?? NaN)
      ) {
        return undefined;
      }

      // CRITICAL FIX: Always send explicit nulls to clear fields in MongoDB
      // MongoDB/Payload treats undefined as "leave as-is", null as "clear this field"
      return {
        lat: location.lat as number,
        lng: location.lng as number,
        city: location.city ?? null,
        countryISO: location.countryISO ?? null,
        countryName: location.countryName ?? null,
        region: location.region ?? null,
        postalCode: location.postalCode ?? null,
        street: location.street ?? null,
        streetNumber: location.streetNumber ?? null,
        ipDetected: false,
        manuallySet: true,
      };

      // Return statement is now inline above
    };

    const coordinates = sanitizeCoordinates(selectedLocation);

    // Dev log to verify coordinates before submission
    if (process.env.NODE_ENV === "development") {
      console.log("Submitting coordinates:", coordinates);
    }

    const submission = {
      ...values,
      ...(coordinates ? { coordinates } : {}), // If the user does not pick a new address, you do not touch stored coordinates.
      // The server will automatically set onboardingCompleted: true
    };

    updateUserProfile.mutate(submission);
  };

  const onError = (errors: FieldErrors<z.infer<typeof profileSchema>>) => {
    const messages = Object.entries(errors)
      .map(([field, err]) => {
        const label =
          PROFILE_FIELD_LABELS[field as keyof typeof PROFILE_FIELD_LABELS] ||
          field;
        if (Array.isArray(err)) {
          return err.map((e) => `${label}: ${e?.message}`).join("\n");
        }
        return `${label}: ${err?.message}`;
      })
      .filter(Boolean)
      .join("\n");
    toast.error(
      <span style={{ whiteSpace: "pre-line" }}>
        {messages || "Please fix the errors in the form."}
      </span>
    );
  };

  // Show loading state while user profile data is loading
  if (isLoading || !userProfile) {
    return <LoadingPage />;
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onError)}
        className="flex flex-col gap-8 p-4 lg:p-10"
        autoComplete="off"
        // Remove the key prop that was causing form re-renders
      >
        <SettingsHeader title="Profile settings" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FormField
            name="username"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="off"
                    placeholder="Enter your username"
                    value={field.value}
                    readOnly={usernameLocked}
                    disabled={false}
                    tabIndex={usernameLocked ? -1 : undefined}
                    className={
                      usernameLocked
                        ? "bg-gray-100 cursor-not-allowed"
                        : undefined
                    }
                  />
                </FormControl>
                {!usernameLocked && (
                  <span className="block text-xs text-gray-500 mt-1">
                    * cannot be changed after registration
                  </span>
                )}
              </FormItem>
            )}
          />
          <FormField
            name="location"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      value={locationInput}
                      onChange={(e) => {
                        setLocationInput(e.target.value);
                        field.onChange(e);
                        form.setValue("country", "");

                        // NUCLEAR OPTION: Completely clear ALL coordinate data when user types
                        // This ensures we never have stale coordinate data
                        if (
                          e.target.value !== selectedLocation?.formattedAddress
                        ) {
                          console.log(
                            "Location input changed - clearing ALL coordinate data"
                          );
                          setSelectedLocation(null);
                        }
                      }}
                      autoComplete="off"
                      placeholder="Search for your address…"
                    />
                    {predictions.length > 0 &&
                      locationInput !== selectedLocation?.formattedAddress && (
                        <ul className="absolute left-0 right-0 z-10 bg-white border rounded shadow mt-1 max-h-48 overflow-y-auto">
                          {predictions.map((prediction) => (
                            <li
                              key={prediction.place_id}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => handleLocationSelect(prediction)}
                            >
                              {prediction.description}
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                </FormControl>
                {/* Show subtle indicator when location is auto-populated from IP */}
                {/* {userProfile?.coordinates?.ipDetected &&
                  !userProfile?.coordinates?.manuallySet &&
                  locationInput && (
                    <p className="text-xs text-gray-500 mt-1">
                      📍 Auto-detected from your IP address
                    </p>
                  )} */}
              </FormItem>
            )}
          />
          <FormField
            name="email"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="off"
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                    value={userProfile?.email || ""}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            name="country"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={
                      selectedLocation?.countryName ||
                      userProfile?.country ||
                      ""
                    }
                    readOnly
                    disabled
                    tabIndex={-1}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            name="language"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Language</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? getInitialLanguage()}
                    onValueChange={field.onChange}
                    disabled={
                      updateUserProfile.isPending ||
                      form.formState.isSubmitting ||
                      isLoading
                    }
                  >
                    <SelectTrigger className="w-full">
                      {SUPPORTED_LANGUAGES.find(
                        (l) => l.code === (field.value ?? "en")
                      )?.label ?? "English"}
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map(({ code, label }) => (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="bg-black text-white hover:bg-pink-400 hover:text-primary"
          disabled={updateUserProfile.isPending || form.formState.isSubmitting} // ✅ block during mutation too
        >
          {updateUserProfile.isPending || form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isProfileCompleted ? "Updating..." : "Saving..."}
            </>
          ) : isProfileCompleted ? (
            "Update Profile"
          ) : (
            "Save Profile"
          )}
        </Button>
      </form>
    </Form>
  );
}
