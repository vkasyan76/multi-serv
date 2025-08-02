"use server";

import { Client, Language } from "@googlemaps/google-maps-services-js";

const client = new Client();
export const autocomplete = async (input: string, language: "en" | "es" | "fr" | "de" | "it" | "pt" = "en") => {
  if (!input || input.trim().length === 0) return [];

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    console.error("Google Maps API key is not configured");
    return [];
  }

  try {
    const response = await client.textSearch({
      params: {
        query: input,
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        language: language as Language,
      },
    });

    return response.data.results || [];
  } catch (error) {
    console.error(error);
    return [];
  }
};
