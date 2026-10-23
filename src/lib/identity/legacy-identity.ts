/**
 * The legacy IxWiki identity data (IxWiki `WikiAccountLink` rows, `User.wikiUsername`, the wiki attribution switch) as
 * one read-only snapshot, and the counts the owner reads on production before the IxnayID identity work (design: order,
 * step 1), and the plan that converts them into name claims (design decision 8). Pure:
 * `scripts/identity/legacy-snapshot.ts` loads the snapshot, `scripts/identity/convert-wiki-name-claims.ts` applies the plan.
 */
import { checkClaimName } from "~/lib/identity/wiki-names";
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

// --- the conversion (design decision 8) ---------------------------------------------------------------------------

/** The `adminAuditLog.action` the conversion's apply writes once; the removal SQL refuses to run without it. */
export const CONVERSION_MARKER = "WIKI_NAME_CLAIMS_CONVERTED";

export interface ConvertedClaim {
  userId: string;
  name: string;
  status: "APPROVED" | "PENDING";
  visible: boolean;
  rightsPass: boolean;
  decidedById: string | null;
  decidedAt: Date | null;
  mwUserId: number | null;
  decisionNote: string;
}

export type SkipReason = "EXISTS" | "NAME_TAKEN" | "INVALID";

export interface ConversionPlan {
  create: ConvertedClaim[];
  skipped: Array<{ userId: string; name: string; reason: SkipReason }>;
  /** Names two or more accounts would hold or ask for once the plan is applied, user ids sorted. */
  conflicts: Array<{ name: string; userIds: string[] }>;
}

type Verifier = Exclude<keyof LinkCounts, "unverified">;

const APPROVAL: Record<Verifier, { rightsPass: boolean; note: string }> = {
  verifiedByToken: {
    rightsPass: true,
    note: "Converted from a wiki link its account proved with a token",
  },
  verifiedBySystemOwner: {
    rightsPass: true,
    note: "Converted from a wiki link a system owner confirmed",
  },
  verifiedByAdmin: {
    rightsPass: false,
    note: "Converted from a wiki link an administrator confirmed",
  },
};

const pendingFields = {
  status: "PENDING",
  rightsPass: false,
  decidedById: null,
  decidedAt: null,
} as const;

/** A converted claim before the name rules: the raw name, and no visibility yet. */
type Candidate = Omit<ConvertedClaim, "visible">;

const claimKey = (userId: string, name: string) => `${userId}\u0000${name}`;

function linkCandidate(link: LegacyLinkRow, systemOwnerUserIds: ReadonlySet<string>): Candidate {
  const verifier = linkVerifier(link, systemOwnerUserIds);
  // the PostgreSQL fast path stored 1, which is no MediaWiki user id (admin/users.ts)
  const mwUserId = link.wikiUserId !== null && link.wikiUserId > 1 ? link.wikiUserId : null;
  const base = { userId: link.userId, name: link.username, mwUserId };
  if (verifier === "unverified") {
    return { ...base, ...pendingFields, decisionNote: "Converted from an unverified wiki link" };
  }
  const { rightsPass, note } = APPROVAL[verifier];
  return {
    ...base,
    status: "APPROVED",
    rightsPass,
    decidedById: link.verifiedById,
    decidedAt: link.verifiedAt,
    decisionNote: note,
  };
}

/** Every candidate claim; a legacy name that is the user's own link name adds nothing (one claim per user and name). */
function candidates(snapshot: LegacySnapshot): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const link of snapshot.links) {
    const claim = linkCandidate(link, snapshot.systemOwnerUserIds);
    byKey.set(claimKey(claim.userId, normalizeWikiUsername(claim.name)), claim);
  }
  for (const user of snapshot.users) {
    const raw = user.wikiUsername?.trim();
    const key = raw ? claimKey(user.userId, normalizeWikiUsername(raw)) : "";
    if (!raw || byKey.has(key)) continue;
    byKey.set(key, {
      userId: user.userId,
      name: raw,
      mwUserId: null,
      ...pendingFields,
      decisionNote: "Converted from the old wiki name field",
    });
  }
  return [...byKey.values()];
}

/** Two accounts' approvals of one name: neither is approved, both are asked, and the name is a conflict. */
function demoteTiedApprovals(create: ConvertedClaim[]): ConvertedClaim[] {
  const approvals = new Map<string, number>();
  for (const c of create) {
    if (c.status === "APPROVED") approvals.set(c.name, (approvals.get(c.name) ?? 0) + 1);
  }
  return create.map((c) =>
    c.status === "APPROVED" && (approvals.get(c.name) ?? 0) > 1 ? { ...c, ...pendingFields } : c
  );
}

function conflictsAfter(
  snapshot: LegacySnapshot,
  create: ConvertedClaim[]
): ConversionPlan["conflicts"] {
  const live = snapshot.existingClaims.filter(
    (c) => c.status === "APPROVED" || c.status === "PENDING"
  );
  const holders = new Map<string, Set<string>>();
  for (const { name, userId } of [...live, ...create])
    holders.set(name, (holders.get(name) ?? new Set()).add(userId));
  return [...holders]
    .filter(([, users]) => users.size > 1)
    .map(([name, users]) => ({ name, userIds: [...users].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function planConversion(snapshot: LegacySnapshot): ConversionPlan {
  const existing = new Set(snapshot.existingClaims.map((c) => claimKey(c.userId, c.name)));
  const held = new Set(
    snapshot.existingClaims.filter((c) => c.status === "APPROVED").map((c) => c.name)
  );
  const clerkOf = new Map(
    [...snapshot.links, ...snapshot.users].map((row) => [row.userId, row.clerkUserId])
  );
  const create: ConvertedClaim[] = [];
  const skipped: ConversionPlan["skipped"] = [];
  for (const candidate of candidates(snapshot)) {
    const check = checkClaimName(candidate.name);
    const name = check.ok ? check.name : normalizeWikiUsername(candidate.name);
    const skip = (reason: SkipReason) => skipped.push({ userId: candidate.userId, name, reason });
    if (!check.ok) skip("INVALID");
    else if (existing.has(claimKey(candidate.userId, name))) skip("EXISTS");
    else if (candidate.status === "APPROVED" && held.has(name)) skip("NAME_TAKEN");
    else {
      const visible = !snapshot.hiddenClerkIds.has(clerkOf.get(candidate.userId) ?? "");
      create.push({ ...candidate, name, visible });
    }
  }
  const planned = demoteTiedApprovals(create);
  return { create: planned, skipped, conflicts: conflictsAfter(snapshot, planned) };
}
