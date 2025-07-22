"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { autocomplete } from "@/lib/google";
import { Language, PlaceData } from "@googlemaps/google-maps-services-js";
import { profileSchema } from "@/modules/auth/schemas";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";

function extractCountry(address: string): string {
  const parts = address.split(",").map((part) => part.trim());
  return parts[parts.length - 1] || "";
}
function detectLanguage(): Language {
  const langCode = navigator.language.slice(0, 2);
  const mapped = (Language as Record<string, Language>)[langCode];
  return mapped ?? Language.en;
}

export function ProfileForm() {
  // Form logic (react-hook-form for validation, but you can use your own)
  const form = useForm<z.infer<typeof profileSchema>>({
    mode: "all",
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
      email: "",
      location: "",
      country: "",
    },
  });

  const userLang = detectLanguage();

  // Google autocomplete logic
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
    const fetchPredictions = async () => {
      const results = await autocomplete(locationInput, userLang);
      setPredictions(results as PlaceData[]);
    };
    fetchPredictions();
  }, [locationInput, userLang]);

  const handleLocationSelect = (place: PlaceData) => {
    const address = place.formatted_address;
    const country = extractCountry(address);

    setLocationInput(address);
    setPredictions([]);
    form.setValue("location", address, { shouldValidate: true });
    form.setValue("country", country, { shouldValidate: true });

    setSelectedLocation({
      address,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      country,
    });
    setLocationInput(address);
    setPredictions([]);
    // form.setValue("location", place.formatted_address, {
    //   shouldValidate: true,
    // });
    // form.setValue("country", extractCountry(place.formatted_address), {
    //   shouldValidate: true,
    // });
    form.setValue("location", address, { shouldValidate: true });
    form.setValue("country", country, { shouldValidate: true });
  };

  // Submit handler
  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    const submission = {
      ...values,
      lat: selectedLocation?.lat,
      lng: selectedLocation?.lng,
    };
    // Here you would call your API, mutation, etc.
    // alert(`Submitted:\n${JSON.stringify(values, null, 2)}`);
    alert(JSON.stringify(submission, null, 2));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5">
      <div className="bg-[#F4F4F0] h-screen w-full lg:col-span-3 overflow-y-auto">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-8 p-4 lg:p-16"
            autoComplete="off"
          >
            <h1 className="text-3xl font-bold mb-8">Profile settings</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Username */}
              <FormField
                name="username"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Location */}
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
                            // If the user starts typing, clear the country
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
                                  onClick={() =>
                                    handleLocationSelect(prediction)
                                  }
                                >
                                  {prediction.formatted_address}
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Email */}
              <FormField
                name="email"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Country */}
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
                    <FormMessage />
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
      </div>
    </div>
  );
}
