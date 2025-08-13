import { NextResponse } from "next/server";
import { geolocation } from "@vercel/functions";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  try {
    const g = geolocation(req); // { country, region, city, latitude, longitude }
    return NextResponse.json(
      { geo: g, source: "vercel" },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
    );
  } catch (err) {
    console.error("Geo route error:", err);
    return NextResponse.json({ geo: null, error: "Failed to fetch location" }, { status: 500 });
  }
}
