// src/app/api/ixtime/set-override-direct/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { IxTime } from "~/lib/ixtime";
import { isSystemOwner } from "~/lib/auth";

export async function POST(request: Request) {
  try {
    // Require authentication for time control operations
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Only admins/owners can directly override time settings
    if (!isSystemOwner(session.userId)) {
      const role = (session.sessionClaims?.metadata as any)?.role;
      if (!["admin", "owner", "staff"].includes(role)) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

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
