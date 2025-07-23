import { NextResponse } from 'next/server';
import { IxTime } from '~/lib/ixtime';

export async function GET() {
  try {
    const health = await IxTime.checkBotHealth();
    const status = await IxTime.getStatus();
    
    return NextResponse.json({
      success: true,
      botHealth: health,
      botAvailable: status.botAvailable,
      botStatus: status.botStatus ? 'Connected' : 'Disconnected',
      currentIxTime: status.currentIxTime,
      formattedIxTime: status.formattedIxTime
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}