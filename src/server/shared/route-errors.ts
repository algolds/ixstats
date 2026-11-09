import crypto from "crypto";
import { NextResponse } from "next/server";

/** Log the real error server-side; give the client a fixed message and a short id to quote. */
export function internalErrorResponse(scope: string, error: unknown, status = 500): NextResponse {
  const id = crypto.randomUUID().slice(0, 8);
  console.error(`[${scope}] ${id}`, error);
  return NextResponse.json({ error: "Something went wrong", errorId: id }, { status });
}
