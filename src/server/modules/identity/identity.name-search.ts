/**
 * The administrator's view of old IxWiki names (IxnayID design decision 4): the evidence behind a name (its WikiOS
 * edits, Lorewards standing, imported groups and blocks, and who holds or asks for it), the legacy name search across
 * WikiOS revisions, Lorewards and MediaWiki's user list, the claims queue and the account picker of the direct link.
 * Read-only: every decision goes through the claims service (`identity.name-claims.ts`).
 */
import type { Prisma, PrismaClient, WikiNameClaimStatus } from "@prisma/client";
import { checkClaimName, claimName, claimSpellings, IXWIKI } from "~/lib/identity/wiki-names";
import type { NameClaimView } from "./identity.name-claims";

export interface LorewardStanding {
  totalScore: number;
  dailyWins: number;
  weeklyWins: number;
  monthlyWins: number;
  /** Entries where the name is the winner or the runner-up. */
  places: number;
}

export interface NameEvidence {
  name: string;
  /** IxWiki revisions WikiOS holds under the name (either spelling). */
  wikiosEdits: number;
  lorewards: LorewardStanding | null;
  /** Imported MediaWiki groups keyed by the name, unexpired. */
  importedGroups: string[];
  /** A block on the name is in force. */
  blocked: boolean;
  /** The account holding the name's approved claim. */
  owner: { userId: string; handle: string | null } | null;
  pendingClaims: number;
  /** From MediaWiki's user list; null when not asked or not answered. */
  classicEdits: number | null;
}

export interface NameSearchDeps {
  fetchClassicUsers(
    prefix: string,
    limit: number
  ): Promise<Array<{ name: string; editCount: number | null }>>;
}

export interface LinkTarget {
  userId: string;
  handle: string | null;
  clerkUserId: string;
  countryName: string | null;
}

/** A queued claim: the player's own words move to `playerEvidence`, so `evidence` is the name's. */
export interface ClaimQueueItem extends Omit<NameClaimView, "evidence"> {
  playerEvidence: string | null;
  account: LinkTarget;
  evidence: NameEvidence;
}

export type NameSearchDb = Pick<
  PrismaClient,
  | "wikiNameClaim"
  | "wikiRevision"
  | "lorewardUserStats"
  | "lorewardEntry"
  | "wikiUserGroup"
  | "wikiBlock"
  | "user"
>;

const MAX_LINK_TARGETS = 10;
const WIKIOS_AUTHOR_PREFIX = "wikios>";

const ACCOUNT_SELECT = {
  id: true,
  handle: true,
  clerkUserId: true,
  country: { select: { name: true } },
} as const satisfies Prisma.UserSelect;

const QUEUE_SELECT = {
  id: true,
  userId: true,
  name: true,
  status: true,
  visible: true,
  rightsPass: true,
  origin: true,
  evidence: true,
  decisionNote: true,
  createdAt: true,
  decidedAt: true,
  user: { select: ACCOUNT_SELECT },
} as const satisfies Prisma.WikiNameClaimSelect;

const toLinkTarget = (user: Prisma.UserGetPayload<{ select: typeof ACCOUNT_SELECT }>) => ({
  userId: user.id,
  handle: user.handle,
  clerkUserId: user.clerkUserId,
  countryName: user.country?.name ?? null,
});

const insensitive = (text: string) => ({ contains: text, mode: "insensitive" as const });

/** Every spelling a name column may hold for these stored names. */
const spellingsOf = (names: readonly string[]) => names.flatMap(claimSpellings);

/** Blocks and groups with no end, or one still ahead. */
const inForce = (now: Date) => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

async function editCounts(db: NameSearchDb, names: readonly string[]) {
  const groups = await db.wikiRevision.groupBy({
    by: ["author"],
    where: { source: IXWIKI, author: { in: spellingsOf(names) } },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const { author, _count } of groups) {
    if (!author) continue;
    const name = claimName(author);
    counts.set(name, (counts.get(name) ?? 0) + _count._all);
  }
  return counts;
}

async function lorewardStandings(db: NameSearchDb, names: readonly string[]) {
  const spellings = spellingsOf(names);
  const [stats, entries] = await Promise.all([
    db.lorewardUserStats.findMany({
      where: { username: { in: spellings } },
      select: {
        username: true,
        totalScore: true,
        dailyWins: true,
        weeklyWins: true,
        monthlyWins: true,
      },
    }),
    db.lorewardEntry.findMany({
      where: { OR: [{ winnerUser: { in: spellings } }, { runnerUpUser: { in: spellings } }] },
      select: { winnerUser: true, runnerUpUser: true },
    }),
  ]);
  const standings = new Map<string, LorewardStanding>();
  const standingOf = (name: string) => {
    const standing = standings.get(name) ?? {
      totalScore: 0,
      dailyWins: 0,
      weeklyWins: 0,
      monthlyWins: 0,
      places: 0,
    };
    standings.set(name, standing);
    return standing;
  };
  for (const { username, ...row } of stats) {
    const standing = standingOf(claimName(username));
    standing.totalScore += row.totalScore;
    standing.dailyWins += row.dailyWins;
    standing.weeklyWins += row.weeklyWins;
    standing.monthlyWins += row.monthlyWins;
  }
  const wanted = new Set(names);
  for (const entry of entries) {
    const placed = new Set([entry.winnerUser, entry.runnerUpUser].map((n) => claimName(n ?? "")));
    for (const name of placed) if (wanted.has(name)) standingOf(name).places += 1;
  }
  return standings;
}

async function groupsAndBlocks(db: NameSearchDb, names: readonly string[], now: Date) {
  const [groupRows, blockRows] = await Promise.all([
    db.wikiUserGroup.findMany({
      where: { wikiUsername: { in: [...names] }, ...inForce(now) },
      select: { wikiUsername: true, group: true },
      orderBy: { group: "asc" },
    }),
    db.wikiBlock.findMany({
      where: { wikiUsername: { in: [...names] }, ...inForce(now) },
      select: { wikiUsername: true },
    }),
  ]);
  const groups = new Map<string, string[]>();
  for (const row of groupRows) if (row.wikiUsername) push(groups, row.wikiUsername, row.group);
  return { groups, blocked: new Set(blockRows.map((row) => row.wikiUsername)) };
}

async function liveClaims(db: NameSearchDb, names: readonly string[]) {
  const claims = await db.wikiNameClaim.findMany({
    where: { source: IXWIKI, name: { in: [...names] }, status: { in: ["PENDING", "APPROVED"] } },
    select: { name: true, status: true, userId: true, user: { select: { handle: true } } },
  });
  const owners = new Map<string, NameEvidence["owner"]>();
  const pending = new Map<string, number>();
  for (const claim of claims) {
    if (claim.status === "APPROVED") {
      owners.set(claim.name, { userId: claim.userId, handle: claim.user.handle });
    } else {
      pending.set(claim.name, (pending.get(claim.name) ?? 0) + 1);
    }
  }
  return { owners, pending };
}

/** The evidence of each stored name, one query per source for all of them. */
async function loadEvidence(db: NameSearchDb, names: readonly string[]): Promise<NameEvidence[]> {
  if (names.length === 0) return [];
  const [edits, lorewards, { groups, blocked }, { owners, pending }] = await Promise.all([
    editCounts(db, names),
    lorewardStandings(db, names),
    groupsAndBlocks(db, names, new Date()),
    liveClaims(db, names),
  ]);
  return names.map((name) => ({
    name,
    wikiosEdits: edits.get(name) ?? 0,
    lorewards: lorewards.get(name) ?? null,
    importedGroups: groups.get(name) ?? [],
    blocked: blocked.has(name),
    owner: owners.get(name) ?? null,
    pendingClaims: pending.get(name) ?? 0,
    classicEdits: null,
  }));
}

/** Each name, in its stored form, to its evidence. */
export async function evidenceForNames(
  db: NameSearchDb,
  names: readonly string[]
): Promise<Map<string, NameEvidence>> {
  const wanted = [...new Set(names.map(claimName))].filter(Boolean);
  return new Map((await loadEvidence(db, wanted)).map((e) => [e.name, e]));
}

/** MediaWiki's users from the query, by stored name; a failure is logged and answers none. */
async function classicUsers(deps: NameSearchDeps, query: string, limit: number) {
  try {
    const users = await deps.fetchClassicUsers(query, limit);
    return new Map(users.map((user) => [claimName(user.name), user.editCount]));
  } catch (error) {
    console.warn("[identity] MediaWiki user list failed", error);
    return new Map<string, number | null>();
  }
}

/**
 * Old IxWiki names containing the query: WikiOS's IxWiki revision authors (never a `wikios>` one), Lorewards stats,
 * winners and runners-up, and MediaWiki's user list (by prefix). Normalised, deduplicated, sorted and cut to `limit`.
 */
export async function searchLegacyNames(
  db: NameSearchDb,
  deps: NameSearchDeps,
  query: string,
  limit: number
): Promise<NameEvidence[]> {
  const text = query.trim();
  if (!text) return [];
  const [authors, stats, winners, runnersUp, classic] = await Promise.all([
    db.wikiRevision.groupBy({
      by: ["author"],
      where: {
        source: IXWIKI,
        author: { ...insensitive(text), not: { startsWith: WIKIOS_AUTHOR_PREFIX } },
      },
      orderBy: { author: "asc" },
      take: limit,
    }),
    db.lorewardUserStats.findMany({
      where: { username: insensitive(text) },
      select: { username: true },
      take: limit,
    }),
    db.lorewardEntry.findMany({
      where: { winnerUser: insensitive(text) },
      distinct: ["winnerUser"],
      select: { winnerUser: true },
      take: limit,
    }),
    db.lorewardEntry.findMany({
      where: { runnerUpUser: insensitive(text) },
      distinct: ["runnerUpUser"],
      select: { runnerUpUser: true },
      take: limit,
    }),
    classicUsers(deps, query, limit),
  ]);
  const found = [
    ...authors.map((a) => a.author),
    ...stats.map((s) => s.username),
    ...winners.map((w) => w.winnerUser),
    ...runnersUp.map((r) => r.runnerUpUser),
    ...classic.keys(),
  ].flatMap((raw) => {
    const check = checkClaimName(raw ?? "");
    return check.ok ? [check.name] : [];
  });
  const names = [...new Set(found)].sort((a, b) => a.localeCompare(b)).slice(0, limit);
  return (await loadEvidence(db, names)).map((e) => ({
    ...e,
    classicEdits: classic.get(e.name) ?? null,
  }));
}

/** The claims of one status with their accounts and evidence: PENDING oldest first, the rest newest decision first. */
export async function listClaimQueue(
  db: NameSearchDb,
  input: { status: WikiNameClaimStatus; cursor: string | null; limit: number }
): Promise<{ items: ClaimQueueItem[]; nextCursor: string | null }> {
  const rows = await db.wikiNameClaim.findMany({
    where: { source: IXWIKI, status: input.status },
    orderBy:
      input.status === "PENDING"
        ? [{ createdAt: "asc" }, { id: "asc" }]
        : [{ decidedAt: "desc" }, { id: "desc" }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
    select: QUEUE_SELECT,
  });
  const page = rows.slice(0, input.limit);
  const evidence = await evidenceForNames(
    db,
    page.map((row) => row.name)
  );
  const items = page.flatMap(({ user, evidence: playerEvidence, ...claim }) => {
    const found = evidence.get(claim.name);
    return found
      ? [{ ...claim, playerEvidence, account: toLinkTarget(user), evidence: found }]
      : [];
  });
  return { items, nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null };
}

/** Accounts to link a name to: handle (a leading @ allowed), forum name or country name, or an exact Clerk or user id. */
export async function findLinkTargets(db: NameSearchDb, query: string): Promise<LinkTarget[]> {
  const text = query.trim().replace(/^@/, "");
  if (!text) return [];
  const users = await db.user.findMany({
    where: {
      OR: [
        { handle: insensitive(text) },
        { forumUsername: insensitive(text) },
        { country: { name: insensitive(text) } },
        { clerkUserId: text },
        { id: text },
      ],
    },
    orderBy: [{ handle: "asc" }, { id: "asc" }],
    take: MAX_LINK_TARGETS,
    select: ACCOUNT_SELECT,
  });
  return users.map(toLinkTarget);
}
