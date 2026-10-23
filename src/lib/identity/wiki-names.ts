/**
 * The one resolver of "who is this wiki name" (IxnayID design item 3). The rule: only APPROVED claims identify anyone
 * (a pending, rejected or revoked claim answers nothing), and anything a person other than the owner sees reads with
 * `shown`, so a claim its owner keeps hidden (`visible = false`) answers nothing there. Rights, blocks, revision tags and
 * the owner's own views read without `shown`.
 */
import type { PrismaClient } from "@prisma/client";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

export const IXWIKI = "ixwiki" as const;
export type WikiNameSource = typeof IXWIKI;
export const MAX_CLAIM_NAME_LENGTH = 85;

export interface NameLookup {
  /** Only claims their owner shows (`visible`): for anything another person sees. */
  shown?: boolean;
}

export interface ClaimedName {
  claimId: string;
  name: string;
  visible: boolean;
  rightsPass: boolean;
  approvedAt: Date | null;
  mwUserId: number | null;
}

export type ClaimNameCheck = { ok: true; name: string } | { ok: false; message: string };

type ClaimsDb = Pick<PrismaClient, "wikiNameClaim">;

/** MediaWiki characters no user name can hold; `>` also keeps every `wikios>` name out. */
const IMPOSSIBLE = /[#<>[\]|{}]/;

const CLAIMED_NAME_SELECT = {
  id: true,
  userId: true,
  name: true,
  visible: true,
  rightsPass: true,
  decidedAt: true,
  mwUserId: true,
} as const;

/** The stored form of a wiki name: MediaWiki's (underscores are spaces, the first letter upper-cased). */
export function claimName(raw: string): string {
  return normalizeWikiUsername(raw);
}

export function checkClaimName(raw: string): ClaimNameCheck {
  const name = claimName(raw);
  if (!name) return { ok: false, message: "Enter a wiki name." };
  if (name.length > MAX_CLAIM_NAME_LENGTH) {
    return { ok: false, message: `A wiki name is at most ${MAX_CLAIM_NAME_LENGTH} characters.` };
  }
  if (IMPOSSIBLE.test(name)) {
    return { ok: false, message: "A wiki name cannot contain # < > [ ] | { }." };
  }
  return { ok: true, name };
}

/** The spellings a revision's `author` may hold for a stored name: with spaces, and with underscores. */
export function claimSpellings(name: string): string[] {
  return [...new Set([name, name.replace(/ /g, "_")])];
}

/** The passport handle a wiki name spells (`User:Foo bar` is handle `foo_bar`). */
export function handleOfWikiName(name: string): string {
  return (name.charAt(0).toLowerCase() + name.slice(1)).replace(/ /g, "_");
}

const approved = (opts: NameLookup | undefined) => ({
  status: "APPROVED" as const,
  ...(opts?.shown ? { visible: true } : {}),
});

const toClaimedName = (row: {
  id: string;
  name: string;
  visible: boolean;
  rightsPass: boolean;
  decidedAt: Date | null;
  mwUserId: number | null;
}): ClaimedName => ({
  claimId: row.id,
  name: row.name,
  visible: row.visible,
  rightsPass: row.rightsPass,
  approvedAt: row.decidedAt,
  mwUserId: row.mwUserId,
});

/** The account holding `name`'s approved claim, or null. */
export async function ownerOfName(
  db: ClaimsDb,
  source: WikiNameSource,
  name: string,
  opts?: NameLookup
): Promise<string | null> {
  const claim = await db.wikiNameClaim.findFirst({
    where: { source, name: claimName(name), ...approved(opts) },
    select: { userId: true },
  });
  return claim?.userId ?? null;
}

/** Each claimed name (in its stored form) to the account holding it; unclaimed names are left out. */
export async function ownersOfNames(
  db: ClaimsDb,
  source: WikiNameSource,
  names: readonly string[],
  opts?: NameLookup
): Promise<Map<string, string>> {
  const wanted = [...new Set(names.map(claimName))];
  if (wanted.length === 0) return new Map();
  const claims = await db.wikiNameClaim.findMany({
    where: { source, name: { in: wanted }, ...approved(opts) },
    select: { name: true, userId: true },
  });
  return new Map(claims.map((c) => [c.name, c.userId]));
}

/** Every name an account holds, oldest approval first, then by name. */
export async function namesOfUser(
  db: ClaimsDb,
  userId: string,
  opts?: NameLookup
): Promise<ClaimedName[]> {
  return (await namesOfUsers(db, [userId], opts)).get(userId) ?? [];
}

/** `namesOfUser` for several accounts; an account with no names is left out. */
export async function namesOfUsers(
  db: ClaimsDb,
  userIds: readonly string[],
  opts?: NameLookup
): Promise<Map<string, ClaimedName[]>> {
  const byUser = new Map<string, ClaimedName[]>();
  if (userIds.length === 0) return byUser;
  const rows = await db.wikiNameClaim.findMany({
    where: { source: IXWIKI, userId: { in: [...new Set(userIds)] }, ...approved(opts) },
    orderBy: [{ decidedAt: "asc" }, { name: "asc" }],
    select: CLAIMED_NAME_SELECT,
  });
  for (const row of rows) {
    byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), toClaimedName(row)]);
  }
  return byUser;
}

/** The account's first-approved name, or null. */
export async function primaryNameOf(
  db: ClaimsDb,
  userId: string,
  opts?: NameLookup
): Promise<string | null> {
  return (await namesOfUser(db, userId, opts))[0]?.name ?? null;
}

/**
 * The account a wiki name (a `User:` title) stands for: its approved claim wins (with `shown`, a hidden claim answers
 * null, never the handle below); with no approved claim, the account whose handle the name spells. Handles are stored
 * lower-case, so a name with other capitals matches no handle.
 */
export async function accountOfWikiName(
  db: Pick<PrismaClient, "wikiNameClaim" | "user">,
  name: string,
  opts?: NameLookup
): Promise<{ userId: string; handle: string | null } | null> {
  const stored = claimName(name);
  if (!stored) return null;
  const claim = await db.wikiNameClaim.findFirst({
    where: { source: IXWIKI, name: stored, status: "APPROVED" },
    select: { userId: true, visible: true, user: { select: { handle: true } } },
  });
  if (claim) {
    return opts?.shown && !claim.visible
      ? null
      : { userId: claim.userId, handle: claim.user.handle };
  }
  const user = await db.user.findUnique({
    where: { handle: handleOfWikiName(stored) },
    select: { id: true, handle: true },
  });
  return user ? { userId: user.id, handle: user.handle } : null;
}
