// src/app/api/flag-cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { enhancedFlagCacheManager } from '~/lib/enhanced-flag-cache-manager';
import { improvedFlagService } from '~/lib/improved-flag-service';
import { api } from '~/trpc/server';
import { ixnayWiki } from '~/lib/mediawiki-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        // Get cache statistics
        const stats = improvedFlagService.getStats();
        return NextResponse.json({
          success: true,
          stats,
          timestamp: Date.now(),
        });

      case 'status':
        // Get detailed status including MediaWiki service stats
        const cacheStats = improvedFlagService.getStats();
        const mediaWikiStats = ixnayWiki.getCacheStats();
        
        return NextResponse.json({
          success: true,
          flagService: cacheStats,
          mediaWiki: mediaWikiStats,
          timestamp: Date.now(),
        });

      case 'flags':
        // Get all cached flag URLs for specified countries
        const countryParam = searchParams.get('countries');
        let countryNames: string[] = [];
        
        if (countryParam) {
          // Parse comma-separated country names from query parameter
          countryNames = countryParam.split(',').map(name => name.trim()).filter(Boolean);
        }
        
        if (countryNames.length === 0) {
          // If no countries provided, get all countries from the database
          const allCountries = await api.countries.getAll({ limit: 1000 });
          const names = allCountries.countries.map((c: any) => c.name);
          countryNames.push(...names);
        }
        
        const flagUrls = await improvedFlagService.batchGetFlags(countryNames);
        
        return NextResponse.json({
          success: true,
          flags: flagUrls,
          totalCountries: countryNames.length,
          timestamp: Date.now(),
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use ?action=stats, ?action=status, or ?action=flags',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[FlagCache API] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'update':
        // Trigger a manual flag cache update
        const body = await request.json();
        const updateCountryNames = body.countries || [];
        
        if (updateCountryNames.length === 0) {
          // If no countries provided, get all countries from the database
          const allCountries = await api.countries.getAll({ limit: 1000 });
          const names = allCountries.countries.map((c: any) => c.name);
          
          console.log(`[FlagCache API] Initializing with ${names.length} countries from database`);
          await improvedFlagService.initialize(names);
        } else {
          console.log(`[FlagCache API] Updating flags for ${updateCountryNames.length} specified countries`);
          await improvedFlagService.updateAllFlags();
        }

        return NextResponse.json({
          success: true,
          message: 'Flag cache update started (includes local file downloads)',
          stats: improvedFlagService.getStats(),
          timestamp: Date.now(),
        });

      case 'initialize':
        // Initialize the flag service with all countries
        const initAllCountries = await api.countries.getAll({ limit: 1000 });
        const initCountryNames = initAllCountries.countries.map((c: any) => c.name);
        
        console.log(`[FlagCache API] Initializing improved flag service with ${initCountryNames.length} countries`);
        await improvedFlagService.initialize(initCountryNames);

        return NextResponse.json({
          success: true,
          message: 'Improved flag service initialized',
          countryCount: initCountryNames.length,
          stats: improvedFlagService.getStats(),
          timestamp: Date.now(),
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use ?action=update or ?action=initialize',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[FlagCache API] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'clear':
        // Clear all caches (including local files)
        await improvedFlagService.clearCache();
        
        return NextResponse.json({
          success: true,
          message: 'All flag caches cleared (including local files)',
          timestamp: Date.now(),
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use ?action=clear',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[FlagCache API] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}