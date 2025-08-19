import { NextRequest, NextResponse } from "next/server";
import { Client, Language } from "@googlemaps/google-maps-services-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Client({});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");
  const language = searchParams.get("language") || "en";
  const sessionToken = searchParams.get("sessiontoken");
  
  // Validate language against supported languages
  const allowedLanguages = new Set(["en", "de", "fr", "it", "es", "pt"]);
  const validLanguage = allowedLanguages.has(language) ? language : "en";
  
  if (!placeId) {
    return NextResponse.json({ error: "Place ID is required" }, { status: 400 });
  }

  // Validate server-side API key
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured" },
      { status: 500 }
    );
  }

  try {
    const { data } = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: ["address_components", "formatted_address", "geometry"],
        language: validLanguage as Language,
        sessiontoken: sessionToken || undefined, // Include session token for billing
        key: apiKey, // Use secure server-side key
      },
    });

    if (data.status !== "OK" || !data.result) {
      return NextResponse.json(
        { error: `Place Details failed: ${data.status}` },
        { status: 502 }
      );
    }

    const { address_components, formatted_address, geometry } = data.result;
    return NextResponse.json({ 
      address_components, 
      formatted_address, 
      geometry 
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Place Details API error:", err);
    return NextResponse.json({ error: "Failed to fetch place details" }, { status: 500 });
  }
}
