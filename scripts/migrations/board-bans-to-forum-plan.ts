/**
 * Pure planner for scripts/migrations/migrate-board-bans.ts (ThinkPages forum phase 3, M6): every board mute and
 * ban still in force becomes a realm-scope ForumBan. The forum has no mute; a forum ban stops posting and never
 * reading, which is what a board mute did, so both kinds become bans and the kind is kept in the detail. No
 * database access here.
 *
 * A board restriction is stored on a nation but binds the player who held it, exactly as the board enforced it
 * (`restrictionHolders` in src/server/shared/realm-board.ts): the holder by approved claim when it was imposed,
 * who keeps it after abandoning the nation, and the nation's current owner unless they claimed it only afterwards.
 * The board read both from the ban's own realm (claims made there, the owner of a nation that is still there), so
 * the planner does too. Each bound player gets one ban, idempotent by `sourceRef`.
 *
 * The board never restricted its moderators, while a forum ban binds them (M5). So a bound player who moderates the
 * realm today (a site admin, the realm's founder, or an officer with the `board` power; IxWorld has no founder) is
 * skipped and reported, never banned by the migration.
 */
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  isSiteAdmin,
  type RealmActor,
  type RealmOfficerGrant,
} from "~/server/modules/realms/realms.access";
import { restrictionHolders } from "~/server/shared/realm-board";

/** Every migrated ban's `sourceRef` starts with this. */
export const BAN_SOURCE_REF_PREFIX = "realm_board_ban:";
export const banSourceRef = (banId: string, userId: string) =>
  `${BAN_SOURCE_REF_PREFIX}${banId}:${userId}`;

/** The issuer of a migrated ban whose creator has no User row, and the actor of every migration log row. */
export const MIGRATION_ACTOR = "system";

/** ForumBan.reason is VarChar(1000); a board reason had no limit. */
const REASON_MAX = 1000;

export interface BoardBanRow {
  id: string;
  realmId: string;
  countryId: string;
  kind: string;
  reason: string | null;
  until: Date | null;
  /** Clerk id */
  createdBy: string;
  createdAt: Date;
}

/** An approved claim (from `realmClaim`), as the board's restriction lookup read it. */
export interface ClaimRow {
  realmId: string;
  userId: string;
  countryId: string;
  reviewedAt: Date;
}

/** A nation's realm today and its owner (User id). */
export interface CountryRow {
  realmId: string;
  ownerUserId: string | null;
}

/** What decides whether a bound player moderates the ban's realm. */
export interface ModeratorFacts {
  /** Bound players by User id: their Clerk id and role (`isSiteAdmin`). */
  users: ReadonlyMap<string, Omit<RealmActor, "id">>;
  /** `Realm.ownerId` (a Clerk id) by realm id. */
  realmOwners: ReadonlyMap<string, string>;
  /** The realm's officers (Clerk ids and powers), by realm id; only the `board` power moderates. */
  officers: ReadonlyMap<string, readonly RealmOfficerGrant[]>;
}

/** A bound player left unbanned because they moderate the realm. */
export interface ModeratorSkip {
  sourceRef: string;
  userId: string;
  realmBoardBanId: string;
  holder: "site admin" | "realm moderator";
}

export interface PlannedBan {
  sourceRef: string;
  userId: string;
  scope: "realm";
  scopeId: string;
  reason: string;
  issuedBy: string;
  expiresAt: Date | null;
  auto: false;
  createdAt: Date;
  detail: { realmBoardBanId: string; kind: string; countryId: string };
}

export interface BanMigrationPlan {
  bans: PlannedBan[];
  /**
   * `expired` and `noHolder` count board rows; `alreadyMigrated` and `moderator` count bound players (already
   * carried over; moderating the realm, listed in `moderatorSkips`).
   */
  skipped: { expired: number; noHolder: number; alreadyMigrated: number; moderator: number };
  moderatorSkips: ModeratorSkip[];
  /** Planned bans issued by the system because the board ban's creator has no User row. */
  issuerUnknown: number;
  /** Planned bans whose reason was clipped to the forum's limit. */
  reasonClipped: number;
}

/** The players a row binds: claims and the owner read from the row's own realm, as the board did. */
function holdersOf(
  row: BoardBanRow,
  claims: readonly ClaimRow[],
  countries: ReadonlyMap<string, CountryRow>
): string[] {
  const nation = countries.get(row.countryId);
  const owner = nation?.realmId === row.realmId ? nation.ownerUserId : null;
  return restrictionHolders(
    row,
    claims.filter((c) => c.realmId === row.realmId),
    owner
  );
}

/** The row's reason, trimmed and clipped by characters (never a split surrogate pair), else one naming its kind. */
function reasonOf(row: BoardBanRow): { reason: string; clipped: boolean } {
  const chars = Array.from(row.reason?.trim() ?? "");
  if (chars.length === 0)
    return { reason: `Migrated from the realm board (${row.kind})`, clipped: false };
  return { reason: chars.slice(0, REASON_MAX).join(""), clipped: chars.length > REASON_MAX };
}

const isExpired = (row: BoardBanRow, now: Date) =>
  row.until !== null && row.until.getTime() <= now.getTime();

/** Why `userId` moderates `realmId` today, or null when they do not. */
function moderatorRole(
  userId: string,
  realmId: string,
  facts: ModeratorFacts
): ModeratorSkip["holder"] | null {
  const user = facts.users.get(userId);
  if (!user) return null;
  if (isSiteAdmin({ id: userId, ...user })) return "site admin";
  const founder =
    realmId !== DEFAULT_REALM_ID && facts.realmOwners.get(realmId) === user.clerkUserId;
  const officer = (facts.officers.get(realmId) ?? []).some(
    (o) => o.userId === user.clerkUserId && o.powers.includes("board")
  );
  return founder || officer ? "realm moderator" : null;
}

/** The forum bans still to create, and why the rest are left out. */
export function planBoardBanMigration(input: {
  rows: readonly BoardBanRow[];
  /** Approved claims on the rows' nations. */
  claims: readonly ClaimRow[];
  /** The rows' nations by id; a nation that is gone binds only its former claimants. */
  countries: ReadonlyMap<string, CountryRow>;
  /** User.id by clerkUserId (`createdBy` is a Clerk id). */
  userIdByClerk: ReadonlyMap<string, string>;
  /** sourceRefs already in forum_bans. */
  migrated: ReadonlySet<string>;
  moderators: ModeratorFacts;
  now: Date;
}): BanMigrationPlan {
  const plan: BanMigrationPlan = {
    bans: [],
    skipped: { expired: 0, noHolder: 0, alreadyMigrated: 0, moderator: 0 },
    moderatorSkips: [],
    issuerUnknown: 0,
    reasonClipped: 0,
  };
  for (const row of input.rows) {
    if (isExpired(row, input.now)) {
      plan.skipped.expired += 1;
      continue;
    }
    const holders = holdersOf(row, input.claims, input.countries);
    if (holders.length === 0) plan.skipped.noHolder += 1;
    const issuer = input.userIdByClerk.get(row.createdBy);
    const { reason, clipped } = reasonOf(row);
    for (const userId of holders) {
      const sourceRef = banSourceRef(row.id, userId);
      if (input.migrated.has(sourceRef)) {
        plan.skipped.alreadyMigrated += 1;
        continue;
      }
      const holder = moderatorRole(userId, row.realmId, input.moderators);
      if (holder) {
        plan.skipped.moderator += 1;
        plan.moderatorSkips.push({ sourceRef, userId, realmBoardBanId: row.id, holder });
        continue;
      }
      plan.issuerUnknown += issuer ? 0 : 1;
      plan.reasonClipped += clipped ? 1 : 0;
      plan.bans.push({
        sourceRef,
        userId,
        scope: "realm",
        scopeId: row.realmId,
        reason,
        issuedBy: issuer ?? MIGRATION_ACTOR,
        expiresAt: row.until,
        auto: false,
        createdAt: row.createdAt,
        detail: { realmBoardBanId: row.id, kind: row.kind, countryId: row.countryId },
      });
    }
  }
  return plan;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Counts = Pick<BanMigrationPlan, "skipped" | "issuerUnknown" | "reasonClipped">;

function countsText(bans: number, plan: Counts): string {
  const s = plan.skipped;
  return (
    `${plural(bans, "forum ban")} to create; ` +
    `skipped ${s.expired} expired, ${s.noHolder} no holder, ${s.alreadyMigrated} already migrated, ` +
    `${s.moderator} binding a realm moderator; ` +
    `${plan.issuerUnknown} issued by the system, ${plural(plan.reasonClipped, "reason")} clipped`
  );
}

/** One line per realm (`rows` = its board bans), then the totals. */
export function summarizeBanMigration(
  realms: ReadonlyArray<{ realm: string; rows: number; plan: BanMigrationPlan }>
): string[] {
  const total: Counts = {
    skipped: { expired: 0, noHolder: 0, alreadyMigrated: 0, moderator: 0 },
    issuerUnknown: 0,
    reasonClipped: 0,
  };
  let rows = 0;
  let bans = 0;
  const lines = realms.map(({ realm, rows: count, plan }) => {
    rows += count;
    bans += plan.bans.length;
    total.skipped.expired += plan.skipped.expired;
    total.skipped.noHolder += plan.skipped.noHolder;
    total.skipped.alreadyMigrated += plan.skipped.alreadyMigrated;
    total.skipped.moderator += plan.skipped.moderator;
    total.issuerUnknown += plan.issuerUnknown;
    total.reasonClipped += plan.reasonClipped;
    return `${realm}: ${plural(count, "board ban")}, ${countsText(plan.bans.length, plan)}`;
  });
  return [
    ...lines,
    `Total: ${plural(rows, "board ban")} in ${plural(realms.length, "realm")}, ${countsText(bans, total)}`,
  ];
}
