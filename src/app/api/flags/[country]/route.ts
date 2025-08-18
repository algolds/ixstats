// API endpoint for individual country flag retrieval using Wiki Commons API ONLY
import { NextRequest, NextResponse } from 'next/server';
import { improvedFlagService } from '~/lib/improved-flag-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ country: string }> }
) {
  try {
    const resolvedParams = await params;
    const country = decodeURIComponent(resolvedParams.country);
    
    if (!country) {
      return NextResponse.json(
        { error: 'Country parameter is required' },
        { status: 400 }
      );
    }

    // Check if cached first (fast response - Wiki Commons API cache only)
    const cachedUrl = improvedFlagService.getCachedFlagUrl(country);
    if (cachedUrl) {
      const isPlaceholder = improvedFlagService.isPlaceholderFlag(cachedUrl);
      
      return NextResponse.json({
        country,
        flagUrl: cachedUrl,
        cached: true,
        isLocal: false, // NO LOCAL FILES EVER
        isPlaceholder,
        timestamp: Date.now(),
      });
    }

    // If not cached, fetch it from Wiki Commons API
    console.log(`[Flag API] Fetching flag for: ${country} (Wiki Commons API only)`);
    const flagUrl = await improvedFlagService.getFlagUrl(country);

    if (flagUrl) {
      const isPlaceholder = improvedFlagService.isPlaceholderFlag(flagUrl);
      
      return NextResponse.json({
        country,
        flagUrl,
        cached: false,
        isLocal: false, // NO LOCAL FILES EVER
        isPlaceholder,
        timestamp: Date.now(),
      });
    }

    // Return null if no flag found - let client handle fallback
    return NextResponse.json({
      country,
      flagUrl: null,
      cached: false,
      isLocal: false, // NO LOCAL FILES EVER
      placeholder: false,
      timestamp: Date.now(),
    });

  } catch (error) {
    const resolvedParams = await params;
    console.error(`[Flag API] Error getting flag for ${resolvedParams.country}:`, error);
    
    return NextResponse.json({
      error: 'Failed to fetch flag',
      country: resolvedParams.country,
      flagUrl: null, // NO PLACEHOLDER FILES
      cached: false,
      isLocal: false, // NO LOCAL FILES EVER
      placeholder: false,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}