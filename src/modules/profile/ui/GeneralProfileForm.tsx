// src/modules/profile/ui/GeneralProfileForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
  extractCountry,
} from "../location-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { autocomplete } from "@/lib/google";
import { PlaceData } from "@googlemaps/google-maps-services-js";
import Image from "next/image";
import { toast } from "sonner";
import { FieldErrors } from "react-hook-form";
import { PROFILE_FIELD_LABELS } from "@/modules/profile/schemas";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";

export function GeneralProfileForm() {
  const trpc = useTRPC();
  
  // Fetch user profile data from database
  const { data: userProfile, isLoading } = useQuery(
    trpc.auth.getUserProfile.queryOptions()
  );
  
  const updateUserProfile = useMutation(
    trpc.auth.updateUserProfile.mutationOptions({
      onSuccess: () => {
        toast.success("Profile updated successfully!");
      },
      onError: (error) => {
        console.error("Error updating profile:", error);
        toast.error(error.message || "Failed to update profile. Please try again.");
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

  // Update form values when user profile data is available
  useEffect(() => {
    if (userProfile) {
      form.reset({
        username: userProfile.username || "",
        email: userProfile.email || "",
        location: userProfile.location || "",
        country: userProfile.country || "",
        language: (userProfile.language as any) || getInitialLanguage(), // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    }
  }, [userProfile, form]);

  // ...All the autocomplete/useEffect logic as in your previous ProfileForm
  const selectedLanguage = form.watch("language");
  const [locationInput, setLocationInput] = useState("");
  const [predictions, setPredictions] = useState<PlaceData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    lat: number;
    lng: number;
    country: string;
  } | null>(null);

  useEffect(() => {
    if (!locationInput) {
      setPredictions([]);
      return;
    }
    const debounceTimer = setTimeout(() => {
      const fetchPredictions = async () => {
        const results = await autocomplete(locationInput, selectedLanguage);
        setPredictions(results as PlaceData[]);
      };
      fetchPredictions();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [locationInput, selectedLanguage]);

  const handleLocationSelect = (place: PlaceData) => {
    const address = place.formatted_address;
    const country = extractCountry(address);

    setSelectedLocation({
      address,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      country,
    });
    setLocationInput(address);
    setPredictions([]);
    form.setValue("location", address, { shouldValidate: true });
    form.setValue("country", country, { shouldValidate: true });
  };

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    const submission = {
      ...values,
      coordinates: selectedLocation ? {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
      } : undefined,
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
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 p-4 lg:p-10">
        <div className="flex items-center gap-4 mb-8">
          <Image
            src="/images/infinisimo_logo_illustrator.png"
            alt="Infinisimo Logo"
            width={48}
            height={48}
            className="rounded-full bg-white"
            priority
          />
          <h1 className="text-3xl font-bold">Profile settings</h1>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-lg">Loading profile data...</div>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onError)}
        className="flex flex-col gap-8 p-4 lg:p-10"
        autoComplete="off"
      >
        <div className="flex items-center gap-4 mb-8">
          <Image
            src="/images/infinisimo_logo_illustrator.png"
            alt="Infinisimo Logo"
            width={48}
            height={48}
            className="rounded-full bg-white"
            priority
          />
          <h1 className="text-3xl font-bold">Profile settings</h1>
        </div>

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
                   />
                 </FormControl>
               </FormItem>
             )}
           />
          <FormField
            name="location"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      value={locationInput}
                      onChange={(e) => {
                        setLocationInput(e.target.value);
                        field.onChange(e);
                        form.setValue("country", "");
                      }}
                      autoComplete="off"
                      placeholder="Search for your address…"
                    />
                    {predictions.length > 0 &&
                      locationInput !== selectedLocation?.address && (
                        <ul className="absolute left-0 right-0 z-10 bg-white border rounded shadow mt-1 max-h-48 overflow-y-auto">
                          {predictions.map((prediction) => (
                            <li
                              key={prediction.place_id}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => handleLocationSelect(prediction)}
                            >
                              {prediction.formatted_address}
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                </FormControl>
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
                    value={selectedLocation?.country || ""}
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      {SUPPORTED_LANGUAGES.find((l) => l.code === field.value)
                        ?.label || "Select language"}
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
          disabled={form.formState.isSubmitting}
        >
          Save Profile
        </Button>
      </form>
    </Form>
  );
}
