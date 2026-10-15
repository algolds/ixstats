/**
 * Which clock a page goes by (realm clocks spec §4): inside a realm, that realm's (by slug, a country's realm, or the
 * viewer's active nation's realm); outside realms, real time. From the path alone, so the server render and the
 * hydrating pass agree.
 */
export type ClockContext =
  { kind: "real" } | { kind: "realm"; realm?: string; country?: string; active?: true };

const ACTIVE: ClockContext = { kind: "realm", active: true };

/**
 * The app's top-level routes on the maps host (maps.ixwiki.com): next.config.js rewrites every other root-level slug
 * to that country's page. Kept equal to the rewrite by a test.
 */
export const STANDALONE_APP_ROUTES = [
  "achievements",
  "admin",
  "api",
  "blurbs",
  "builder",
  "countries",
  "dashboard",
  "data",
  "dm-dashboard",
  "explore",
  "favicon.ico",
  "feed",
  "flags",
  "fonts",
  "forum",
  "hashtags",
  "health",
  "help",
  "images",
  "leaderboards",
  "maps",
  "messages",
  "myclub",
  "mycountry",
  "myleague",
  "placeholder",
  "profile",
  "settings",
  "setup",
  "sign-in",
  "sign-up",
  "sounds",
  "stashes",
  "studio",
  "thinkpages",
  "vault",
  "w",
  "wiki",
  "_next",
] as const;
const APP_ROUTES: ReadonlySet<string> = new Set(STANDALONE_APP_ROUTES);

export function clockContextForPath(
  pathname: string,
  realmParam: string | null,
  /** On the maps host, a root-level slug is a country page. */
  standalone = false
): ClockContext {
  const [first, second, third] = pathname.split("/").filter(Boolean);
  if (first === "r" && second) return { kind: "realm", realm: second };
  if (first === "thinkpages" && second === "r" && third)
    return third === "mine" ? ACTIVE : { kind: "realm", realm: third };
  if (first === "countries") return second ? { kind: "realm", country: second } : ACTIVE;
  if (first === "mycountry" || first === "builder") return ACTIVE;
  // Without ?realm= the map shows the viewer's active realm (global IxTime for viewers without a nation).
  if (first === "maps") return realmParam ? { kind: "realm", realm: realmParam } : ACTIVE;
  if (standalone && first && !second && !APP_ROUTES.has(first))
    return { kind: "realm", country: first };
  return { kind: "real" };
}
