/**
 * Which paths the proxy sends to sign-in and which it lets through. These only steer navigation: the data behind
 * them is guarded where it is read (protectedProcedure / adminProcedure, page and layout checks), as Clerk asks now
 * that `createRouteMatcher` is deprecated. Case-insensitive, like the path-to-regexp patterns they replace.
 */

const PROTECTED = [
  /^\/(admin|settings|builder|mycountry|dashboard|vault|messages|myclub|myleague|stashes|setup|thinktanks)/i,
  /^\/util\/lorewards/i,
  /^\/blurbs\/(submit|mine)/i,
];

const PUBLIC = [
  /^\/$/,
  /^\/(sign-in|sign-up|id|@|api)/i,
  /^\/r\//i,
  /^\/(countries|thinkpages|maps|exchange)(\/.*)?$/i,
  // Feed posts and persona profiles are public (ThinkPages phase 5 moved them under /dashboard).
  /^\/dashboard\/(post|profile)\//i,
  /^\/ixeconomy\.xlsx\/?$/i,
];

/** A path the proxy sends to sign-in when no one is signed in. */
export const isProtectedPath = (pathname: string): boolean =>
  PROTECTED.some((re) => re.test(pathname));

/** A path anyone may open, before the protected check. */
export const isPublicPath = (pathname: string): boolean => PUBLIC.some((re) => re.test(pathname));
