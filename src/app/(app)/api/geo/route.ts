import { NextResponse } from "next/server";
import { geolocation } from "@vercel/functions";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  try {
    const geo = geolocation(req);
    
    // NEW: Extract language from Accept-Language header (robust parsing)
    const acceptLanguage = req.headers.get('accept-language') ?? 'en';
    const language = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase() || 'en';
    
    if (!geo?.country) {
      // 🔸 obvious fake coords so you notice failures
      const mock = {
        country: "AU",
        region: "NT",
        city: "Alice Springs",
        latitude: -23.6980,
        longitude: 133.8807,
      };
      console.warn("[/api/geo] No geolocation; returning dev mock (Australia).");
      // mark as mock so the client can skip saving
      return NextResponse.json(
        { 
          geo: mock, 
          language, 
          source: "dev-mock", 
          mock: true 
        },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
      );
    }
    
    return NextResponse.json(
      { 
        geo, 
        language, // NEW: Include detected language
        source: "vercel" 
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
    );
  } catch (err) {
    console.error("Geo route error:", err);
    return NextResponse.json({ 
      geo: null, 
      language: "en", // Include language in error response
      error: "Failed to fetch location" 
    }, { status: 500 });
  }
}
