import { NextResponse } from "next/server";
import { geolocation } from "@vercel/functions";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  try {
    const geo = geolocation(req); // { country, region, city, latitude, longitude }
    
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
        { geo: dev, source: "dev-mock" },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
      );
    }
    
    return NextResponse.json(
      { geo, source: "vercel" },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
    );
  } catch (err) {
    console.error("Geo route error:", err);
    return NextResponse.json({ geo: null, error: "Failed to fetch location" }, { status: 500 });
  }
}
