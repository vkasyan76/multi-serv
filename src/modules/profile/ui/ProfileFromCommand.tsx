"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
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
  // const userLang = detectLanguage();
  const userLang = Language.it;
  console.log("User language:", userLang);
  console.log(navigator.language);

  // Location autocomplete state
  const [locationInput, setLocationInput] = useState("");
  const [predictions, setPredictions] = useState<PlaceData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    lat: number;
    lng: number;
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
    setSelectedLocation({
      address: place.formatted_address,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
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
      <div>
        <label className="block text-sm font-medium mb-1">Location</label>
        <Command>
          <CommandInput
            placeholder="Search for your address…"
            value={locationInput}
            onValueChange={setLocationInput}
            autoComplete="off"
          />
          <CommandList>
            <CommandEmpty>
              {locationInput ? "No results." : "Start typing to search…"}
            </CommandEmpty>
            <CommandGroup>
              {predictions.map((prediction) => (
                <CommandItem
                  key={prediction.place_id}
                  value={prediction.formatted_address}
                  onSelect={() => handleLocationSelect(prediction)}
                >
                  {prediction.formatted_address}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </CommandList>
        </Command>
        {/* Show selection preview */}
        {selectedLocation && (
          <div className="text-xs text-gray-500 mt-1">
            Selected: {selectedLocation.address}
          </div>
        )}
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
