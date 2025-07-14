import { NextRequest, NextResponse } from 'next/server';
import { flagService } from '~/lib/flag-service';
import { flagCacheManager } from '~/lib/flag-cache-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const clear = searchParams.get('clear');
    
    if (!country) {
      return NextResponse.json({ 
        error: 'Country parameter is required',
        example: '/api/flags/test?country=United_States'
      }, { status: 400 });
    }

    if (clear === '1') {
      flagService.clearCountryCache(country);
    }

    console.log(`[Flag Test API] Testing flag for country: ${country}`);

    // Initialize with the test country
    await flagService.initialize([country]);

    // Get the flag URL with debug log
    const debugLog: string[] = [];
    // @ts-ignore: access private method for debug
    const flagUrl = await flagCacheManager.fetchFlagFromTemplate(country, debugLog);
    
    // Get stats
    const stats = flagService.getStats();

    return NextResponse.json({
      country,
      flagUrl,
      isPlaceholder: flagService.isPlaceholderFlag(flagUrl || ''),
      stats,
      timestamp: new Date().toISOString(),
      debug: debugLog
    });

  } catch (error) {
    console.error('[Flag Test API] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 