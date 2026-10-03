import { NextResponse, type NextRequest } from "next/server";
import { bearerMatches } from "~/lib/security/safe-equal";

/**
 * Bearer-token guard for cron endpoints: CRON_SECRET is mandatory in production.
 * Returns the error response to send, or null when the request may proceed.
 */
export function cronAuthError(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === "production" && !cronSecret) {
    console.error("[SECURITY] CRON_SECRET not configured in production - cron endpoint disabled");
    return NextResponse.json({ error: "Cron endpoint not configured" }, { status: 503 });
  }

  if (cronSecret && !bearerMatches(request.headers.get("authorization"), cronSecret)) {
    console.warn(
      `[SECURITY] Unauthorized cron access attempt from ${request.headers.get("x-forwarded-for") || "unknown"}`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
