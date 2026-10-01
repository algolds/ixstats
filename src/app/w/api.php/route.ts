/**
 * src/app/w/api.php/route.ts — WikiOS's MediaWiki-compatible `api.php` (plan 410).
 *
 * Bots (Pywikibot, AWB, the Discord bot) call `/w/api.php` as they would MediaWiki's; writes land in
 * Postgres through the same services the editor uses. This handler only reads the HTTP request and
 * writes the response: parameters, cookies and the caller's identity in, JSON and cookies out. The
 * work is `handleApiRequest` (src/lib/wiki-os/api-compat/dispatch.ts). A route handler has no layout,
 * so nothing of the IxStates shell wraps it.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";
import {
  LOGIN_NONCE_COOKIE,
  SESSION_COOKIE,
  readCookie,
  serializeCookie,
} from "~/lib/wiki-os/api-compat/auth";
import { createApiDeps } from "~/lib/wiki-os/api-compat/deps";
import { handleApiRequest, type ApiRequestInput } from "~/lib/wiki-os/api-compat/dispatch";
import { API_DOCREF } from "~/lib/wiki-os/api-compat/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The largest request body api.php reads: MediaWiki's 2 MB page limit plus the form's other fields. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const deps = createApiDeps();

const jsonHeaders = (errorCode: string | null): Record<string, string> => ({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
  ...(errorCode ? { "MediaWiki-API-Error": errorCode } : {}),
});

/** Text fields of a POST body; a file part is ignored (uploads are plan 411's). */
async function readBody(req: NextRequest): Promise<Array<readonly [string, string]> | null> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    return [...form.entries()].flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value] as const] : []
    );
  }
  return [...new URLSearchParams(await req.text()).entries()];
}

/** The path api.php's cookies are scoped to: the directory the script lives in (`/w/`). */
function cookiePathOf(req: NextRequest): string {
  const { pathname } = new URL(req.url);
  return pathname.slice(0, pathname.lastIndexOf("/") + 1) || "/";
}

async function webAuthId(): Promise<string | null> {
  try {
    return (await auth()).userId ?? null;
  } catch {
    return null;
  }
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const method = req.method === "POST" ? "POST" : "GET";
  if (method === "POST" && Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: { code: "toobig", info: "The request body is too large.", "*": API_DOCREF } },
      { headers: jsonHeaders("toobig") }
    );
  }

  const clientKey = resolveRateLimitIdentifier(req.headers, null);
  const cookieHeader = req.headers.get("cookie");
  const input: ApiRequestInput = {
    method,
    query: req.nextUrl.searchParams,
    body: method === "POST" ? await readBody(req) : null,
    sessionCookie: readCookie(cookieHeader, SESSION_COOKIE),
    loginNonceCookie: readCookie(cookieHeader, LOGIN_NONCE_COOKIE),
    // A signed-in browser user may read through api.php; only a bot-password session writes.
    webAuthId: method === "GET" ? await webAuthId() : null,
    clientKey,
    anonymousName: clientKey.startsWith("ip:") ? clientKey.slice(3) : "anonymous",
    cookiePath: cookiePathOf(req),
  };

  const output = await handleApiRequest(input, deps);
  const response = NextResponse.json(output.body, { headers: jsonHeaders(output.errorCode) });
  for (const cookie of output.setCookies) response.headers.append("Set-Cookie", serializeCookie(cookie));
  return response;
}

export const GET = handle;
export const POST = handle;
