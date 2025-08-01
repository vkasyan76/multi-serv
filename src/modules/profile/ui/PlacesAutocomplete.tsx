"use client";

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
import { PlaceData } from "@googlemaps/google-maps-services-js";
import { useEffect, useState } from "react";

export const PlacesAutocomplete = () => {
  const [predictions, setPredictions] = useState<PlaceData[]>([]);
  const [input, setInput] = useState("");

  function detectLanguage(): "en" | "es" | "fr" | "de" | "it" | "pt" | "ru" | "zh" | "ja" | "ko" {
    if (typeof navigator === "undefined") return "en";
    const langCode = navigator.language.slice(0, 2).toLowerCase();
    const supportedLanguages = ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko"];
    if (supportedLanguages.includes(langCode)) {
      return langCode as "en" | "es" | "fr" | "de" | "it" | "pt" | "ru" | "zh" | "ja" | "ko";
    }
    return "en";
  }

  // const userLang =
  //   typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en";
  const userLang = detectLanguage();
  console.log("User language:", userLang);
  console.log(navigator.language);

  // Add debouncing to prevent excessive API calls.
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      const fetchPredictions = async () => {
        const predictions = await autocomplete(input, userLang);
        setPredictions(predictions as PlaceData[]);
      };
      fetchPredictions();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [input, userLang]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 pb-20 gap-16 sm:p-72 font-[family-name:var(--font-geist-sans)]">
      <Command>
        <CommandInput
          placeholder="Type a command or search..."
          value={input}
          onValueChange={setInput}
        />
        <CommandList>
          <CommandEmpty>Start typing to search...</CommandEmpty>
          <CommandGroup heading="Suggestions">
            {predictions.map((prediction) => (
              <CommandItem key={prediction.place_id}>
                {prediction.formatted_address}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </Command>
    </div>
  );
};
