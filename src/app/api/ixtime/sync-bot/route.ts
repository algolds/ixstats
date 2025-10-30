// src/app/api/ixtime/sync-bot/route.ts
import { NextResponse } from "next/server";
import { IxTime } from "~/lib/ixtime";

export async function POST() {
  try {
    // Notify the Discord bot to sync with us
    const BOT_URL =
      process.env.IXTIME_BOT_URL ||
      process.env.NEXT_PUBLIC_IXTIME_BOT_URL ||
      "http://localhost:3001";

    const response = await fetch(`${BOT_URL}/ixtime/sync-from-ixstats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      const botSyncResult = await response.json();
      return NextResponse.json({
        success: true,
        message: "Discord bot successfully synced with IxStats",
        botResponse: botSyncResult,
      });
    } else {
      throw new Error(`Bot API returned ${response.status}`);
    }
  } catch (error) {
    console.error("Error syncing with Discord bot:", error);
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
