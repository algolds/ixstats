/**
 * csrf-cache.ts — Caches MediaWiki CSRF tokens to reduce API calls.
 *
 * MediaWiki CSRF tokens are valid for 24 hours. We cache them for 10 minutes
 * and retry with a fresh token on "badtoken" errors.
 */

let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get a CSRF token, using cache if available.
 */
export async function getCsrfToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
  const botToken = process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
  if (!botToken) throw new Error("WIKIOS_MEDIAWIKI_BOT_TOKEN is not configured");

  const res = await fetch(`${apiBase}?action=query&meta=tokens&format=json`, {
    headers: { Authorization: `Bearer ${botToken}` },
  });
  const data = (await res.json()) as {
    query?: { tokens?: { csrftoken?: string } };
  };

  const token = data.query?.tokens?.csrftoken;
  if (!token) throw new Error("Failed to obtain CSRF token from MediaWiki");

  cachedToken = token;
  cachedAt = Date.now();
  return token;
}

/**
 * Invalidate the cached token (e.g., after a "badtoken" error).
 */
export function invalidateCsrfToken(): void {
  cachedToken = null;
  cachedAt = 0;
}
