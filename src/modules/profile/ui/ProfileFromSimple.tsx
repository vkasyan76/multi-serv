"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { autocomplete } from "@/lib/google";
import { Language, PlaceData } from "@googlemaps/google-maps-services-js";

function extractCountry(address: string): string {
  const parts = address.split(",").map((part) => part.trim());
  return parts[parts.length - 1] || "";
}

export function ProfileForm() {
  // Form logic (react-hook-form for validation, but you can use your own)
  const { register, handleSubmit, formState } = useForm({
    mode: "onTouched",
    defaultValues: {
      username: "",
      email: "",
      location: "",
      country: "",
    },
  });

  function detectLanguage(): Language {
    const langCode = navigator.language.slice(0, 2);
    const mapped = (Language as Record<string, Language>)[langCode];
    return mapped ?? Language.en;
  }
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

    setSelectedLocation({
      address,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      country,
    });
    setLocationInput(address);
    setPredictions([]);
  };

  // Submit handler
  const onSubmit = (data: any) => {
    // Add location and country to submission
    const submission = {
      ...data,
      location: selectedLocation?.address || "",
      country: selectedLocation?.country || "",
      lat: selectedLocation?.lat,
      lng: selectedLocation?.lng,
    };
    console.log(submission);
    alert(JSON.stringify(submission, null, 2));
  };

  return (
    <form
      className="max-w-2xl mx-auto bg-white shadow rounded-xl p-8"
      onSubmit={handleSubmit(onSubmit)}
      autoComplete="off"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <Input
              {...register("username", { required: "Username is required" })}
              placeholder="Enter your name"
              required
            />
            {formState.errors.username && (
              <p className="text-xs text-red-600 mt-1">
                {formState.errors.username.message as string}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Email address
            </label>
            <Input
              type="email"
              {...register("email", { required: "Email is required" })}
              placeholder="you@email.com"
              required
            />
            {formState.errors.email && (
              <p className="text-xs text-red-600 mt-1">
                {formState.errors.email.message as string}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <div className="relative">
              <Input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Search for your address…"
                autoComplete="off"
                required
              />
              {predictions.length > 0 &&
                locationInput !== selectedLocation?.address && (
                  <ul
                    className="
                      absolute left-0 right-0 z-10 bg-white border rounded shadow
                      mt-1 max-h-48 overflow-y-auto
                    "
                    style={{ minWidth: "100%" }}
                  >
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
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <Input
              value={selectedLocation?.country || ""}
              readOnly
              disabled
              tabIndex={-1}
            />
          </div>
        </div>
      </div>
      <button
        type="submit"
        className="w-full mt-8 bg-black text-white rounded-lg py-2 font-medium hover:bg-gray-900 transition"
      >
        Save Profile
      </button>
    </form>
  );
}
