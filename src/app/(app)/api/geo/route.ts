import { NextResponse } from "next/server";
import { geolocation } from "@vercel/functions";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  try {
    const geo = geolocation(req);
    
    // NEW: Extract language from Accept-Language header (robust parsing)
    const acceptLanguage = req.headers.get('accept-language') ?? 'en';
    const language = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase() || 'en';
    
    // Dev fallback for localhost testing (ChatGPT's suggestion)
    if (!geo?.country && process.env.NODE_ENV !== "production") {
      const dev = {
        country: "DE",
        region: "HE", 
        city: "Darmstadt",
        latitude: 49.8728,
        longitude: 8.6512,
      };
      console.log("Geo route: Using dev fallback for localhost");
      return NextResponse.json(
        { 
          geo: dev, 
          language: "de", // Add language to dev fallback
          source: "dev-mock" 
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
