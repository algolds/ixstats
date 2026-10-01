/**
 * csrf-cache.ts — the WikiOS mirror's MediaWiki session: bot login and a cached CSRF token.
 *
 * Every write WikiOS makes to classic MediaWiki goes out as the dedicated mirror account (a bot password).
 * A login that does not succeed is an error, never an anonymous session: a write with no login would land
 * as an IP edit, which the inbound sync cannot tell from a human's.
 */

import { z } from "zod";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

let cachedBotToken: string | null = null;
let cachedBotCookies: string[] = [];
let cachedBotAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REQUEST_TIMEOUT_MS = 20_000;
/** The CSRF token MediaWiki hands a session that is not logged in. */
const ANONYMOUS_CSRF_TOKEN = "+\\";

const PRODUCTION_API = "https://ixwiki.com/api.php";

/** The api.php WikiOS writes to. */
export function mediaWikiApiUrl(): string {
  return process.env.WIKIOS_MEDIAWIKI_API ?? PRODUCTION_API;
}

/** The MediaWiki account the mirror edits as: the bot-password login without its "@appname". */
export function mirrorBotName(): string | null {
  const login = process.env.WIKIOS_MEDIAWIKI_BOT_USER?.split("@")[0]?.trim();
  return login ? normalizeWikiUsername(login) : null;
}

const loginTokenSchema = z.object({
  query: z.object({ tokens: z.object({ logintoken: z.string() }) }),
});
const loginResultSchema = z.object({
  login: z.object({ result: z.string(), reason: z.string().optional() }),
});
const csrfTokenSchema = z.object({
  query: z.object({ tokens: z.object({ csrftoken: z.string() }) }),
});

/**
 * Merges new set-cookie headers into the existing cookies array.
 */
function mergeCookies(current: string[], newHeaders: string[]): string[] {
  const merged = [...current];
  for (const cookie of newHeaders) {
    const cleanCookie = cookie.split(";")[0];
    if (cleanCookie) {
      const eqIdx = cleanCookie.indexOf("=");
      if (eqIdx !== -1) {
        const name = cleanCookie.substring(0, eqIdx + 1);
        const idx = merged.findIndex((c) => c.startsWith(name));
        if (idx !== -1) {
          merged[idx] = cleanCookie;
        } else {
          merged.push(cleanCookie);
        }
      }
    }
  }
  return merged;
}

const BODY_EXCERPT_LENGTH = 200;

/**
 * The JSON body of an api.php answer. An answer that is not JSON (an nginx 413 page, a PHP fatal, a proxy's HTML) says
 * what it was: its HTTP status and the start of its body, not an opaque parse error. A body that is not ok but is
 * JSON is still an error: `what` names the call.
 */
export async function readApiBody(res: Response, what: string): Promise<unknown> {
  const text = await res.text();
  const excerpt = text.slice(0, BODY_EXCERPT_LENGTH).replace(/\s+/g, " ").trim();
  if (!res.ok) throw new Error(`MediaWiki ${what} failed (HTTP ${res.status}): ${excerpt}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `MediaWiki ${what} answered with something that is not JSON (HTTP ${res.status}): ${excerpt}`
    );
  }
}

/** One request of the login conversation: a GET, or a form POST with `formBody`. Its cookies join `cookies`. */
async function loginStep<T>(
  cookies: string[],
  url: string,
  schema: z.ZodType<T>,
  formBody?: string
): Promise<{ data: T; cookies: string[] }> {
  const res = await fetch(url, {
    ...(formBody === undefined ? {} : { method: "POST", body: formBody }),
    headers: {
      ...(formBody === undefined ? {} : { "Content-Type": "application/x-www-form-urlencoded" }),
      ...(cookies.length > 0 ? { Cookie: cookies.join("; ") } : {}),
      "User-Agent": DEFAULT_USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await readApiBody(res, "login");
  const merged = mergeCookies(cookies, res.headers.getSetCookie());
  return { data: schema.parse(body), cookies: merged };
}

/** Log in as the mirror account (action=login with a bot password); throws unless MediaWiki says Success. */
async function loginAsMirrorBot(
  apiBase: string,
  botUser: string,
  botToken: string
): Promise<string[]> {
  const tokenStep = await loginStep(
    [],
    `${apiBase}?action=query&meta=tokens&type=login&format=json`,
    loginTokenSchema
  );
  const login = await loginStep(
    tokenStep.cookies,
    apiBase,
    loginResultSchema,
    new URLSearchParams({
      action: "login",
      lgname: botUser,
      lgpassword: botToken,
      lgtoken: tokenStep.data.query.tokens.logintoken,
      format: "json",
    }).toString()
  );
  const { result, reason } = login.data.login;
  if (result !== "Success") {
    throw new Error(`MediaWiki bot login failed: ${result}${reason ? ` (${reason})` : ""}`);
  }
  return login.cookies;
}

/**
 * The mirror's logged-in session and CSRF token, cached for ten minutes. Throws when the bot credentials
 * are missing, when the login is refused, or when the token MediaWiki hands out is the anonymous one.
 */
export async function getBotSessionAndToken(): Promise<{ cookies: string[]; csrfToken: string }> {
  if (cachedBotToken && cachedBotCookies.length > 0 && Date.now() - cachedBotAt < TOKEN_TTL_MS) {
    return { cookies: cachedBotCookies, csrfToken: cachedBotToken };
  }

  const apiBase = mediaWikiApiUrl();
  const botToken = process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
  const botUser = process.env.WIKIOS_MEDIAWIKI_BOT_USER;
  if (!botUser || !botToken) {
    throw new Error(
      "WIKIOS_MEDIAWIKI_BOT_USER and WIKIOS_MEDIAWIKI_BOT_TOKEN are not set: the mirror has no MediaWiki account to write as"
    );
  }

  const cookies = await loginAsMirrorBot(apiBase, botUser, botToken);
  const csrf = await loginStep(
    cookies,
    `${apiBase}?action=query&meta=tokens&type=csrf&format=json`,
    csrfTokenSchema
  );
  const csrfToken = csrf.data.query.tokens.csrftoken;
  if (csrfToken === ANONYMOUS_CSRF_TOKEN) {
    throw new Error("MediaWiki bot login failed: the session is not logged in");
  }

  cachedBotToken = csrfToken;
  cachedBotCookies = csrf.cookies;
  cachedBotAt = Date.now();

  return { cookies: csrf.cookies, csrfToken };
}

/**
 * Invalidates the cached session token.
 */
export function invalidateCsrfToken(): void {
  cachedBotToken = null;
  cachedBotCookies = [];
  cachedBotAt = 0;
}
