// API endpoint for individual country flag retrieval using unified flag service
import { NextRequest, NextResponse } from 'next/server';
import { unifiedFlagService } from '~/lib/unified-flag-service';

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

    // Check if cached first (fast response)
    const cachedUrl = unifiedFlagService.getCachedFlagUrl(country);
    if (cachedUrl) {
      const isPlaceholder = unifiedFlagService.isPlaceholderFlag(cachedUrl);
      
      return NextResponse.json({
        country,
        flagUrl: cachedUrl,
        cached: true,
        isLocal: false, // NO LOCAL FILES EVER
        isPlaceholder,
        timestamp: Date.now(),
      });
    }

    // If not cached, fetch it from unified service
    console.log(`[Flag API] Fetching flag for: ${country}`);
    const flagUrl = await unifiedFlagService.getFlagUrl(country);

    if (flagUrl) {
      const isPlaceholder = unifiedFlagService.isPlaceholderFlag(flagUrl);
      
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