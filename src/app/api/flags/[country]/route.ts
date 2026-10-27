// API endpoint for individual country flag retrieval using canonical flag resolver
import { NextRequest, NextResponse } from "next/server";
import { serverFlagResolver } from "~/lib/flags/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ country: string }> }
) {
  let countryName = "";
  try {
    const resolvedParams = await params;
    countryName = decodeURIComponent(resolvedParams.country || "");

    if (!countryName) {
      return NextResponse.json({ error: "Country parameter is required" }, { status: 400 });
    }

    const resolution = await serverFlagResolver.resolve(countryName);

    return NextResponse.json({
      country: countryName,
      flagUrl: resolution.isPlaceholder ? null : resolution.flagUrl,
      cached: resolution.cached,
      isLocal: false,
      isPlaceholder: resolution.isPlaceholder,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[Flag API] Error getting flag for ${countryName}:`, error);

    return NextResponse.json(
      {
        error: "Failed to fetch flag",
        country: countryName,
        flagUrl: null,
        cached: false,
        isLocal: false,
        placeholder: false,
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}
