import { NextRequest, NextResponse } from "next/server";
import { IxTime } from "~/lib/ixtime";

export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await IxTime.getStatus();
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    console.error("❌ IxTime status failed:", error);
    return NextResponse.json(
      {
        error: "Status fetch failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
