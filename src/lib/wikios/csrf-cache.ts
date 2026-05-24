/**
 * csrf-cache.ts — Caches MediaWiki CSRF tokens and manages cookie session authentication.
 *
 * Enforces session/cookie forwarding to attribute edits to the actual logged-in user.
 * Manages cached bot session tokens as a fallback for development.
 */

import { env } from "~/env";
import { TRPCError } from "@trpc/server";
import { isSystemOwner } from "~/lib/system-owner-constants";

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
        const idx = merged.findIndex(c => c.startsWith(name));
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
 * Performs login using the system bot password to retrieve a cached bot session and token.
 */
export async function getBotSessionAndToken(): Promise<{ cookies: string[]; csrfToken: string }> {
  if (cachedBotToken && cachedBotCookies.length > 0 && Date.now() - cachedBotAt < TOKEN_TTL_MS) {
    return { cookies: cachedBotCookies, csrfToken: cachedBotToken };
  }

  const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
  const botToken = process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
  const botUser = env.WIKIOS_MEDIAWIKI_BOT_USER;

  if (!botToken) throw new Error("WIKIOS_MEDIAWIKI_BOT_TOKEN is not configured");

  let cookies: string[] = [];

  const updateCookies = (res: Response) => {
    const newCookies = res.headers.getSetCookie();
    if (newCookies && newCookies.length > 0) {
      cookies = mergeCookies(cookies, newCookies);
    }
  };

  // 1. Get login token
  const tokenRes = await fetch(`${apiBase}?action=query&meta=tokens&type=login&format=json`);
  updateCookies(tokenRes);
  const tokenData = (await tokenRes.json()) as any;
  const logintoken = tokenData.query?.tokens?.logintoken;
  if (!logintoken) throw new Error("Failed to get login token from MediaWiki");

  // 2. Login with bot password
  const loginRes = await fetch(apiBase, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies.join("; "),
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
  const loginData = (await loginRes.json()) as any;
  if (loginData.login?.result !== "Success") {
    throw new Error(`MediaWiki bot login failed: ${loginData.login?.reason || "unknown reason"}`);
  }

  // 3. Get CSRF token
  const csrfRes = await fetch(`${apiBase}?action=query&meta=tokens&type=csrf&format=json`, {
    headers: {
      Cookie: cookies.join("; "),
    },
  });
  updateCookies(csrfRes);
  const csrfData = (await csrfRes.json()) as any;
  const csrfToken = csrfData.query?.tokens?.csrftoken;
  if (!csrfToken || csrfToken === "+\\") {
    throw new Error("Failed to get authenticated CSRF token for bot");
  }

  cachedBotToken = csrfToken;
  cachedBotCookies = cookies;
  cachedBotAt = Date.now();

  return { cookies, csrfToken };
}

/**
 * Resolves session cookies and CSRF token for the authenticated user context.
 * Forwards cookies to ensure the action is performed by the actual logged-in user.
 */
export async function getUserSessionAndToken(ctx: {
  user: any;
  auth: { userId: string | null };
  headers: Headers;
}): Promise<{ cookies: string[]; csrfToken: string }> {
  const wikiUsername = ctx.user?.wikiUsername;
  if (!wikiUsername) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "You must link your MediaWiki account via IxnayID before editing.",
    });
  }

  const cookieHeader = ctx.headers.get("cookie") || "";
  
  // Dev & System Owner fallback to bot session if no MediaWiki session cookies are passed
  const isDev = env.NODE_ENV === "development";
  const isOwner = ctx.auth?.userId && isSystemOwner(ctx.auth.userId);
  const hasMWCookie = cookieHeader.includes("session") || cookieHeader.includes("UserID") || cookieHeader.includes("UserName");

  if (isDev && isOwner && !hasMWCookie) {
    console.log(`[WikiOS] Dev owner fallback to bot password session for Heku@WikiOS...`);
    try {
      return await getBotSessionAndToken();
    } catch (err) {
      console.error("[WikiOS] Dev owner fallback login failed:", err);
      // Fall through to standard check
    }
  }

  if (!cookieHeader) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "MediaWiki session cookies not found. Please log in to IxWiki.",
    });
  }

  const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
  
  try {
    // Fetch user's own CSRF token using their forwarded cookies
    const res = await fetch(`${apiBase}?action=query&meta=tokens&type=csrf&format=json`, {
      headers: { Cookie: cookieHeader },
    });
    const data = (await res.json()) as any;
    const csrfToken = data.query?.tokens?.csrftoken;
    
    // MediaWiki returns "+\\" for anonymous or unauthenticated sessions
    if (!csrfToken || csrfToken === "+\\") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Your MediaWiki session is invalid or has expired. Please log in to IxWiki.",
      });
    }

    // Split cookies into array of individual cookies to match the expected format
    const cookies = cookieHeader.split(";").map(c => c.trim()).filter(Boolean);
    return { cookies, csrfToken };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to authenticate with MediaWiki: ${(error as Error).message}`,
    });
  }
}

/**
 * Backwards compatibility helper to get a bot CSRF token.
 */
export async function getCsrfToken(): Promise<string> {
  const session = await getBotSessionAndToken();
  return session.csrfToken;
}

/**
 * Invalidates the cached bot session token.
 */
export function invalidateCsrfToken(): void {
  cachedBotToken = null;
  cachedBotCookies = [];
  cachedBotAt = 0;
}
