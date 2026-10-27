// src/lib/wiki-os/chrome-prefs.ts
// What the wiki's chrome needs to know before it paints, so the server can render it as the reader
// last left it: the rail's and the companion's collapsed state (kept in cookies, since a server
// cannot read localStorage) and whether this browser probably carries a signed-in session (so the
// rail can hold the profile's place while the auth provider loads). A preference with no cookie is
// null: the client falls back to its localStorage copy after mount, as it always did.

export const SIDEBAR_COLLAPSED_COOKIE = "wikios_sidebar_collapsed";
export const COMPANION_COLLAPSED_COOKIE = "wikios_companion_collapsed";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export interface WikiChromePrefs {
  /** The rail is collapsed to icons; null: never chosen (the rail's default applies). */
  sidebarCollapsed: boolean | null;
  /** The article's right-hand companion is collapsed; null: never chosen. */
  companionCollapsed: boolean | null;
  /** A Clerk session cookie is present: the viewer is probably signed in. */
  mayBeSignedIn: boolean;
}

export const DEFAULT_CHROME_PREFS: WikiChromePrefs = {
  sidebarCollapsed: null,
  companionCollapsed: null,
  mayBeSignedIn: false,
};

export interface CookieEntry {
  name: string;
  value: string;
}

const flagOf = (value: string | undefined): boolean | null =>
  value === "1" ? true : value === "0" ? false : null;

/**
 * Whether the cookies carry a Clerk session: the `__session` token, or `__client_uat` (set by Clerk's
 * browser script, "0" when signed out) with a time in it. Both exist under a suffix when several
 * Clerk apps share a domain.
 */
export function hasClerkSessionCookie(cookies: readonly CookieEntry[]): boolean {
  return cookies.some(({ name, value }) => {
    if (name === "__session" || name.startsWith("__session_")) return value !== "";
    if (name === "__client_uat" || name.startsWith("__client_uat_")) {
      return value !== "" && value !== "0";
    }
    return false;
  });
}

export function parseChromePrefs(cookies: readonly CookieEntry[]): WikiChromePrefs {
  const value = (name: string) => cookies.find((cookie) => cookie.name === name)?.value;
  return {
    sidebarCollapsed: flagOf(value(SIDEBAR_COLLAPSED_COOKIE)),
    companionCollapsed: flagOf(value(COMPANION_COLLAPSED_COOKIE)),
    mayBeSignedIn: hasClerkSessionCookie(cookies),
  };
}

/** Remember a collapsed state for the server's next render of the wiki chrome (browser only). */
export function writeCollapsedCookie(name: string, collapsed: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${collapsed ? "1" : "0"}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
