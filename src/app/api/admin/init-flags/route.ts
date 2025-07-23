// src/app/api/admin/init-flags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { api } from '~/trpc/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[InitFlags] Starting flag cache initialization...');
    
    // Get all countries
    const allCountries = await api.countries.getAll({ limit: 1000 });
    const countryNames = allCountries.countries.map((c: any) => c.name);
    
    console.log(`[InitFlags] Found ${countryNames.length} countries to process`);
    
    // Call the flag cache API to update
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : request.headers.get('origin') || '';
    
    const cacheResponse = await fetch(`${baseUrl}/api/flag-cache?action=update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ countries: countryNames.slice(0, 50) }), // Limit to first 50 for now
    });
    
    const cacheResult = await cacheResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'Flag cache initialization started',
      countryCount: countryNames.length,
      processed: 50,
      cacheResult,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    console.error('[InitFlags] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}