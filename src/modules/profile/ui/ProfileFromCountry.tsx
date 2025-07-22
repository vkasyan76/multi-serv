"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

import { autocomplete } from "@/lib/google";
import { Language, PlaceData } from "@googlemaps/google-maps-services-js";

export function ProfileForm() {
  // Profile form state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  function detectLanguage(): Language {
    const langCode = navigator.language.slice(0, 2); // e.g. "it", "fr"
    const mapped = (Language as Record<string, Language>)[langCode];
    return mapped ?? Language.en; // fallback if not in enum
  }

  const userLang = detectLanguage();
  // Test language detection:
  // const userLang = Language.it;
  // console.log("User language:", userLang);
  // console.log(navigator.language);

  // Extracting country from address:
  function extractCountry(address: string): string {
    const parts = address.split(",").map((part) => part.trim());
    return parts[parts.length - 1] || "";
  }

  // Location autocomplete state
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

  // Handler for selecting a suggestionuserLang
  const handleLocationSelect = (place: PlaceData) => {
    const address = place.formatted_address;
    const country = extractCountry(address); // e.g. "Germany"

    setSelectedLocation({
      // address: place.formatted_address,
      address,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      country,
    });
    setLocationInput(place.formatted_address);
    setPredictions([]);
  };

  // Form submit (demo purpose: logs to console)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Send { username, email, selectedLocation } to your API or DB
    console.log({ username, email, location: selectedLocation });
    alert(
      `Submitted:\nName: ${username}\nEmail: ${email}\nLocation: ${
        selectedLocation?.address || ""
      }`
    );
  };

  return (
    <form
      className="max-w-md mx-auto space-y-6 bg-white shadow rounded-xl p-8"
      onSubmit={handleSubmit}
    >
      <div>
        <label className="block text-sm font-medium mb-1">Username</label>
        <Input
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email address</label>
        <Input
          placeholder="you@email.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {/* Location Input */}
      <div>
        <label className="block text-sm font-medium mb-1">Location</label>
        <div className="relative">
          <Input
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            placeholder="Search for your address…"
            autoComplete="off"
          />
          {/* As soon as the user picks a suggestion the dropdown disappears */}
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

        {/* Show selection preview */}
        {/* {selectedLocation && (
          <div className="text-xs text-gray-500 mt-1">
            Selected: {selectedLocation.address}
          </div>
        )} */}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Country</label>
        <Input value={selectedLocation?.country || ""} readOnly disabled />
      </div>
      <button
        type="submit"
        className="w-full bg-black text-white rounded-lg py-2 font-medium hover:bg-gray-900 transition"
      >
        Save Profile
      </button>
    </form>
  );
}
