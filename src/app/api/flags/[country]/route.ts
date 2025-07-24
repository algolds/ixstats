// API endpoint for individual country flag retrieval with enhanced caching
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

    // Check if cached first (fast response - includes local files)
    const cachedUrl = improvedFlagService.getCachedFlagUrl(country);
    if (cachedUrl) {
      const isLocal = improvedFlagService.hasLocalFlag(country);
      const isPlaceholder = improvedFlagService.isPlaceholderFlag(cachedUrl);
      
      return NextResponse.json({
        country,
        flagUrl: cachedUrl,
        cached: true,
        isLocal,
        isPlaceholder,
        timestamp: Date.now(),
      });
    }

    // If not cached, fetch it (may take longer and download locally)
    console.log(`[Flag API] Fetching flag for: ${country}`);
    const flagUrl = await improvedFlagService.getFlagUrl(country);

    if (flagUrl) {
      const isLocal = improvedFlagService.hasLocalFlag(country);
      const isPlaceholder = improvedFlagService.isPlaceholderFlag(flagUrl);
      
      return NextResponse.json({
        country,
        flagUrl,
        cached: false,
        isLocal,
        isPlaceholder,
        timestamp: Date.now(),
      });
    }

    // Return a default placeholder if no flag found
    return NextResponse.json({
      country,
      flagUrl: '/placeholder-flag.svg',
      cached: false,
      isLocal: false,
      placeholder: true,
      timestamp: Date.now(),
    });

  } catch (error) {
    const resolvedParams = await params;
    console.error(`[Flag API] Error getting flag for ${resolvedParams.country}:`, error);
    
    return NextResponse.json({
      error: 'Failed to fetch flag',
      country: resolvedParams.country,
      flagUrl: '/placeholder-flag.svg',
      cached: false,
      isLocal: false,
      placeholder: true,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}