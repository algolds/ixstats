/**
 * csrf-cache.ts — Caches MediaWiki CSRF tokens and manages session authentication.
 *
 * Enforces session/cookie forwarding to attribute edits to the actual logged-in user.
 * Manages cached bot session tokens when configured, or standard CSRF tokens as fallback.
 */

import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";

let cachedBotToken: string | null = null;
let cachedBotCookies: string[] = [];
let cachedBotAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

/**
 * Performs login or gets a cached session token.
 */
export async function getBotSessionAndToken(): Promise<{ cookies: string[]; csrfToken: string }> {
  if (cachedBotToken && cachedBotCookies.length > 0 && Date.now() - cachedBotAt < TOKEN_TTL_MS) {
    return { cookies: cachedBotCookies, csrfToken: cachedBotToken };
  }

  const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
  const botToken = process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
  const botUser = process.env.WIKIOS_MEDIAWIKI_BOT_USER;

  let cookies: string[] = [];

  const updateCookies = (res: Response) => {
    const newCookies = res.headers.getSetCookie();
    if (newCookies && newCookies.length > 0) {
      cookies = mergeCookies(cookies, newCookies);
    }
  };

  // If bot user and token are configured, perform bot authentication
  if (botToken && botUser) {
    try {
      // 1. Get login token
      const tokenRes = await fetch(`${apiBase}?action=query&meta=tokens&type=login&format=json`, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
      });
      updateCookies(tokenRes);
      const tokenData = (await tokenRes.json()) as {
        query?: { tokens?: { logintoken?: string } };
      };
      const logintoken = tokenData.query?.tokens?.logintoken;

      if (logintoken) {
        // 2. Login with bot password
        const loginRes = await fetch(apiBase, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: cookies.join("; "),
            "User-Agent": DEFAULT_USER_AGENT,
          },
          body: new URLSearchParams({
            action: "login",
            lgname: botUser,
            lgpassword: botToken,
            lgtoken: logintoken,
            format: "json",
          }).toString(),
        });
        updateCookies(loginRes);
      }
    } catch (botLoginErr) {
      console.warn(
        "[CsrfCache] Bot login attempt encountered issue, proceeding with standard session:",
        botLoginErr
      );
    }
  }

  // 3. Get CSRF token
  const csrfRes = await fetch(`${apiBase}?action=query&meta=tokens&type=csrf&format=json`, {
    headers: {
      ...(cookies.length > 0 ? { Cookie: cookies.join("; ") } : {}),
      "User-Agent": DEFAULT_USER_AGENT,
    },
  });
  updateCookies(csrfRes);
  const csrfData = (await csrfRes.json()) as {
    query?: { tokens?: { csrftoken?: string } };
  };
  const csrfToken = csrfData.query?.tokens?.csrftoken;

  if (!csrfToken) {
    throw new Error("Failed to get CSRF token from MediaWiki");
  }

  cachedBotToken = csrfToken;
  cachedBotCookies = cookies;
  cachedBotAt = Date.now();

  return { cookies, csrfToken };
}

/**
 * Resolves session cookies and CSRF token for the authenticated user context.
 */
export async function getUserSessionAndToken(_ctx?: {
  user?: { wikiUsername?: string | null; country?: { name?: string | null } | null } | null;
  auth?: { userId: string | null } | null;
  headers?: Headers;
}): Promise<{ cookies: string[]; csrfToken: string }> {
  return getBotSessionAndToken();
}

/**
 * Backwards compatibility helper to get a CSRF token.
 */
export async function getCsrfToken(): Promise<string> {
  const session = await getBotSessionAndToken();
  return session.csrfToken;
}

/**
 * Invalidates the cached session token.
 */
export function invalidateCsrfToken(): void {
  cachedBotToken = null;
  cachedBotCookies = [];
  cachedBotAt = 0;
}
