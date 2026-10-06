/**
 * src/app/w/api.php/route.ts — WikiOS's MediaWiki-compatible `api.php` (plan 410).
 *
 * Bots (Pywikibot, AWB, the Discord bot) call `/w/api.php` as they would MediaWiki's; writes land in
 * Postgres through the same services the editor uses. This handler only reads the HTTP request and
 * writes the response: parameters, cookies and the caller's identity in, JSON and cookies out. The
 * work is `handleApiRequest` (src/lib/wiki-os/api-compat/dispatch.ts). A route handler has no layout,
 * so nothing of the IxStates shell wraps it.
 */

import { MIMEType } from "node:util";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";
import {
  LOGIN_NONCE_COOKIE,
  SESSION_COOKIE,
  readCookie,
  readSessionCookie,
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
 * other fields. Only a request whose session cookie this server signed may send that much (the signature is a cheap
 * HMAC check; the session itself is looked up after the body is read): anyone else keeps the small limit. It stays under Next's
 * `experimental.proxyClientMaxBodySize` (10 MiB by default), which truncates a cloned body past that size.
 */
const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
/**
 * Parts a multipart body may have. A form needs the action's fields and a file part (api.php takes under 30 parameters);
 * the platform's `formData()` costs seconds and hundreds of MB on 10 MB of tiny parts, so they are counted, natively, before it runs.
 */
const MAX_MULTIPART_PARTS = 64;

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

/** Thrown for a multipart request api.php will not read: its message says why (the answer's `info`). */
class BadMultipart extends Error {}

/** The longest boundary RFC 2046 allows. */
const MAX_BOUNDARY_LENGTH = 70;

/**
 * The multipart boundary, read the way the platform's parser reads it (a quoted parameter holding `;boundary=` is not
 * one). Throws `BadMultipart` when there is none or it is longer than RFC 2046 allows: the part count below searches for
 * it, and a boundary of 8 KB (what nginx lets through in a header) would make that search cost seconds.
 */
function multipartBoundary(contentType: string): string {
  let boundary: string | null = null;
  try {
    boundary = new MIMEType(contentType).params.get("boundary");
  } catch {
    // not a MIME type: no boundary
  }
  if (!boundary || boundary.length > MAX_BOUNDARY_LENGTH) {
    throw new BadMultipart(
      `A multipart request needs a boundary of at most ${MAX_BOUNDARY_LENGTH} characters.`
    );
  }
  return boundary;
}

/** Whether `bytes` has more than `MAX_MULTIPART_PARTS` parts: occurrences of its boundary line, counted without parsing the body. */
function hasTooManyParts(bytes: Uint8Array, boundary: string): boolean {
  const body = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const marker = Buffer.from(`--${boundary}`);
  // one boundary line per part, and one more closes the body
  let lines = 0;
  for (let at = body.indexOf(marker); at !== -1; at = body.indexOf(marker, at + marker.length)) {
    if (++lines > MAX_MULTIPART_PARTS + 1) return true;
  }
  return false;
}

/** The fields of a POST body, and the file parts of a multipart one (`action=upload`'s `file`). */
interface RequestBody {
  fields: Array<readonly [string, string]>;
  files: Map<string, RequestFile>;
}

/** Whether the cookie is a session this server signed (it may still be expired: the lookup comes later). Without a signing key, none is. */
function hasSignedSession(cookie: string | undefined): boolean {
  try {
    return readSessionCookie(cookie) !== null;
  } catch {
    return false;
  }
}

async function readBody(req: NextRequest, hasSession: boolean): Promise<RequestBody> {
  const type = req.headers.get("content-type") ?? "";
  const multipart = type.includes("multipart/form-data");
  // before the body is read, and before anything is searched for in it
  const boundary = multipart ? multipartBoundary(type) : null;
  const bytes = await readBodyBytes(
    req,
    multipart && hasSession ? MAX_UPLOAD_BODY_BYTES : MAX_BODY_BYTES
  );
  if (boundary === null) {
    return {
      fields: [...new URLSearchParams(new TextDecoder().decode(bytes)).entries()],
      files: new Map(),
    };
  }
  if (hasTooManyParts(bytes, boundary)) {
    throw new BadMultipart(`A multipart request may have at most ${MAX_MULTIPART_PARTS} parts.`);
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
    body = method === "POST" ? await readBody(req, hasSignedSession(sessionCookie)) : null;
  } catch (error) {
    if (error instanceof BodyTooLarge) return tooBig();
    // A multipart request api.php refuses, or a body the parser cannot read.
    const info =
      error instanceof BadMultipart ? error.message : "The request body could not be read.";
    return NextResponse.json(
      { error: { code: "badrequest", info, "*": API_DOCREF } },
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
