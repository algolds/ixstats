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
  reason?: string;
};
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
    forumWarning: {
      create: jest.fn(async ({ data }: { data: Omit<WarningRow, "id"> }) => {
        const row = { id: `w${++n}`, revokedAt: null, ...data };
        warnings.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        warnings.filter((w) => fits(w, where))
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<WarningRow> }) =>
          Object.assign(
            warnings.find((w) => w.id === where.id)!,
            data
          )
      ),
    },
    forumBan: {
      findFirst: jest.fn(
        async ({ where }: { where: Where }) => bans.find((b) => fits(b, where)) ?? null
      ),
      create: jest.fn(async ({ data }: { data: Omit<BanRow, "id" | "createdAt"> }) => {
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
    },
    forumModLog: {
      create: jest.fn(async ({ data }: { data: LogRow }) => {
        logs.push(data);
        return { id: `log${logs.length}` };
      }),
    },
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
    const { db, warnings, bans, logs } = warnDb();
    const outcome = await issueWarning(db as never, admin, sitewide);
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
    expect(outcome.autoBan).toEqual({ banId: "b2", days: 7, extended: false });
    expect(bans).toEqual([
      expect.objectContaining({
        userId: "u_m",
        scope: "site",
        scopeId: null,
        auto: true,
        issuedBy: "u_a",
        reason: "Automatic: 5 active warning points",
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
      detail: { banId: "b2", days: 7, points: 5, trigger: "warning" },
    });
  });

  it("bans for 30 days at 10 active points", async () => {
    const { db, bans } = warnDb({ warnings: [warning({ points: 5, expiresAt: days(80) })] });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 5 });
    expect(outcome).toMatchObject({ activePoints: 10, autoBan: { days: 30, extended: false } });
    expect(bans[0]).toMatchObject({
      expiresAt: days(30),
      reason: "Automatic: 10 active warning points",
    });
  });

  it("extends an active automatic ban to the later tier instead of stacking a second one (M3)", async () => {
    const { db, tx, bans, logs } = warnDb({
      warnings: [warning({ id: "w_a", points: 5 }), warning({ id: "w_b", points: 2 })],
      bans: [autoBan({})],
    });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 3 });
    expect(outcome).toEqual({
      warningId: "w1",
      activePoints: 10,
      autoBan: { banId: "b_auto", days: 30, extended: true },
    });
    expect(tx.forumBan.create).not.toHaveBeenCalled();
    expect(bans).toEqual([
      expect.objectContaining({
        id: "b_auto",
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
        trigger: "warning",
        from: days(5).toISOString(),
        to: days(30).toISOString(),
      },
    });
  });

  it("leaves a longer automatic ban alone", async () => {
    const { db, tx, logs } = warnDb({
      warnings: [warning({ points: 5 })],
      bans: [autoBan({ expiresAt: days(20) })],
    });
    const outcome = await issueWarning(db as never, admin, { ...sitewide, points: 1 });
    expect(outcome.autoBan).toBeNull();
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
    expect(outcome).toMatchObject({ activePoints: 5, autoBan: { days: 7 } });
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
  it("keeps the automatic ban while points stay at its tier, and lifts it when they fall under (M3)", async () => {
    const { db, logs, bans } = warnDb({
      warnings: [warning({ id: "w_a", points: 5 }), warning({ id: "w_b", points: 2 })],
      bans: [autoBan({ createdAt: days(-2), expiresAt: days(5) })],
    });
    expect(await revokeWarning(db as never, admin, { warningId: "w_b" })).toEqual({
      liftedAutoBanId: null,
    });
    expect(bans[0]!.liftedAt).toBeNull();
    expect(
      await revokeWarning(db as never, admin, { warningId: "w_a", note: " Overturned " })
    ).toEqual({
      liftedAutoBanId: "b_auto",
    });
    expect(bans[0]).toMatchObject({ liftedAt: NOW, liftedBy: "u_a" });
    expect(logs.map(parsed)).toEqual([
      expect.objectContaining({
        action: "warning.revoke",
        targetId: "u_m",
        detail: { note: null, warningId: "w_b" },
      }),
      expect.objectContaining({
        action: "warning.revoke",
        detail: { note: "Overturned", warningId: "w_a" },
      }),
      {
        actorId: "u_a",
        action: "ban.lift",
        targetType: "user",
        targetId: "u_m",
        scope: "site",
        scopeId: null,
        detail: { reason: "warning revoked", warningId: "w_a", points: 0, banId: "b_auto" },
      },
    ]);
    expect(db.forumModLog.create).not.toHaveBeenCalled();
  });

  it("lifts a 30-day ban when points fall to the 7-day tier", async () => {
    const { db } = warnDb({
      warnings: [warning({ id: "w_a", points: 5 }), warning({ id: "w_b", points: 5 })],
      bans: [autoBan({ createdAt: NOW, expiresAt: days(30) })],
    });
    expect(await revokeWarning(db as never, admin, { warningId: "w_b" })).toEqual({
      liftedAutoBanId: "b_auto",
    });
  });

  it("reads an extended ban's tier from its length and keeps it while points hold", async () => {
    const { db } = warnDb({
      warnings: [
        warning({ id: "w_a", points: 5 }),
        warning({ id: "w_b", points: 5 }),
        warning({ id: "w_c", points: 1 }),
      ],
      bans: [autoBan({ createdAt: days(-3), expiresAt: days(30) })],
    });
    expect(await revokeWarning(db as never, admin, { warningId: "w_c" })).toEqual({
      liftedAutoBanId: null,
    });
  });

  it("reads an automatic ban shorter than any tier as the lowest tier", async () => {
    const { db } = warnDb({
      warnings: [warning({ id: "w_a", points: 5 }), warning({ id: "w_b", points: 1 })],
      bans: [autoBan({ createdAt: days(-1), expiresAt: days(2) })],
    });
    expect(await revokeWarning(db as never, admin, { warningId: "w_b" })).toEqual({
      liftedAutoBanId: null,
    });
  });

  it("marks the warning revoked by the actor", async () => {
    const { db, warnings } = warnDb({
      warnings: [warning({ id: "w_a", categoryId: "cat_eurth_hub" })],
    });
    await revokeWarning(db as never, realmMod, { warningId: "w_a" });
    expect(warnings[0]).toMatchObject({ revokedAt: NOW, revokedBy: "u_f" });
  });

  it("keeps moderators to their scope and refuses unknown or revoked warnings", async () => {
    const { db, tx } = warnDb({
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
    expect(tx.forumWarning.update).not.toHaveBeenCalled();
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
