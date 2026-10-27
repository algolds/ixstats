/** @jest-environment node */
import { DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import { issueWarning, listWarnings, revokeWarning } from "~/server/modules/thinkpages-forum";
import { banNotice } from "~/lib/thinkpages-forum/moderation-policy";
import {
  activeBansFor,
  assertNotBanned,
  issueBan,
  liftBan,
  listBans,
  postingBan,
} from "~/server/modules/thinkpages-forum";
import {
  banRow as ban,
  matchesActiveBan as matches,
  type ActiveBanWhere,
  type BanRow as FakeBanRow,
} from "~/tests/helpers/forum-ban-fake";

const NOW = new Date("2026-10-09T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * DAY_MS);
const USER_ROLE = { name: "user", level: 100 };
const ADMIN_ROLE = { name: "admin", level: 10 };

const admin = { id: "u_a", clerkUserId: "admin", countryId: null, role: ADMIN_ROLE };
const member = { id: "u_m", clerkUserId: "member", countryId: "c1", role: USER_ROLE };
const realmMod = {
  id: "u_f",
  clerkUserId: "founder",
  countryId: null,
  role: USER_ROLE,
  mod: { siteAdmin: false, realmIds: ["r_eurth"], categoryIds: [] },
};

const users = [
  { id: "u_m", clerkUserId: "member", role: USER_ROLE },
  { id: "u_a2", clerkUserId: "admin2", role: ADMIN_ROLE },
  { id: "u_o", clerkUserId: "officer", role: USER_ROLE },
];
const officers = [{ realmId: "r_eurth", userId: "officer", powers: ["board"] }];
const eurthHub = { id: "cat_eurth_hub", scope: "realm", realmId: "r_eurth" };
const general = { id: "cat_general", scope: "site", realmId: null };
const categories = [eurthHub, general];
const threads = [
  { id: "t_eurth", authorUserId: "u_m", category: eurthHub },
  { id: "t_general", authorUserId: "u_m", category: general },
  { id: "t_officer", authorUserId: "u_o", category: eurthHub },
  { id: "t_admin", authorUserId: "u_a2", category: eurthHub },
  // Imported from XenForo without an IxStats account (phase 4).
  { id: "t_imported", authorUserId: null, category: eurthHub },
];
const posts = [
  { id: "p_eurth", authorUserId: "u_m", thread: { category: eurthHub } },
  { id: "p_imported", authorUserId: null, thread: { category: eurthHub } },
];

type WarningRow = {
  id: string;
  userId: string;
  points: number;
  categoryId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedBy?: string | null;
};
type BanRow = {
  id: string;
  userId: string;
  scope: string;
  scopeId: string | null;
  auto: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  liftedAt: Date | null;
  autoTier: number | null;
  reason?: string;
};
/** The member lock is a tagged template call: (strings, key). */
type LockCall = [TemplateStringsArray, string];

/** The member's lock is the transaction's first statement, keyed by the member. */
function expectLockedFirst(
  tx: { $executeRaw: jest.Mock },
  userId: string,
  firstWrite: jest.Mock
): void {
  const [strings, key] = tx.$executeRaw.mock.calls[0] as LockCall;
  expect(strings.join("?")).toBe("SELECT pg_advisory_xact_lock(hashtext(?))");
  expect(key).toBe(`forum-member:${userId}`);
  expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
    firstWrite.mock.invocationCallOrder[0]!
  );
}

interface LogRow {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  scope: string;
  scopeId: string | null;
  detail: string | null;
}

const warning = (extra: Partial<WarningRow>): WarningRow => ({
  id: "w_old",
  userId: "u_m",
  points: 1,
  categoryId: null,
  expiresAt: days(30),
  revokedAt: null,
  ...extra,
});
const autoBan = (extra: Partial<BanRow>): BanRow => ({
  id: "b_auto",
  userId: "u_m",
  scope: "site",
  scopeId: null,
  auto: true,
  createdAt: days(-2),
  expiresAt: days(5),
  liftedAt: null,
  autoTier: 5,
  ...extra,
});

interface Where {
  id?: string;
  userId?: string;
  scope?: string;
  auto?: boolean;
  liftedAt?: null;
  revokedAt?: null;
  expiresAt?: { gt: Date };
}

type Row = Record<string, string | number | boolean | Date | null | undefined>;

const fits = (row: Row, where: Where): boolean =>
  Object.entries(where).every(([key, value]) =>
    value !== null && typeof value === "object" && "gt" in value
      ? row[key] instanceof Date && (row[key] as Date) > value.gt
      : row[key] === value
  );

function warnDb(seed: { warnings?: WarningRow[]; bans?: BanRow[] } = {}) {
  const warnings: WarningRow[] = [...(seed.warnings ?? [])];
  const bans: BanRow[] = [...(seed.bans ?? [])];
  const logs: LogRow[] = [];
  let n = 0;
  const tx = {
    $executeRaw: jest.fn(async (..._call: LockCall) => 0),
    forumWarning: {
      create: jest.fn(async ({ data }: { data: Omit<WarningRow, "id" | "revokedAt"> }) => {
        const row = { id: `w${++n}`, revokedAt: null, ...data };
        warnings.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        warnings.filter((w) => fits(w, where))
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; revokedAt: null };
          data: Partial<WarningRow>;
        }) => {
          const row = warnings.find((w) => w.id === where.id && w.revokedAt === null);
          if (row) Object.assign(row, data);
          return { count: row ? 1 : 0 };
        }
      ),
    },
    forumBan: {
      // The manual site bans an automatic one would sit under (M-2).
      findMany: jest.fn(async ({ where }: { where: Where }) => bans.filter((b) => fits(b, where))),
      findFirst: jest.fn(
        // A copy, as Prisma returns: later updates must not change what the caller read.
        async ({ where }: { where: Where }) => {
          const row = bans.find((b) => fits(b, where));
          return row ? { ...row } : null;
        }
      ),
      create: jest.fn(async ({ data }: { data: Omit<BanRow, "id" | "createdAt" | "liftedAt"> }) => {
        const row = { id: `b${++n}`, createdAt: NOW, liftedAt: null, ...data };
        bans.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<BanRow> }) =>
        Object.assign(
          bans.find((b) => b.id === where.id)!,
          data
        )
      ),
      // liftBanTx's conditional update: only a live, unlifted ban.
      updateMany: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<BanRow> }) => {
          const row = bans.find(
            (b) =>
              b.id === where.id &&
              b.liftedAt === null &&
              (b.expiresAt === null || b.expiresAt > NOW)
          );
          if (row) Object.assign(row, data);
          return { count: row ? 1 : 0 };
        }
      ),
    },
    forumModLog: {
      create: jest.fn(async ({ data }: { data: LogRow }) => {
        logs.push(data);
        return { id: `log${logs.length}` };
      }),
    },
    // No open appeals here; mooting them is covered in mod-appeals.test.ts.
    forumAppeal: { findFirst: jest.fn(async () => null), updateMany: jest.fn() },
  };
  const db = {
    forumWarning: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) =>
          warnings.find((w) => w.id === where.id) ?? null
      ),
      findMany: jest.fn(async () => warnings),
      count: jest.fn(async () => warnings.length),
    },
    // Appeal statuses for listWarnings; none unless a test says so.
    forumAppeal: {
      findMany: jest.fn(async (): Promise<Array<{ subjectId: string; status: string }>> => []),
    },
    forumThread: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) =>
          threads.find((t) => t.id === where.id) ?? null
      ),
    },
    forumPost: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) => posts.find((p) => p.id === where.id) ?? null
      ),
    },
    forumCategory: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) =>
          categories.find((c) => c.id === where.id) ?? null
      ),
      findMany: jest.fn(async () => [{ id: "cat_eurth_hub" }]),
    },
    user: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null
      ),
    },
    realm: {
      findMany: jest.fn(async ({ where }: { where: { ownerId: string } }) =>
        where.ownerId === "founder" ? [{ id: "r_eurth" }] : []
      ),
    },
    realmOfficer: {
      findMany: jest.fn(async ({ where }: { where: { userId: string; powers: { has: string } } }) =>
        officers
          .filter((o) => o.userId === where.userId && o.powers.includes(where.powers.has))
          .map((o) => ({ realmId: o.realmId }))
      ),
    },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
    forumModLog: { create: jest.fn(async () => ({ id: "never" })) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<object>) => fn(tx)),
  };
  return { db, tx, warnings, bans, logs };
}

const parsed = (log: LogRow | undefined) => ({
  ...log,
  detail: log?.detail ? JSON.parse(log.detail) : null,
});

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

/** The moment the member's lock is granted after a wait. */
const WAITED = new Date(NOW.getTime() + 60_000);
/** The first lock call waits a minute: the clock moves on before it returns. */
function lockWaits(tx: { $executeRaw: jest.Mock }): void {
  tx.$executeRaw.mockImplementationOnce(async () => {
    jest.setSystemTime(WAITED);
    return 0;
  });
}

describe("issueWarning", () => {
  const sitewide = { userId: "u_m", reason: " Rude ", points: 4 };
  it("bans for 30 days at 10 active points", async () => {
    const { db, bans } = warnDb({ warnings: [warning({ points: 5, expiresAt: days(80) })] });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 5 });
    expect(outcome).toMatchObject({
      activePoints: 10,
      autoBan: { kind: "issued", autoTier: 10, days: 30 },
    });
    expect(bans[0]).toMatchObject({
      autoTier: 10,
      expiresAt: days(30),
      reason: "Automatic: 10 active warning points",
    });
  });

  it("extends an active automatic ban to the higher tier's full length from the crossing, instead of stacking a second one (M3)", async () => {
    const { db, tx, bans, logs } = warnDb({
      warnings: [warning({ id: "w_a", points: 5 }), warning({ id: "w_b", points: 2 })],
      bans: [autoBan({ createdAt: days(-2), expiresAt: days(5), autoTier: 5 })],
    });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 3 });
    expect(outcome).toEqual({
      warningId: "w1",
      activePoints: 10,
      autoBan: {
        kind: "extended",
        banId: "b_auto",
        autoTier: 10,
        days: 30,
        expiresAt: days(30),
        reason: "Automatic: 10 active warning points",
      },
    });
    expect(tx.forumBan.create).not.toHaveBeenCalled();
    expect(bans).toEqual([
      expect.objectContaining({
        id: "b_auto",
        autoTier: 10,
        expiresAt: days(30),
        reason: "Automatic: 10 active warning points",
      }),
    ]);
    expect(tx.forumBan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u_m", scope: "site", auto: true, liftedAt: null, expiresAt: { gt: NOW } },
      })
    );
    expect(parsed(logs[1])).toEqual({
      actorId: "u_a",
      action: "ban.extend",
      targetType: "user",
      targetId: "u_m",
      scope: "site",
      scopeId: null,
      detail: {
        banId: "b_auto",
        days: 30,
        points: 10,
        autoTier: 10,
        previousTier: 5,
        expiresAt: days(30).toISOString(),
        trigger: "warning",
        warningId: "w1",
      },
    });
  });

  it("issues no automatic ban, so no notice, under a permanent manual site ban (M-2)", async () => {
    const manual = autoBan({ id: "b_manual", auto: false, autoTier: null, expiresAt: null });
    const { db, tx, bans, logs } = warnDb({ warnings: [warning({ points: 4 })], bans: [manual] });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 1 });
    expect(outcome).toEqual({ warningId: "w1", activePoints: 5, autoBan: null });
    expect(tx.forumBan.create).not.toHaveBeenCalled();
    expect(bans).toEqual([manual]);
    expect(logs.map((l) => l.action)).toEqual(["warning.issue"]);
    expect(tx.forumBan.findMany).toHaveBeenCalledWith({
      where: { userId: "u_m", scope: "site", auto: false, liftedAt: null },
      select: { expiresAt: true },
    });
  });
  it("never shortens an active automatic ban to a lower tier on a new warning", async () => {
    const { db, tx, bans, logs } = warnDb({
      warnings: [warning({ points: 5, expiresAt: days(-1) }), warning({ points: 5 })],
      bans: [autoBan({ createdAt: days(-2), expiresAt: days(28), autoTier: 10 })],
    });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 1 });
    expect(outcome).toMatchObject({ activePoints: 6, autoBan: null });
    expect(bans[0]).toMatchObject({ liftedAt: null, expiresAt: days(28), autoTier: 10 });
    expect(tx.forumBan.update).not.toHaveBeenCalled();
    expect(logs.map((l) => l.action)).toEqual(["warning.issue"]);
  });
  it("keeps moderators to their scope and sitewide warnings to site admins", async () => {
    const { db, tx } = warnDb();
    const base = { userId: "u_m", reason: "Spam", points: 1 };
    await expect(issueWarning(db as never, realmMod, base)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      issueWarning(db as never, realmMod, { ...base, target: { type: "thread", id: "t_general" } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(issueWarning(db as never, member, base)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(issueWarning(db as never, null, base)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(tx.forumWarning.create).not.toHaveBeenCalled();
  });

  it("needs a target that exists and was written by the warned member", async () => {
    const { db, tx } = warnDb();
    const base = { userId: "u_m", reason: "Spam", points: 1 };
    await expect(
      issueWarning(db as never, admin, { ...base, target: { type: "post", id: "p_nope" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      issueWarning(db as never, admin, { ...base, target: { type: "thread", id: "t_nope" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      issueWarning(db as never, admin, {
        ...base,
        userId: "u_o",
        target: { type: "thread", id: "t_eurth" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.forumWarning.create).not.toHaveBeenCalled();
  });

  it("refuses a warning on content that has no IxStats author (imported), before the author check", async () => {
    const { db, tx } = warnDb();
    const base = { userId: "u_m", reason: "Spam", points: 1 };
    await expect(
      issueWarning(db as never, realmMod, { ...base, target: { type: "post", id: "p_imported" } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "This post has no IxStats author." });
    await expect(
      issueWarning(db as never, admin, { ...base, target: { type: "thread", id: "t_imported" } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "This thread has no IxStats author." });
    expect(tx.forumWarning.create).not.toHaveBeenCalled();
  });
  it("never warns site admins or the scope's own moderators (M5), nor unknown members", async () => {
    const { db, tx } = warnDb();
    await expect(
      issueWarning(db as never, admin, {
        userId: "u_a2",
        reason: "x",
        points: 1,
        target: { type: "thread", id: "t_admin" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Site admins can't be warned." });
    await expect(
      issueWarning(db as never, admin, {
        userId: "u_o",
        reason: "x",
        points: 1,
        target: { type: "thread", id: "t_officer" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Remove their moderator role first." });
    await expect(
      issueWarning(db as never, admin, { userId: "u_nope", reason: "x", points: 1 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(tx.forumWarning.create).not.toHaveBeenCalled();
  });
});

describe("issueWarning and revokeWarning read the clock after the member's lock", () => {
  it("leaves the automatic ban alone when the warning expired while the revoke waited for the lock", async () => {
    const { db, tx, bans } = warnDb({
      warnings: [
        warning({ id: "w_x", points: 3, expiresAt: new Date(NOW.getTime() + 30_000) }),
        warning({ id: "w_y", points: 2 }),
      ],
      bans: [autoBan({ autoTier: 5 })],
    });
    lockWaits(tx);
    expect(await revokeWarning(db as never, admin, { warningId: "w_x" })).toEqual({
      userId: "u_m",
      autoBan: null,
    });
    expect(bans[0]).toMatchObject({ liftedAt: null, expiresAt: days(5) });
  });
});

describe("revokeWarning", () => {
  const thirtyDayBan = (createdAt: Date) =>
    autoBan({ createdAt, expiresAt: new Date(createdAt.getTime() + 30 * DAY_MS), autoTier: 10 });
  const tenPoints = () => [
    warning({ id: "w_a", points: 5 }),
    warning({ id: "w_b", points: 2 }),
    warning({ id: "w_c", points: 3 }),
  ];

  it("shortens a 30-day automatic ban to 7 days from its start when points fall from 10 to 7 (M3)", async () => {
    const { db, bans, logs } = warnDb({ warnings: tenPoints(), bans: [thirtyDayBan(days(-2))] });
    expect(await revokeWarning(db as never, admin, { warningId: "w_c" })).toEqual({
      userId: "u_m",
      autoBan: {
        kind: "shortened",
        banId: "b_auto",
        autoTier: 5,
        days: 7,
        expiresAt: days(5),
        reason: "Automatic: 7 active warning points",
      },
    });
    expect(bans[0]).toMatchObject({ autoTier: 5, expiresAt: days(5), liftedAt: null });
    expect(logs.map(parsed)).toEqual([
      expect.objectContaining({
        action: "warning.revoke",
        detail: { note: null, warningId: "w_c" },
      }),
      {
        actorId: "u_a",
        action: "ban.shorten",
        targetType: "user",
        targetId: "u_m",
        scope: "site",
        scopeId: null,
        detail: {
          banId: "b_auto",
          days: 7,
          points: 7,
          autoTier: 5,
          previousTier: 10,
          expiresAt: days(5).toISOString(),
          reason: "warning revoked",
          warningId: "w_c",
        },
      },
    ]);
    expect(db.forumModLog.create).not.toHaveBeenCalled();
  });

  it("lifts a 30-day automatic ban when points fall to 7 and it started more than 7 days ago", async () => {
    const { db, bans, logs } = warnDb({ warnings: tenPoints(), bans: [thirtyDayBan(days(-8))] });
    expect(await revokeWarning(db as never, admin, { warningId: "w_c" })).toEqual({
      userId: "u_m",
      autoBan: { kind: "lifted", banId: "b_auto" },
    });
    expect(bans[0]).toMatchObject({ liftedAt: NOW, liftedBy: "u_a", autoTier: 10 });
    expect(parsed(logs[1])).toMatchObject({
      action: "ban.lift",
      detail: { reason: "warning revoked", warningId: "w_c", points: 7, banId: "b_auto" },
    });
  });

  it("keeps a 7-day automatic ban while points stay at 5 or more, and lifts it at 7 to 4", async () => {
    const { db, bans, logs } = warnDb({
      warnings: [
        warning({ id: "w_a", points: 4 }),
        warning({ id: "w_b", points: 2 }),
        warning({ id: "w_c", points: 1 }),
      ],
      bans: [autoBan({ autoTier: 5 })],
    });
    expect(await revokeWarning(db as never, admin, { warningId: "w_c" })).toEqual({
      userId: "u_m",
      autoBan: null,
    });
    expect(bans[0]).toMatchObject({ liftedAt: null, expiresAt: days(5) });
    expect(
      await revokeWarning(db as never, admin, { warningId: "w_b", note: " Overturned " })
    ).toEqual({
      userId: "u_m",
      autoBan: { kind: "lifted", banId: "b_auto" },
    });
    expect(bans[0]).toMatchObject({ liftedAt: NOW, liftedBy: "u_a" });
    expect(logs.map(parsed)).toEqual([
      expect.objectContaining({
        action: "warning.revoke",
        targetId: "u_m",
        detail: { note: null, warningId: "w_c" },
      }),
      expect.objectContaining({
        action: "warning.revoke",
        detail: { note: "Overturned", warningId: "w_b" },
      }),
      {
        actorId: "u_a",
        action: "ban.lift",
        targetType: "user",
        targetId: "u_m",
        scope: "site",
        scopeId: null,
        detail: { reason: "warning revoked", warningId: "w_b", points: 4, banId: "b_auto" },
      },
    ]);
  });
  it("takes the member's lock before revoking, and logs a revoke once when two requests race", async () => {
    const { db, tx, logs } = warnDb({ warnings: [warning({ id: "w_a", points: 1 })] });
    await revokeWarning(db as never, admin, { warningId: "w_a" });
    expectLockedFirst(tx, "u_m", tx.forumWarning.updateMany);
    await expect(revokeWarning(db as never, admin, { warningId: "w_a" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This warning is already revoked.",
    });
    expect(logs.map((l) => l.action)).toEqual(["warning.revoke"]);
  });
  it("never extends an automatic ban on a revoke, even with points above its tier", async () => {
    // 11 points under a 5-point ban (a manual site ban covered the 10 tier, then was lifted).
    const { db, bans, logs } = warnDb({
      warnings: [
        warning({ id: "w_a", points: 5 }),
        warning({ id: "w_b", points: 5 }),
        warning({ id: "w_c", points: 1 }),
      ],
      bans: [autoBan({ autoTier: 5 })],
    });
    expect(await revokeWarning(db as never, admin, { warningId: "w_c" })).toEqual({
      userId: "u_m",
      autoBan: null,
    });
    expect(bans[0]).toMatchObject({ autoTier: 5, expiresAt: days(5), liftedAt: null });
    expect(logs.map((l) => l.action)).toEqual(["warning.revoke"]);
  });

  it("refuses to revoke the actor's own warning, site admins included", async () => {
    const { db, logs } = warnDb({
      warnings: [
        warning({ id: "w_own", userId: "u_f", categoryId: "cat_eurth_hub" }),
        warning({ id: "w_admin", userId: "u_a" }),
      ],
    });
    const own = { code: "FORBIDDEN", message: "You can't revoke your own warning." };
    await expect(
      revokeWarning(db as never, realmMod, { warningId: "w_own" })
    ).rejects.toMatchObject(own);
    await expect(revokeWarning(db as never, admin, { warningId: "w_admin" })).rejects.toMatchObject(
      own
    );
    expect(logs).toEqual([]);
  });
});

describe("activePointsOf and listWarnings", () => {
  it("keeps other moderators to warnings issued in their categories", async () => {
    const { db } = warnDb();
    await listWarnings(db as never, realmMod, {}, 1);
    expect(db.forumWarning.findMany.mock.calls[0]).toEqual([
      expect.objectContaining({
        where: { AND: [{}, { categoryId: { in: ["cat_eurth_hub"] } }, {}] },
      }),
    ]);
  });
});

describe("bans", () => {
  const NOW = new Date("2026-10-09T12:00:00Z");
  const USER_ROLE = { name: "user", level: 100 };
  const ADMIN_ROLE = { name: "admin", level: 10 };
  const noMod = { siteAdmin: false, realmIds: [], categoryIds: [] };
  const admin = { id: "u_a", clerkUserId: "admin", countryId: null, role: ADMIN_ROLE };
  const member = { id: "u_m", clerkUserId: "member", countryId: "c1", role: USER_ROLE };
  const realmMod = {
    id: "u_f",
    clerkUserId: "founder",
    countryId: null,
    role: USER_ROLE,
    mod: { siteAdmin: false, realmIds: ["r_eurth"], categoryIds: [] },
  };
  const categoryMod = {
    id: "u_c",
    clerkUserId: "catmod",
    countryId: null,
    role: USER_ROLE,
    mod: { ...noMod, categoryIds: ["cat_general"] },
  };
  const users = [
    { id: "u_m", clerkUserId: "member", role: USER_ROLE },
    { id: "u_a2", clerkUserId: "admin2", role: ADMIN_ROLE },
    { id: "u_o", clerkUserId: "officer", role: USER_ROLE },
    { id: "u_c", clerkUserId: "catmod", role: USER_ROLE },
    { id: "u_b", clerkUserId: "beefounder", role: USER_ROLE },
    { id: "u_f", clerkUserId: "founder", role: USER_ROLE },
  ];
  const realms = [
    { id: "r_eurth", slug: "eurth", name: "Eurth", status: "archived", ownerId: "founder" },
    { id: "r_bee", slug: "bee", name: "Bee", status: "active", ownerId: "beefounder" },
  ];
  const officers = [{ realmId: "r_eurth", userId: "officer", powers: ["board"] }];
  const categoryModerators = [{ categoryId: "cat_general", userId: "u_c" }];
  const categories = [
    { id: "cat_general", scope: "site", realmId: null },
    { id: "cat_eurth_hub", scope: "realm", realmId: "r_eurth" },
  ];
  /** issueBan's duplicate check: a live manual ban on the member at one scope. */
  interface LiveBanWhere {
    userId: string;
    scope: string;
    scopeId: string | null;
    auto: false;
    liftedAt: null;
    OR: [{ expiresAt: null }, { expiresAt: { gt: Date } }];
  }
  const isLiveAt = (row: FakeBanRow, where: LiveBanWhere): boolean =>
    row.userId === where.userId &&
    row.scope === where.scope &&
    row.scopeId === where.scopeId &&
    row.auto === where.auto &&
    row.liftedAt === null &&
    (row.expiresAt === null || row.expiresAt > where.OR[1].expiresAt.gt);
  interface LiftUpdate {
    where: { id: string };
    data: { liftedAt: Date; liftedBy: string };
  }
  /** The member lock is a tagged template call: (strings, key). */
  type LockCall = [TemplateStringsArray, string];
  function banDb(opts: { bans?: FakeBanRow[]; ban?: FakeBanRow | null } = {}) {
    const tx = {
      $executeRaw: jest.fn(async (..._call: LockCall) => 0),
      forumBan: {
        findFirst: jest.fn(
          async ({ where }: { where: LiveBanWhere }) =>
            (opts.bans ?? []).find((row) => isLiveAt(row, where)) ?? null
        ),
        create: jest.fn(async ({ data }: { data: object }) => ({ id: "b_new", ...data })),
        // Lifts only a live row, as the conditional update does; the row changes, so a second lift finds nothing.
        updateMany: jest.fn(async ({ where, data }: LiftUpdate) => {
          const row = opts.ban;
          const live =
            row && row.liftedAt === null && (row.expiresAt === null || row.expiresAt > NOW);
          if (!row || !live || row.id !== where.id) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
      },
      forumModLog: { create: jest.fn(async () => ({ id: "log1" })) },
      // No warning points, so a site ban's lift re-tiers nothing (M2 is covered in mod-auto-ban-retier.test.ts).
      forumWarning: { findMany: jest.fn(async () => []) },
      // No open appeals here; mooting them is covered in mod-appeals.test.ts.
      forumAppeal: { findFirst: jest.fn(async () => null), updateMany: jest.fn() },
    };
    const db = {
      forumBan: {
        findMany: jest.fn(async ({ where }: { where: ActiveBanWhere }) =>
          (opts.bans ?? []).filter((b) => !("userId" in where) || matches(b, where))
        ),
        findUnique: jest.fn(async () => opts.ban ?? null),
        count: jest.fn(async () => (opts.bans ?? []).length),
      },
      // Appeal statuses for listBans; none unless a test says so.
      forumAppeal: {
        findMany: jest.fn(async (): Promise<Array<{ subjectId: string; status: string }>> => []),
      },
      forumCategory: {
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) =>
            categories.find((c) => c.id === where.id) ?? null
        ),
        findMany: jest.fn(async ({ where }: { where: { realmId: string | { in: string[] } } }) =>
          categories
            .filter((c) =>
              typeof where.realmId === "string"
                ? c.realmId === where.realmId
                : where.realmId.in.includes(c.realmId ?? "")
            )
            .map((c) => ({ id: c.id }))
        ),
      },
      user: {
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) =>
            users.find((u) => u.id === where.id) ?? null
        ),
      },
      realm: {
        findMany: jest.fn(async ({ where }: { where: { ownerId: string } }) =>
          realms.filter((r) => r.ownerId === where.ownerId).map((r) => ({ id: r.id }))
        ),
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) =>
            realms.find((r) => r.id === where.id) ?? null
        ),
      },
      realmOfficer: {
        findMany: jest.fn(
          async ({ where }: { where: { userId: string; powers: { has: string } } }) =>
            officers
              .filter((o) => o.userId === where.userId && o.powers.includes(where.powers.has))
              .map((o) => ({ realmId: o.realmId }))
        ),
      },
      forumCategoryModerator: {
        findMany: jest.fn(async ({ where }: { where: { userId: string } }) =>
          categoryModerators
            .filter((m) => m.userId === where.userId)
            .map((m) => ({ categoryId: m.categoryId }))
        ),
      },
      forumModLog: { create: jest.fn(async () => ({ id: "never" })) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<object | void>) => fn(tx)),
    };
    // issueBan checks the member is sanctionable under their lock (M9), through the transaction client.
    Object.assign(tx, {
      user: db.user,
      realm: db.realm,
      realmOfficer: db.realmOfficer,
      forumCategoryModerator: db.forumCategoryModerator,
    });
    return { db, tx };
  }
  const eurthHub = { id: "cat_eurth_hub", scope: "realm", realmId: "r_eurth" };
  const general = { id: "cat_general", scope: "site", realmId: null };
  const later = new Date(NOW.getTime() + DAY_MS);
  /** The member's lock is the transaction's first statement, keyed by the member. */
  function expectLockedFirst(
    tx: { $executeRaw: jest.Mock },
    userId: string,
    firstWrite: jest.Mock
  ): void {
    const [strings, key] = tx.$executeRaw.mock.calls[0] as LockCall;
    expect(strings.join("?")).toBe("SELECT pg_advisory_xact_lock(hashtext(?))");
    expect(key).toBe(`forum-member:${userId}`);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      firstWrite.mock.invocationCallOrder[0]!
    );
  }
  const earlier = new Date(NOW.getTime() - DAY_MS);
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());
  describe("activeBansFor", () => {
    it("leaves out expired, lifted and elsewhere bans", async () => {
      const { db } = banDb({
        bans: [
          ban({ id: "expired", expiresAt: earlier }),
          ban({ id: "lifted", liftedAt: earlier }),
          ban({ id: "bee", scope: "realm", scopeId: "r_bee" }),
          ban({ id: "other-category", scope: "category", scopeId: "cat_general" }),
          ban({ id: "live", scope: "realm", scopeId: "r_eurth", expiresAt: later }),
        ],
      });
      const bans = await activeBansFor(db as never, "u_m", eurthHub, NOW);
      expect(bans.map((b) => b.id)).toEqual(["live"]);
      expect(bans[0]).toMatchObject({
        scope: "realm",
        scopeId: "r_eurth",
        reason: "Spam",
        expiresAt: later,
        auto: false,
      });
    });
  });
  describe("postingBan and assertNotBanned", () => {
    it("refuses a banned member with the ban notice, and lets others through", async () => {
      const live = ban({
        scope: "realm",
        scopeId: "r_eurth",
        expiresAt: later,
        reason: "Flooding",
      });
      const { db } = banDb({ bans: [live] });
      await expect(assertNotBanned(db as never, member, eurthHub)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: banNotice({ scope: "realm", expiresAt: later, reason: "Flooding" }),
      });
      await expect(assertNotBanned(db as never, member, general)).resolves.toBeUndefined();
      await expect(assertNotBanned(db as never, admin, eurthHub)).resolves.toBeUndefined();
    });

    it("still binds a moderator with a stale ban row (M5)", async () => {
      const { db } = banDb({ bans: [ban({ userId: "u_f", scope: "realm", scopeId: "r_eurth" })] });
      expect(await postingBan(db as never, realmMod, eurthHub)).not.toBeNull();
    });
  });
  describe("issueBan", () => {
    const input = {
      userId: "u_m",
      reason: "  Spam  ",
      days: 7,
      scope: { kind: "realm", realmId: "r_eurth" },
    } as const;

    it("bans in the realm and logs it through the same transaction", async () => {
      const { db, tx } = banDb();
      expect(await issueBan(db as never, realmMod, input)).toEqual({
        banId: "b_new",
        expiresAt: new Date(NOW.getTime() + 7 * DAY_MS),
      });
      expect(tx.forumBan.create).toHaveBeenCalledWith({
        data: {
          userId: "u_m",
          scope: "realm",
          scopeId: "r_eurth",
          reason: "Spam",
          expiresAt: new Date(NOW.getTime() + 7 * DAY_MS),
          auto: false,
          issuedBy: "u_f",
        },
      });
      expect(tx.forumModLog.create).toHaveBeenCalledWith({
        data: {
          actorId: "u_f",
          action: "ban.issue",
          targetType: "user",
          targetId: "u_m",
          scope: "realm",
          scopeId: "r_eurth",
          detail: JSON.stringify({ banId: "b_new", days: 7, reason: "Spam" }),
        },
      });
      expect(db.forumModLog.create).not.toHaveBeenCalled();
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expectLockedFirst(tx, "u_m", tx.forumBan.create);
    });
    it("checks the member is no moderator here under their lock, so a grant in flight is seen (M9)", async () => {
      const { db, tx } = banDb();
      await issueBan(db as never, realmMod, {
        userId: "u_m",
        scope: { kind: "realm", realmId: "r_eurth" },
        reason: "Spam",
        days: 3,
      });
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        db.user.findUnique.mock.invocationCallOrder[0]!
      );
    });

    it("refuses a second live ban at the same scope, checked under the member's lock (M-1)", async () => {
      const live = ban({ id: "b_live", scope: "realm", scopeId: "r_eurth", expiresAt: later });
      const { db, tx } = banDb({ bans: [live] });
      await expect(issueBan(db as never, realmMod, input)).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Already banned here until 10 Oct 2026. Lift that ban to change it.",
      });
      expect(tx.forumBan.create).not.toHaveBeenCalled();
      expect(tx.forumModLog.create).not.toHaveBeenCalled();
      expectLockedFirst(tx, "u_m", tx.forumBan.findFirst);

      const permanent = banDb({ bans: [{ ...live, expiresAt: null }] });
      await expect(issueBan(permanent.db as never, realmMod, input)).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Already banned here permanently. Lift that ban to change it.",
      });
    });
    it("keeps site bans to site admins, and permanent bans have no expiry", async () => {
      const { db, tx } = banDb();
      const site = { ...input, scope: { kind: "site" }, days: null } as const;
      await expect(issueBan(db as never, realmMod, site)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(issueBan(db as never, admin, site)).resolves.toEqual({
        banId: "b_new",
        expiresAt: null,
      });
      expect(tx.forumBan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scope: "site",
          scopeId: null,
          expiresAt: null,
          issuedBy: "u_a",
        }),
      });
    });

    it("keeps realm moderators to their realm and its categories", async () => {
      const { db } = banDb();
      await expect(
        issueBan(db as never, realmMod, { ...input, scope: { kind: "realm", realmId: "r_bee" } })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        issueBan(db as never, realmMod, {
          ...input,
          scope: { kind: "category", categoryId: "cat_general" },
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        issueBan(db as never, realmMod, {
          ...input,
          scope: { kind: "category", categoryId: "cat_eurth_hub" },
        })
      ).resolves.toMatchObject({ banId: "b_new" });
      await expect(
        issueBan(db as never, categoryMod, {
          ...input,
          scope: { kind: "category", categoryId: "cat_general" },
        })
      ).resolves.toMatchObject({ banId: "b_new" });
    });
    it("never bans site admins or the scope's own moderators (M5)", async () => {
      const { db, tx } = banDb();
      await expect(
        issueBan(db as never, admin, { ...input, userId: "u_a2" })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Site admins can't be banned.",
      });
      for (const userId of ["u_o", "u_f"]) {
        await expect(issueBan(db as never, admin, { ...input, userId })).rejects.toMatchObject({
          code: "BAD_REQUEST",
          message: "Remove their moderator role first.",
        });
      }
      await expect(
        issueBan(db as never, admin, {
          ...input,
          userId: "u_c",
          scope: { kind: "category", categoryId: "cat_general" },
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Remove their moderator role first.",
      });
      expect(tx.forumBan.create).not.toHaveBeenCalled();
    });
  });
  describe("liftBan", () => {
    it("lifts a live ban and logs it in the same transaction", async () => {
      const { db, tx } = banDb({
        ban: ban({ scope: "realm", scopeId: "r_eurth", expiresAt: later }),
      });
      await expect(
        liftBan(db as never, realmMod, { banId: "b1", note: " Served " })
      ).resolves.toEqual({ userId: "u_m", scope: "realm", scopeId: "r_eurth", autoBan: null });
      expect(tx.forumBan.updateMany).toHaveBeenCalledWith({
        where: {
          id: "b1",
          liftedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
        },
        data: { liftedAt: NOW, liftedBy: "u_f" },
      });
      expectLockedFirst(tx, "u_m", tx.forumBan.updateMany);
      expect(tx.forumModLog.create).toHaveBeenCalledWith({
        data: {
          actorId: "u_f",
          action: "ban.lift",
          targetType: "user",
          targetId: "u_m",
          scope: "realm",
          scopeId: "r_eurth",
          detail: JSON.stringify({ note: "Served", banId: "b1" }),
        },
      });
      expect(db.forumModLog.create).not.toHaveBeenCalled();
    });
    it("refuses to lift the actor's own ban, site admins included", async () => {
      const own = { code: "FORBIDDEN", message: "You can't lift your own ban." };
      const founder = banDb({ ban: ban({ userId: "u_f", scope: "realm", scopeId: "r_eurth" }) });
      await expect(liftBan(founder.db as never, realmMod, { banId: "b1" })).rejects.toMatchObject(
        own
      );
      expect(founder.tx.forumBan.updateMany).not.toHaveBeenCalled();
      const siteAdmin = banDb({ ban: ban({ userId: "u_a" }) });
      await expect(liftBan(siteAdmin.db as never, admin, { banId: "b1" })).rejects.toMatchObject(
        own
      );
      expect(siteAdmin.tx.forumModLog.create).not.toHaveBeenCalled();
    });
    it("logs a lift once when two requests race (the check runs under the lock)", async () => {
      const { db, tx } = banDb({ ban: ban({}) });
      await liftBan(db as never, admin, { banId: "b1" });
      await expect(liftBan(db as never, admin, { banId: "b1" })).rejects.toMatchObject({
        code: "CONFLICT",
        message: "This ban is no longer active.",
      });
      expect(tx.forumModLog.create).toHaveBeenCalledTimes(1);
    });
  });
  describe("listBans", () => {
    it("refuses members", async () => {
      await expect(
        listBans(banDb().db as never, member, { active: true }, 1)
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });
});
