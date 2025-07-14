// src/app/api/flag-cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { flagCacheManager } from '~/lib/flag-cache-manager';
import { api } from '~/trpc/server';
import { ixnayWiki } from '~/lib/mediawiki-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        // Get cache statistics
        const stats = flagCacheManager.getStats();
        return NextResponse.json({
          success: true,
          stats,
          timestamp: Date.now(),
        });

      case 'status':
        // Get detailed status including MediaWiki service stats
        const cacheStats = flagCacheManager.getStats();
        const mediaWikiStats = ixnayWiki.getCacheStats();
        
        return NextResponse.json({
          success: true,
          flagCache: cacheStats,
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
        
        const flagUrls: Record<string, string | null> = {};
        
        for (const countryName of countryNames) {
          // Always fetch and cache the flag URL if not present
          const flagUrl = await flagCacheManager.getFlagUrl(countryName);
          flagUrls[countryName] = flagUrl;
        }
        
        return NextResponse.json({
          success: true,
          flags: flagUrls,
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
          await flagCacheManager.initialize(names);
        } else {
          console.log(`[FlagCache API] Updating flags for ${updateCountryNames.length} specified countries`);
          await flagCacheManager.updateAllFlags();
        }

        return NextResponse.json({
          success: true,
          message: 'Flag cache update started',
          stats: flagCacheManager.getStats(),
          timestamp: Date.now(),
        });

      case 'initialize':
        // Initialize the cache manager with all countries
        const initAllCountries = await api.countries.getAll({ limit: 1000 });
        const initCountryNames = initAllCountries.countries.map((c: any) => c.name);
        
        console.log(`[FlagCache API] Initializing flag cache manager with ${initCountryNames.length} countries`);
        await flagCacheManager.initialize(initCountryNames);

        return NextResponse.json({
          success: true,
          message: 'Flag cache manager initialized',
          countryCount: initCountryNames.length,
          stats: flagCacheManager.getStats(),
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
        // Clear the MediaWiki cache
        ixnayWiki.clearCache();
        
        return NextResponse.json({
          success: true,
          message: 'Flag cache cleared',
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