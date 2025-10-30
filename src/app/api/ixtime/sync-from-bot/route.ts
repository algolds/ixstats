// src/app/api/ixtime/sync-from-bot/route.ts
import { NextResponse } from "next/server";
import { IxTime } from "~/lib/ixtime";

export async function POST(request: Request) {
  try {
    let botData;

    // Try to parse request body first (for auto-sync)
    try {
      const body = await request.json();
      if (body.ixTimeMs || body.multiplier !== undefined) {
        // Direct sync from bot command
        if (body.ixTimeMs) {
          IxTime.setTimeOverride(body.ixTimeMs);
        }
        if (typeof body.multiplier === "number") {
          IxTime.setMultiplierOverride(body.multiplier);
        }

        const currentState = {
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
          ixTimeFormatted: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
          multiplier: IxTime.getTimeMultiplier(),
          isPaused: IxTime.isPaused(),
          gameYear: IxTime.getCurrentGameYear(),
          isNaturalProgression: IxTime.isMultiplierNatural(),
        };

        return NextResponse.json({
          success: true,
          message: "Successfully auto-synced from Discord bot",
          currentState,
          syncData: body,
        });
      }
    } catch {
      // If parsing fails, fall back to fetching from bot
    }

    // Fetch current state from Discord bot (manual sync)
    const BOT_URL =
      process.env.IXTIME_BOT_URL ||
      process.env.NEXT_PUBLIC_IXTIME_BOT_URL ||
      "http://localhost:3001";

    // Check if bot is available first
    let response;
    try {
      response = await fetch(`${BOT_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        throw new Error(`Discord bot health check failed: ${response.status}`);
      }
    } catch (healthError) {
      // Bot is not available, return graceful fallback
      console.warn("Discord bot is not available, using local time state");
      const currentState = {
        ixTimeTimestamp: IxTime.getCurrentIxTime(),
        ixTimeFormatted: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
        multiplier: IxTime.getTimeMultiplier(),
        isPaused: IxTime.isPaused(),
        gameYear: IxTime.getCurrentGameYear(),
        isNaturalProgression: IxTime.isMultiplierNatural(),
      };

      return NextResponse.json({
        success: true,
        message: "Discord bot unavailable, using local time state",
        currentState,
        warning: "Discord bot is not responding - using local IxTime state",
      });
    }

    // Bot is available, fetch time status
    response = await fetch(`${BOT_URL}/ixtime/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Discord bot API returned ${response.status}`);
    }

    botData = await response.json();

    // Apply bot's current time and multiplier to IxStats (always sync to match bot)
    if (botData.ixTimeTimestamp) {
      IxTime.setTimeOverride(botData.ixTimeTimestamp);
    }

    if (botData.multiplier) {
      IxTime.setMultiplierOverride(botData.multiplier);
    }

    // Get the current state after sync
    const currentState = {
      ixTimeTimestamp: IxTime.getCurrentIxTime(),
      ixTimeFormatted: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
      multiplier: IxTime.getTimeMultiplier(),
      isPaused: IxTime.isPaused(),
      gameYear: IxTime.getCurrentGameYear(),
      isNaturalProgression: IxTime.isMultiplierNatural(),
    };

    return NextResponse.json({
      success: true,
      message: "Successfully synced with Discord bot",
      botData: {
        ixTimeTimestamp: botData.ixTimeTimestamp,
        ixTimeFormatted: botData.ixTimeFormatted,
        multiplier: botData.multiplier,
        hasTimeOverride: botData.hasTimeOverride,
        hasMultiplierOverride: botData.hasMultiplierOverride,
      },
      currentState,
    });
  } catch (error) {
    console.error("Error syncing from Discord bot:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync with Discord bot",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
