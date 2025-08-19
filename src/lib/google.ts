"use server";

import { Client, Language } from "@googlemaps/google-maps-services-js";
import type { PlacePrediction } from "@/modules/tenants/types";

const client = new Client();

export const autocomplete = async (
  input: string, 
  language: "en" | "es" | "fr" | "de" | "it" | "pt" = "en",
  sessionToken?: string
): Promise<PlacePrediction[]> => {
  if (!input || input.trim().length === 0) return [];

  // Validate server-side API key
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Google Maps API key is not configured");
    return [];
  }

  try {
    const { data } = await client.placeAutocomplete({
      params: {
        input,
        language: language as Language,
        sessiontoken: sessionToken || undefined, // Include session token for billing
        key: apiKey, // Use secure server-side key
      },
    });

    if (data.status !== "OK") {
      console.warn("Autocomplete failed:", data.status);
      return [];
    }

    return data.predictions.map(prediction => ({
      place_id: prediction.place_id,
      description: prediction.description,
      formatted_address: prediction.structured_formatting?.main_text || prediction.description,
    }));
  } catch (error) {
    console.error("Autocomplete error:", error);
    return [];
  }
};
