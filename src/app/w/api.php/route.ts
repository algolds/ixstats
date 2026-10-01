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
import type { RequestFile } from "~/lib/wiki-os/api-compat/types";
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";
import { API_DOCREF } from "~/lib/wiki-os/api-compat/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The largest request body api.php reads: MediaWiki's 2 MB page limit plus the form's other fields. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;
/**
 * The largest body of an upload (`action=upload`: a multipart POST with the file): the upload limit plus the form's
 * other fields. Only a request that carries a session cookie may send that much (the session is checked before
 * anything is written, but the body is read first): an anonymous caller keeps the small limit. It stays under Next's
 * `experimental.proxyClientMaxBodySize` (10 MiB by default), which truncates a cloned body past that size.
 */
const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const deps = createApiDeps();

const jsonHeaders = (errorCode: string | null): Record<string, string> => ({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
  ...(errorCode ? { "MediaWiki-API-Error": errorCode } : {}),
});

/** Thrown when a body is larger than api.php reads. */
class BodyTooLarge extends Error {}

/**
 * The request body, read while counting bytes: past `maxBytes` the stream is cancelled and the
 * request refused, whatever the Content-Length header claims (or does not: a chunked body has none).
 */
async function readBodyBytes(req: NextRequest, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) throw new BodyTooLarge();
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** The fields of a POST body, and the file parts of a multipart one (`action=upload`'s `file`). */
interface RequestBody {
  fields: Array<readonly [string, string]>;
  files: Map<string, RequestFile>;
}

async function readBody(req: NextRequest, hasSession: boolean): Promise<RequestBody> {
  const type = req.headers.get("content-type") ?? "";
  const multipart = type.includes("multipart/form-data");
  const bytes = await readBodyBytes(
    req,
    multipart && hasSession ? MAX_UPLOAD_BODY_BYTES : MAX_BODY_BYTES
  );
  if (!multipart) {
    return {
      fields: [...new URLSearchParams(new TextDecoder().decode(bytes)).entries()],
      files: new Map(),
    };
  }
  // The bytes are already bounded; the platform's multipart parser reads them from memory.
  const form = await new Response(bytes, { headers: { "content-type": type } }).formData();
  const body: RequestBody = { fields: [], files: new Map() };
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      body.fields.push([key, value]);
    } else {
      body.files.set(key, {
        filename: value.name,
        contentType: value.type,
        bytes: new Uint8Array(await value.arrayBuffer()),
      });
    }
  }
  return body;
}

const tooBig = () =>
  NextResponse.json(
    { error: { code: "toobig", info: "The request body is too large.", "*": API_DOCREF } },
    { status: 413, headers: jsonHeaders("toobig") }
  );

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

  const clientKey = resolveRateLimitIdentifier(req.headers, null);
  const cookieHeader = req.headers.get("cookie");
  const sessionCookie = readCookie(cookieHeader, SESSION_COOKIE);
  let body: RequestBody | null = null;
  try {
    body = method === "POST" ? await readBody(req, sessionCookie !== undefined) : null;
  } catch (error) {
    if (error instanceof BodyTooLarge) return tooBig();
    // A multipart body the parser cannot read.
    return NextResponse.json(
      { error: { code: "badrequest", info: "The request body could not be read.", "*": API_DOCREF } },
      { status: 400, headers: jsonHeaders("badrequest") }
    );
  }
  const input: ApiRequestInput = {
    method,
    query: req.nextUrl.searchParams,
    body: body?.fields ?? null,
    files: body?.files,
    sessionCookie,
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
