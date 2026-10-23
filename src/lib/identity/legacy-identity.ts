/**
 * The legacy IxWiki identity data (IxWiki `WikiAccountLink` rows, `User.wikiUsername`, the wiki attribution switch) as
 * one read-only snapshot, and the counts the owner reads on production before the IxnayID identity work (design: order,
 * step 1). Pure: `scripts/identity/legacy-snapshot.ts` loads the snapshot.
 */
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

/** One IxWiki `WikiAccountLink` row, with its user's Clerk id. */
export interface LegacyLinkRow {
  userId: string;
  clerkUserId: string;
  username: string;
  verifiedAt: Date | null;
  verifiedById: string | null;
  wikiUserId: number | null;
}

/** One user whose legacy `User.wikiUsername` is set. */
export interface LegacyUserRow {
  userId: string;
  clerkUserId: string;
  wikiUsername: string | null;
}

/** One `wiki_name_claims` row (none until the claims table exists). */
export interface ExistingClaimRow {
  userId: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
}

export interface LegacySnapshot {
  /** IxWiki `WikiAccountLink` rows only. */
  links: LegacyLinkRow[];
  /** Users whose `wikiUsername` is not null. */
  users: LegacyUserRow[];
  /** Clerk ids whose privacy config has `showWikiAttribution === false`. */
  hiddenClerkIds: ReadonlySet<string>;
  /** `User.id` of every `SYSTEM_OWNER_IDS` Clerk id. */
  systemOwnerUserIds: ReadonlySet<string>;
  /** `[]` until the claims table exists. */
  existingClaims: ExistingClaimRow[];
}

export interface LegacyIdentityCounts {
  usersWithLegacyName: number;
  links: {
    verifiedByToken: number;
    verifiedByAdmin: number;
    verifiedBySystemOwner: number;
    unverified: number;
  };
  /** The normalised `wikiUsername` equals the user's own IxWiki link name. */
  legacyNameMatchesOwnLink: number;
  /** The user has both, and they differ. */
  legacyNameDiffers: number;
  /** Normalised names held (link or legacy name) by two or more users, sorted. */
  contestedNames: string[];
  /** Users in `hiddenClerkIds` holding a link or a legacy name. */
  hiddenUsersWithNames: number;
}

/** A user who holds a wiki name, by link or legacy column. */
interface NameHolding {
  userId: string;
  clerkUserId: string;
  name: string;
}

type LinkCounts = LegacyIdentityCounts["links"];

/** Who verified a link: its own token (no verifier), a system owner, another admin, or nobody yet. */
function linkVerifier(
  link: LegacyLinkRow,
  systemOwnerUserIds: ReadonlySet<string>
): keyof LinkCounts {
  if (link.verifiedAt === null) return "unverified";
  if (link.verifiedById === null) return "verifiedByToken";
  return systemOwnerUserIds.has(link.verifiedById) ? "verifiedBySystemOwner" : "verifiedByAdmin";
}

function countLinks(links: LegacyLinkRow[], systemOwnerUserIds: ReadonlySet<string>): LinkCounts {
  const counts: LinkCounts = {
    verifiedByToken: 0,
    verifiedByAdmin: 0,
    verifiedBySystemOwner: 0,
    unverified: 0,
  };
  for (const link of links) counts[linkVerifier(link, systemOwnerUserIds)] += 1;
  return counts;
}

/** Every non-empty normalised name a user holds, from the links and the legacy column. */
function nameHoldings(snapshot: LegacySnapshot): NameHolding[] {
  const fromLinks = snapshot.links.map((l) => ({
    userId: l.userId,
    clerkUserId: l.clerkUserId,
    raw: l.username,
  }));
  const fromUsers = snapshot.users.map((u) => ({
    userId: u.userId,
    clerkUserId: u.clerkUserId,
    raw: u.wikiUsername,
  }));
  return [...fromLinks, ...fromUsers].flatMap(({ userId, clerkUserId, raw }) => {
    const name = raw ? normalizeWikiUsername(raw) : "";
    return name ? [{ userId, clerkUserId, name }] : [];
  });
}

/** Every normalised name held by an IxWiki link or a legacy `wikiUsername`. */
export function heldLegacyNames(snapshot: LegacySnapshot): ReadonlySet<string> {
  return new Set(nameHoldings(snapshot).map((h) => h.name));
}

function contestedNames(holdings: NameHolding[]): string[] {
  const holders = new Map<string, Set<string>>();
  for (const { name, userId } of holdings)
    holders.set(name, (holders.get(name) ?? new Set()).add(userId));
  return [...holders]
    .filter(([, users]) => users.size > 1)
    .map(([name]) => name)
    .sort();
}

function compareLegacyWithLinks(snapshot: LegacySnapshot): { matches: number; differs: number } {
  const linkNames = new Map(
    snapshot.links.map((l) => [l.userId, normalizeWikiUsername(l.username)])
  );
  let matches = 0;
  let differs = 0;
  for (const user of snapshot.users) {
    const linkName = linkNames.get(user.userId);
    if (!user.wikiUsername || linkName === undefined) continue;
    if (normalizeWikiUsername(user.wikiUsername) === linkName) matches += 1;
    else differs += 1;
  }
  return { matches, differs };
}

export function countLegacyIdentity(snapshot: LegacySnapshot): LegacyIdentityCounts {
  const holdings = nameHoldings(snapshot);
  const { matches, differs } = compareLegacyWithLinks(snapshot);
  const hiddenHolders = new Set(
    holdings.filter((h) => snapshot.hiddenClerkIds.has(h.clerkUserId)).map((h) => h.userId)
  );
  return {
    usersWithLegacyName: snapshot.users.filter((u) => u.wikiUsername).length,
    links: countLinks(snapshot.links, snapshot.systemOwnerUserIds),
    legacyNameMatchesOwnLink: matches,
    legacyNameDiffers: differs,
    contestedNames: contestedNames(holdings),
    hiddenUsersWithNames: hiddenHolders.size,
  };
}
