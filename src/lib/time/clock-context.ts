import { IXNAY_SLUG } from "~/lib/realms/realm-ids";

/**
 * Which clock a page goes by (realm clocks spec §4): inside a realm, that realm's (by slug, a country's realm, or the
 * viewer's active nation's realm); outside realms, real time. From the path alone, so the server render and the
 * hydrating pass agree.
 */
export type ClockContext =
  { kind: "real" } | { kind: "realm"; realm?: string; country?: string; active?: true };

const ACTIVE: ClockContext = { kind: "realm", active: true };

export function clockContextForPath(pathname: string, realmParam: string | null): ClockContext {
  const [first, second, third] = pathname.split("/").filter(Boolean);
  if (first === "r" && second) return { kind: "realm", realm: second };
  if (first === "thinkpages" && second === "r" && third)
    return third === "mine" ? ACTIVE : { kind: "realm", realm: third };
  if (first === "countries") return second ? { kind: "realm", country: second } : ACTIVE;
  if (first === "mycountry" || first === "builder") return ACTIVE;
  if (first === "maps") return { kind: "realm", realm: realmParam ?? IXNAY_SLUG };
  return { kind: "real" };
}
