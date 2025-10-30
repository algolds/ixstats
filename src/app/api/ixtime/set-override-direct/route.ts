// src/app/api/ixtime/set-override-direct/route.ts
import { NextResponse } from "next/server";
import { IxTime } from "~/lib/ixtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ixTime, multiplier } = body;

    if (typeof ixTime === "number") {
      IxTime.setTimeOverride(ixTime);
    }

    if (typeof multiplier === "number") {
      IxTime.setMultiplierOverride(multiplier);
    }

    // Immediately check what was set
    const currentState = {
      ixTimeTimestamp: IxTime.getCurrentIxTime(),
      ixTimeFormatted: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
      multiplier: IxTime.getTimeMultiplier(),
      isPaused: IxTime.isPaused(),
      gameYear: IxTime.getCurrentGameYear(),
      hasTimeOverride: IxTime.getCurrentIxTime() !== null,
      hasMultiplierOverride: IxTime.getTimeMultiplier() !== null,
    };

    return NextResponse.json({
      success: true,
      message: "Override set successfully",
      currentState,
      setData: { ixTime, multiplier },
    });
  } catch (error) {
    console.error("Error setting override:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to set override",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
