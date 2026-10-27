/**
 * The read-only snapshot of the legacy IxWiki identity data (`LegacySnapshot` in `~/lib/identity/legacy-identity`),
 * shared by the P0 counts (`count-legacy-identity.ts`) and the claims conversion. Reads only. `"User"."wikiUsername"` is
 * read with raw SQL behind `legacyColumnsExist`, so the snapshot still loads once the removal SQL drops the column
 * (`users` is then `[]`); `existingClaims` is `[]` until the claims table exists.
 */
import type { PrismaClient } from "@prisma/client";
import { SYSTEM_OWNER_IDS } from "~/lib/auth/system-owner-constants";
import type {
  ExistingClaimRow,
  LegacyLinkRow,
  LegacySnapshot,
  LegacyUserRow,
} from "~/lib/identity/legacy-identity";

/** Whether `"User"."wikiUsername"` still exists (the removal SQL drops it). */
export async function legacyColumnsExist(db: PrismaClient): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'wikiUsername'`;
  return (rows[0]?.n ?? 0) > 0;
}

async function loadLinks(db: PrismaClient): Promise<LegacyLinkRow[]> {
  const links = await db.wikiAccountLink.findMany({
    where: { source: "ixwiki" },
    select: {
      userId: true,
      username: true,
      verifiedAt: true,
      verifiedById: true,
      wikiUserId: true,
      user: { select: { clerkUserId: true } },
    },
  });
  return links.map(({ user, ...link }) => ({ ...link, clerkUserId: user.clerkUserId }));
}

async function loadLegacyUsers(db: PrismaClient): Promise<LegacyUserRow[]> {
  if (!(await legacyColumnsExist(db))) return [];
  return db.$queryRaw<LegacyUserRow[]>`
    SELECT "id" AS "userId", "clerkUserId", "wikiUsername" FROM "User" WHERE "wikiUsername" IS NOT NULL`;
}

/**
 * Whether a stored privacy config turned the retired wiki attribution switch off (the key stays in old configs, which
 * nothing else reads); an unreadable one did not.
 */
function hidesWikiAttribution(status: string): boolean {
  try {
    const parsed: { showWikiAttribution?: boolean } | null = JSON.parse(status);
    return parsed?.showWikiAttribution === false;
  } catch {
    return false;
  }
}

/** Clerk ids whose stored privacy config turned wiki attribution off: the conversion keeps their claims hidden. */
async function loadHiddenClerkIds(db: PrismaClient): Promise<Set<string>> {
  const rows = await db.userConnection.findMany({
    where: { targetUserId: "global_privacy", connectionType: "privacy_config" },
    select: { userId: true, status: true },
  });
  return new Set(rows.filter((row) => hidesWikiAttribution(row.status)).map((row) => row.userId));
}

async function loadSystemOwnerUserIds(db: PrismaClient): Promise<Set<string>> {
  if (SYSTEM_OWNER_IDS.length === 0) return new Set();
  const owners = await db.user.findMany({
    where: { clerkUserId: { in: [...SYSTEM_OWNER_IDS] } },
    select: { id: true },
  });
  return new Set(owners.map((owner) => owner.id));
}

async function loadExistingClaims(db: PrismaClient): Promise<ExistingClaimRow[]> {
  const table = await db.$queryRaw<Array<{ present: boolean }>>`
    SELECT to_regclass('wiki_name_claims') IS NOT NULL AS present`;
  if (!table[0]?.present) return [];
  return db.$queryRaw<ExistingClaimRow[]>`
    SELECT "userId", "name", "status"::text AS "status" FROM "wiki_name_claims" WHERE "source" = 'ixwiki'`;
}

export async function loadLegacySnapshot(db: PrismaClient): Promise<LegacySnapshot> {
  const [links, users, hiddenClerkIds, systemOwnerUserIds, existingClaims] = await Promise.all([
    loadLinks(db),
    loadLegacyUsers(db),
    loadHiddenClerkIds(db),
    loadSystemOwnerUserIds(db),
    loadExistingClaims(db),
  ]);
  return { links, users, hiddenClerkIds, systemOwnerUserIds, existingClaims };
}
