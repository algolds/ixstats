// src/app/api/ixtime/set-override/route.ts
import { NextResponse } from 'next/server';
import { IxTime } from '~/lib/ixtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ixTimeMs, multiplier } = body;
    
    if (typeof ixTimeMs !== 'number') {
      return NextResponse.json(
        { error: 'Invalid ixTimeMs. Must be a number.' },
        { status: 400 }
      );
    }
    
    console.log('[API] Setting time override to:', ixTimeMs, new Date(ixTimeMs).toISOString());
    
    // Force set the override
    IxTime.setTimeOverride(ixTimeMs);
    
    if (typeof multiplier === 'number') {
      console.log('[API] Setting multiplier override to:', multiplier);
      IxTime.setMultiplierOverride(multiplier);
    }
    
    // Verify it was set
    const currentTime = IxTime.getCurrentIxTime();
    console.log('[API] Current time after override:', currentTime, new Date(currentTime).toISOString());
    
    return NextResponse.json({
      success: true,
      message: 'Time override set successfully',
      setTime: ixTimeMs,
      setTimeFormatted: new Date(ixTimeMs).toISOString(),
      currentTime: currentTime,
      currentTimeFormatted: IxTime.formatIxTime(currentTime, true),
      multiplier: IxTime.getTimeMultiplier()
    });
    
  } catch (error) {
    console.error('Error setting time override:', error);
    return NextResponse.json(
      { error: 'Failed to set time override' },
      { status: 500 }
    );
  }
}