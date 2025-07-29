// src/app/api/ixtime/set-natural/route.ts
import { NextResponse } from 'next/server';
import { IxTime } from '~/lib/ixtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { multiplier } = body;
    
    if (typeof multiplier !== 'number' || multiplier < 0 || multiplier > 10) {
      return NextResponse.json(
        { error: 'Invalid multiplier. Must be a number between 0 and 10.' },
        { status: 400 }
      );
    }
    
    // Set natural multiplier
    const result = IxTime.setNaturalMultiplier(multiplier);
    
    // Auto-sync with Discord bot
    try {
      const BOT_URL = process.env.IXTIME_BOT_URL || process.env.NEXT_PUBLIC_IXTIME_BOT_URL || 'http://localhost:3001';
      const syncResponse = await fetch(`${BOT_URL}/ixtime/set-natural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier }),
        signal: AbortSignal.timeout(5000)
      });
      
      if (syncResponse.ok) {
        console.log('Successfully auto-synced multiplier change to Discord bot');
      } else {
        console.warn('Failed to auto-sync with Discord bot');
      }
    } catch (syncError) {
      console.warn('Discord bot auto-sync failed:', syncError);
    }
    
    return NextResponse.json({
      success: true,
      ...result,
      currentTime: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
      currentMultiplier: IxTime.getTimeMultiplier(),
      isNaturalProgression: IxTime.isMultiplierNatural()
    });
    
  } catch (error) {
    console.error('Error setting natural time multiplier:', error);
    return NextResponse.json(
      { error: 'Failed to set natural time multiplier' },
      { status: 500 }
    );
  }
}