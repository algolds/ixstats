// src/app/api/ixtime/current/route.ts
import { NextResponse } from 'next/server';
import { IxTime } from '~/lib/ixtime';

export async function GET() {
  try {
    const currentIxTime = IxTime.getCurrentIxTime();
    const multiplier = IxTime.getTimeMultiplier();
    const status = await IxTime.getStatus();
    
    return NextResponse.json({
      ixTimeTimestamp: currentIxTime,
      ixTimeFormatted: IxTime.formatIxTime(currentIxTime, true),
      multiplier: multiplier,
      isPaused: IxTime.isPaused(),
      gameYear: IxTime.getCurrentGameYear(),
      gameTimeDescription: IxTime.getGameTimeDescription(),
      status: status
    });
  } catch (error) {
    console.error('Error getting current IxTime:', error);
    return NextResponse.json(
      { error: 'Failed to get current IxTime' },
      { status: 500 }
    );
  }
}