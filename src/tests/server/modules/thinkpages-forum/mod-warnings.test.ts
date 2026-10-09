/** @jest-environment node */
import { DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import {
  activePointsOf,
  issueWarning,
  listWarnings,
  revokeWarning,
  WARNINGS_PER_PAGE,
} from "~/server/modules/thinkpages-forum";

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
];
const posts = [{ id: "p_eurth", authorUserId: "u_m", thread: { category: eurthHub } }];

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

describe("issueWarning", () => {
  const sitewide = { userId: "u_m", reason: " Rude ", points: 4 };

  it("records a warning for 90 days and logs it in the same transaction, without a ban under 5 points", async () => {
    const { db, tx, warnings, bans, logs } = warnDb();
    const outcome = await issueWarning(db as never, admin, sitewide);
    expectLockedFirst(tx, "u_m", tx.forumWarning.create);
    expect(outcome).toEqual({ warningId: "w1", activePoints: 4, autoBan: null });
    expect(warnings[0]).toMatchObject({
      userId: "u_m",
      issuedBy: "u_a",
      reason: "Rude",
      points: 4,
      targetType: null,
      targetId: null,
      categoryId: null,
      createdAt: NOW,
      expiresAt: days(90),
    });
    expect(bans).toEqual([]);
    expect(logs.map(parsed)).toEqual([
      {
        actorId: "u_a",
        action: "warning.issue",
        targetType: "user",
        targetId: "u_m",
        scope: "site",
        scopeId: null,
        detail: { warningId: "w1", points: 4, reason: "Rude", targetType: null, targetId: null },
      },
    ]);
    expect(db.forumModLog.create).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("bans for 7 days sitewide at 5 active points, issued by the warning's issuer (M2)", async () => {
    const { db, bans, logs } = warnDb();
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 5 });
    expect(outcome.autoBan).toEqual({
      kind: "issued",
      banId: "b2",
      autoTier: 5,
      days: 7,
      expiresAt: days(7),
      reason: "Automatic: 5 active warning points",
    });
    expect(bans).toEqual([
      expect.objectContaining({
        userId: "u_m",
        scope: "site",
        scopeId: null,
        auto: true,
        autoTier: 5,
        issuedBy: "u_a",
        reason: "Automatic: 5 active warning points",
        createdAt: NOW,
        expiresAt: days(7),
      }),
    ]);
    expect(parsed(logs[1])).toEqual({
      actorId: "u_a",
      action: "ban.auto",
      targetType: "user",
      targetId: "u_m",
      scope: "site",
      scopeId: null,
      detail: { banId: "b2", days: 7, points: 5, autoTier: 5, trigger: "warning", warningId: "w1" },
    });
  });

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

  it("gives the 30-day tier in full when 10 points are reached on day 6 of a 7-day ban", async () => {
    const { db, bans } = warnDb({
      warnings: [warning({ id: "w_a", points: 5 }), warning({ id: "w_b", points: 2 })],
      bans: [autoBan({ createdAt: days(-6), expiresAt: days(1), autoTier: 5 })],
    });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 3 });
    expect(outcome.autoBan).toMatchObject({ kind: "extended", autoTier: 10, expiresAt: days(30) });
    expect(bans[0]).toMatchObject({ autoTier: 10, expiresAt: days(30), createdAt: days(-6) });
  });

  it("never brings an automatic ban's end forward when crossing up", async () => {
    const { db, bans } = warnDb({
      warnings: [warning({ id: "w_a", points: 5 }), warning({ id: "w_b", points: 2 })],
      bans: [autoBan({ createdAt: days(-1), expiresAt: days(40), autoTier: 5 })],
    });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 3 });
    expect(outcome.autoBan).toMatchObject({ kind: "extended", autoTier: 10, expiresAt: days(40) });
    expect(bans[0]).toMatchObject({ autoTier: 10, expiresAt: days(40) });
  });

  it("never lifts an active automatic ban when expired points leave a new warning's count under every tier", async () => {
    // Day 91: 3 points (day 0) have expired, 2 points (day 85) remain; the 7-day ban from day 85 still runs.
    const { db, tx, bans, logs } = warnDb({
      warnings: [
        warning({ points: 3, expiresAt: days(-1) }),
        warning({ points: 2, expiresAt: days(84) }),
      ],
      bans: [autoBan({ createdAt: days(-6), expiresAt: days(1), autoTier: 5 })],
    });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 1 });
    expect(outcome).toEqual({ warningId: "w1", activePoints: 3, autoBan: null });
    expect(bans[0]).toMatchObject({ liftedAt: null, expiresAt: days(1), autoTier: 5 });
    expect(tx.forumBan.update).not.toHaveBeenCalled();
    expect(tx.forumBan.updateMany).not.toHaveBeenCalled();
    expect(logs.map((l) => l.action)).toEqual(["warning.issue"]);
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

  it("leaves the automatic ban's expiry alone when a new warning stays in its tier", async () => {
    const { db, tx, bans, logs } = warnDb({
      warnings: [warning({ points: 5 })],
      bans: [autoBan({ createdAt: days(-2), expiresAt: days(5), autoTier: 5 })],
    });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 1 });
    expect(outcome).toMatchObject({ activePoints: 6, autoBan: null });
    expect(bans[0]).toMatchObject({ expiresAt: days(5), autoTier: 5 });
    expect(tx.forumBan.update).not.toHaveBeenCalled();
    expect(tx.forumBan.create).not.toHaveBeenCalled();
    expect(logs.map((l) => l.action)).toEqual(["warning.issue"]);
  });

  it("counts only unexpired, unrevoked points, sitewide", async () => {
    const { db, tx } = warnDb({
      warnings: [
        warning({ points: 3, expiresAt: days(-1) }),
        warning({ points: 3, revokedAt: days(-1) }),
        warning({ points: 3, expiresAt: NOW }),
        warning({ points: 1, userId: "u_other" }),
      ],
    });
    const outcome = await issueWarning(db as never, admin, sitewide);
    expect(outcome).toEqual({ warningId: "w1", activePoints: 4, autoBan: null });
    expect(tx.forumWarning.findMany).toHaveBeenCalledWith({
      where: { userId: "u_m", revokedAt: null, expiresAt: { gt: NOW } },
      select: { points: true, expiresAt: true, revokedAt: true },
    });
  });

  it("lets a realm moderator warn on their realm's content for up to 2 points, which count sitewide (M4)", async () => {
    const { db, warnings, bans, logs } = warnDb({ warnings: [warning({ points: 3 })] });
    const input = {
      userId: "u_m",
      reason: "Spam",
      points: 2,
      target: { type: "post", id: "p_eurth" },
    } as const;
    const outcome = await issueWarning(db as never, realmMod, input);
    expect(outcome).toMatchObject({ activePoints: 5, autoBan: { kind: "issued", days: 7 } });
    expect(warnings[1]).toMatchObject({
      issuedBy: "u_f",
      targetType: "post",
      targetId: "p_eurth",
      categoryId: "cat_eurth_hub",
    });
    expect(bans[0]).toMatchObject({ issuedBy: "u_f", auto: true });
    expect(parsed(logs[0])).toMatchObject({
      action: "warning.issue",
      scope: "category",
      scopeId: "cat_eurth_hub",
      detail: { points: 2, targetType: "post", targetId: "p_eurth" },
    });
    expect(logs[1]).toMatchObject({ action: "ban.auto", actorId: "u_f" });
    await expect(
      issueWarning(db as never, realmMod, { ...input, points: 3 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("works on content in an archived realm's section (T0-6)", async () => {
    const { db } = warnDb();
    const input = {
      userId: "u_m",
      reason: "Spam",
      points: 1,
      target: { type: "thread", id: "t_eurth" },
    } as const;
    await expect(issueWarning(db as never, realmMod, input)).resolves.toMatchObject({
      activePoints: 1,
    });
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

  it("checks the reason and the points", async () => {
    const { db } = warnDb();
    for (const bad of [
      { reason: "  " },
      { reason: "x".repeat(1001) },
      { points: 0 },
      { points: 6 },
      { points: 1.5 },
    ]) {
      await expect(issueWarning(db as never, admin, { ...sitewide, ...bad })).rejects.toMatchObject(
        {
          code: "BAD_REQUEST",
        }
      );
    }
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

  it("measures a downgrade after an upgrade from the ban's original start", async () => {
    const { db, bans } = warnDb({
      warnings: [warning({ id: "w_a", points: 5 }), warning({ id: "w_b", points: 2 })],
      bans: [autoBan({ createdAt: days(-6), expiresAt: days(1), autoTier: 5 })],
    });
    await issueWarning(db as never, admin, { userId: "u_m", reason: "Rude", points: 3 });
    expect(bans[0]).toMatchObject({ autoTier: 10, expiresAt: days(30) });
    expect(await revokeWarning(db as never, admin, { warningId: "w1" })).toEqual({
      userId: "u_m",
      autoBan: {
        kind: "shortened",
        banId: "b_auto",
        autoTier: 5,
        days: 7,
        expiresAt: days(1),
        reason: "Automatic: 7 active warning points",
      },
    });
    expect(bans[0]).toMatchObject({ autoTier: 5, expiresAt: days(1), liftedAt: null });
  });

  it("reads the tier from autoTier, not from the ban's length", async () => {
    const stretched = warnDb({
      warnings: [warning({ id: "w_a", points: 5 }), warning({ id: "w_b", points: 1 })],
      bans: [autoBan({ createdAt: days(-2), expiresAt: days(28), autoTier: 5 })],
    });
    expect(await revokeWarning(stretched.db as never, admin, { warningId: "w_b" })).toEqual({
      userId: "u_m",
      autoBan: null,
    });
    expect(stretched.bans[0]).toMatchObject({ expiresAt: days(28), liftedAt: null });
    const short = warnDb({
      warnings: [...tenPoints(), warning({ id: "w_d", points: 1 })],
      bans: [autoBan({ createdAt: days(-2), expiresAt: days(5), autoTier: 10 })],
    });
    expect(await revokeWarning(short.db as never, admin, { warningId: "w_d" })).toEqual({
      userId: "u_m",
      autoBan: null,
    });
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

  it("never issues an automatic ban on a revoke", async () => {
    const { db, tx } = warnDb({ warnings: [...tenPoints(), warning({ id: "w_d", points: 1 })] });
    expect(await revokeWarning(db as never, admin, { warningId: "w_d" })).toEqual({
      userId: "u_m",
      autoBan: null,
    });
    expect(tx.forumBan.create).not.toHaveBeenCalled();
  });

  it("marks the warning revoked by the actor", async () => {
    const { db, warnings } = warnDb({
      warnings: [warning({ id: "w_a", categoryId: "cat_eurth_hub" })],
    });
    await revokeWarning(db as never, realmMod, { warningId: "w_a" });
    expect(warnings[0]).toMatchObject({ revokedAt: NOW, revokedBy: "u_f" });
  });

  it("keeps moderators to their scope and refuses unknown or revoked warnings", async () => {
    const { db, logs } = warnDb({
      warnings: [
        warning({ id: "w_site" }),
        warning({ id: "w_general", categoryId: "cat_general" }),
        warning({ id: "w_done", categoryId: "cat_eurth_hub", revokedAt: days(-1) }),
      ],
    });
    await expect(
      revokeWarning(db as never, realmMod, { warningId: "w_site" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      revokeWarning(db as never, realmMod, { warningId: "w_general" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(revokeWarning(db as never, admin, { warningId: "w_nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      revokeWarning(db as never, realmMod, { warningId: "w_done" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(logs).toEqual([]);
  });
});

describe("activePointsOf and listWarnings", () => {
  it("sums a member's live points", async () => {
    const { tx } = warnDb({
      warnings: [warning({ points: 2 }), warning({ points: 3, expiresAt: days(-1) })],
    });
    expect(await activePointsOf(tx as never, "u_m", NOW)).toBe(2);
  });

  it("refuses members", async () => {
    await expect(listWarnings(warnDb().db as never, member, {}, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lists a site admin's warnings, newest first, live ones only on request", async () => {
    const { db } = warnDb({ warnings: [warning({})] });
    const result = await listWarnings(db as never, admin, { userId: "u_m", activeOnly: true }, 2);
    expect(db.forumWarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ revokedAt: null, expiresAt: { gt: NOW } }, {}, { userId: "u_m" }] },
        orderBy: { createdAt: "desc" },
        skip: WARNINGS_PER_PAGE,
        take: WARNINGS_PER_PAGE,
      })
    );
    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
  });

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
