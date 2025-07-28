// src/app/api/ixtime/sync-from-bot/route.ts
import { NextResponse } from 'next/server';
import { IxTime } from '~/lib/ixtime';

export async function POST() {
  try {
    // Fetch current state from Discord bot
    const BOT_URL = process.env.IXTIME_BOT_URL || process.env.NEXT_PUBLIC_IXTIME_BOT_URL || 'http://localhost:3001';
    
    const response = await fetch(`${BOT_URL}/ixtime/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      throw new Error(`Discord bot API returned ${response.status}`);
    }
    
    const botData = await response.json();
    
    // Apply bot's time and multiplier to IxStats
    if (botData.hasTimeOverride && botData.ixTimeTimestamp) {
      // Bot has a time override, apply it to IxStats
      IxTime.setTimeOverride(botData.ixTimeTimestamp);
    } else {
      // Bot is using natural time, clear IxStats override
      IxTime.clearTimeOverride();
    }
    
    if (botData.hasMultiplierOverride && botData.multiplier) {
      // Bot has a multiplier override, apply it to IxStats
      IxTime.setMultiplierOverride(botData.multiplier);
    } else {
      // Bot is using natural multiplier, clear IxStats override
      IxTime.clearMultiplierOverride();
    }
    
    // Get the current state after sync
    const currentState = {
      ixTimeTimestamp: IxTime.getCurrentIxTime(),
      ixTimeFormatted: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
      multiplier: IxTime.getTimeMultiplier(),
      isPaused: IxTime.isPaused(),
      gameYear: IxTime.getCurrentGameYear(),
      isNaturalProgression: IxTime.isMultiplierNatural()
    };
    
    return NextResponse.json({
      success: true,
      message: 'Successfully synced with Discord bot',
      botData: {
        ixTimeTimestamp: botData.ixTimeTimestamp,
        ixTimeFormatted: botData.ixTimeFormatted,
        multiplier: botData.multiplier,
        hasTimeOverride: botData.hasTimeOverride,
        hasMultiplierOverride: botData.hasMultiplierOverride
      },
      currentState
    });
    
  } catch (error) {
    console.error('Error syncing from Discord bot:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync with Discord bot',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}