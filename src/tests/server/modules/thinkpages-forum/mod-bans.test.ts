/** @jest-environment node */
import { banNotice, DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import {
  activeBansFor,
  assertNotBanned,
  BANS_PER_PAGE,
  issueBan,
  liftBan,
  listBans,
  postingBan,
} from "~/server/modules/thinkpages-forum";
import {
  banRow as ban,
  matchesActiveBan as matches,
  type ActiveBanWhere,
  type BanRow,
} from "~/tests/helpers/forum-ban-fake";

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

interface LiftUpdate {
  where: { id: string };
  data: { liftedAt: Date; liftedBy: string };
}

/** The member lock is a tagged template call: (strings, key). */
type LockCall = [TemplateStringsArray, string];

function banDb(opts: { bans?: BanRow[]; ban?: BanRow | null } = {}) {
  const tx = {
    $executeRaw: jest.fn(async (..._call: LockCall) => 0),
    forumBan: {
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
        async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null
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
      findMany: jest.fn(async ({ where }: { where: { userId: string; powers: { has: string } } }) =>
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
  it("asks for live bans on the site, the realm and the category in one query", async () => {
    const { db } = banDb();
    await activeBansFor(db as never, "u_m", eurthHub, NOW);
    expect(db.forumBan.findMany).toHaveBeenCalledWith({
      where: {
        userId: "u_m",
        liftedAt: null,
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }] },
          {
            OR: [
              { scope: "site" },
              { scope: "realm", scopeId: "r_eurth" },
              { scope: "category", scopeId: "cat_eurth_hub" },
            ],
          },
        ],
      },
      select: { id: true, scope: true, scopeId: true, reason: true, expiresAt: true, auto: true },
    });
  });

  it("asks for the realm only for a whole section, and no realm for a sitewide category", async () => {
    const { db } = banDb();
    await activeBansFor(db as never, "u_m", { id: null, scope: "realm", realmId: "r_eurth" }, NOW);
    await activeBansFor(db as never, "u_m", general, NOW);
    const places = db.forumBan.findMany.mock.calls.map((c) => c[0].where.AND[1].OR);
    expect(places).toEqual([
      [{ scope: "site" }, { scope: "realm", scopeId: "r_eurth" }],
      [{ scope: "site" }, { scope: "category", scopeId: "cat_general" }],
    ]);
  });

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
  it("returns the strongest live ban", async () => {
    const { db } = banDb({
      bans: [
        ban({ id: "category", scope: "category", scopeId: "cat_eurth_hub" }),
        ban({ id: "site", expiresAt: later }),
        ban({ id: "realm", scope: "realm", scopeId: "r_eurth" }),
      ],
    });
    expect((await postingBan(db as never, member, eurthHub))?.id).toBe("site");
  });

  it("never bans site admins or anonymous viewers, and spends no query on them (M5)", async () => {
    const { db } = banDb({ bans: [ban({ userId: "u_a" })] });
    expect(await postingBan(db as never, admin, eurthHub)).toBeNull();
    expect(await postingBan(db as never, null, eurthHub)).toBeNull();
    expect(db.forumBan.findMany).not.toHaveBeenCalled();
  });

  it("refuses a banned member with the ban notice, and lets others through", async () => {
    const live = ban({ scope: "realm", scopeId: "r_eurth", expiresAt: later, reason: "Flooding" });
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

  it("works in an archived realm (T0-6)", async () => {
    const { db } = banDb();
    expect(realms.find((r) => r.id === "r_eurth")?.status).toBe("archived");
    await expect(issueBan(db as never, realmMod, input)).resolves.toMatchObject({ banId: "b_new" });
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

  it("refuses anonymous actors, unknown places and unknown members", async () => {
    const { db, tx } = banDb();
    await expect(issueBan(db as never, null, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      issueBan(db as never, admin, { ...input, scope: { kind: "category", categoryId: "nope" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      issueBan(db as never, admin, { ...input, scope: { kind: "realm", realmId: "r_nope" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      issueBan(db as never, admin, { ...input, userId: "u_nope" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(tx.forumBan.create).not.toHaveBeenCalled();
  });

  it("never bans site admins or the scope's own moderators (M5)", async () => {
    const { db, tx } = banDb();
    await expect(issueBan(db as never, admin, { ...input, userId: "u_a2" })).rejects.toMatchObject({
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Remove their moderator role first." });
    expect(tx.forumBan.create).not.toHaveBeenCalled();
  });

  it("lets a moderator of another place be banned here, and a realm moderator be banned sitewide", async () => {
    const { db } = banDb();
    await expect(issueBan(db as never, admin, { ...input, userId: "u_b" })).resolves.toMatchObject({
      banId: "b_new",
    });
    await expect(issueBan(db as never, admin, { ...input, userId: "u_c" })).resolves.toMatchObject({
      banId: "b_new",
    });
    await expect(
      issueBan(db as never, admin, { ...input, userId: "u_o", scope: { kind: "site" } })
    ).resolves.toMatchObject({ banId: "b_new" });
  });

  it("checks the reason and the length", async () => {
    const { db, tx } = banDb();
    for (const bad of [
      { reason: "   " },
      { reason: "x".repeat(1001) },
      { days: 0 },
      { days: 3651 },
      { days: 1.5 },
    ]) {
      await expect(issueBan(db as never, admin, { ...input, ...bad })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    await expect(issueBan(db as never, admin, { ...input, days: 3650 })).resolves.toMatchObject({
      banId: "b_new",
    });
    expect(tx.forumBan.create).toHaveBeenCalledTimes(1);
  });
});

describe("liftBan", () => {
  it("lifts a live ban and logs it in the same transaction", async () => {
    const { db, tx } = banDb({
      ban: ban({ scope: "realm", scopeId: "r_eurth", expiresAt: later }),
    });
    await expect(
      liftBan(db as never, realmMod, { banId: "b1", note: " Served " })
    ).resolves.toEqual({ userId: "u_m", scope: "realm", scopeId: "r_eurth" });
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

  it("lets a realm moderator lift a ban in one of the realm's categories", async () => {
    const { db, tx } = banDb({ ban: ban({ scope: "category", scopeId: "cat_eurth_hub" }) });
    await liftBan(db as never, realmMod, { banId: "b1" });
    expect(tx.forumModLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: "category",
        scopeId: "cat_eurth_hub",
        detail: '{"note":null,"banId":"b1"}',
      }),
    });
  });

  it("leaves a ban in a deleted category to site admins", async () => {
    const gone = ban({ scope: "category", scopeId: "cat_deleted" });
    await expect(
      liftBan(banDb({ ban: gone }).db as never, realmMod, { banId: "b1" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const { db, tx } = banDb({ ban: gone });
    await liftBan(db as never, admin, { banId: "b1" });
    expect(tx.forumModLog.create).toHaveBeenCalledTimes(1);
  });

  it("refuses an over-long note", async () => {
    const { db, tx } = banDb({ ban: ban({}) });
    await expect(
      liftBan(db as never, admin, { banId: "b1", note: "x".repeat(1001) })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(tx.forumBan.updateMany).not.toHaveBeenCalled();
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

  it("refuses unknown, out-of-scope and finished bans", async () => {
    await expect(liftBan(banDb().db as never, admin, { banId: "b1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      liftBan(banDb({ ban: ban({}) }).db as never, realmMod, { banId: "b1" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    for (const finished of [ban({ liftedAt: earlier }), ban({ expiresAt: earlier })]) {
      const { db, tx } = banDb({ ban: finished });
      await expect(liftBan(db as never, admin, { banId: "b1" })).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(tx.forumModLog.create).not.toHaveBeenCalled();
    }
  });
});

describe("listBans", () => {
  const listed = {
    ...ban({ scope: "realm", scopeId: "r_eurth" }),
    issuedBy: "u_f",
    liftedBy: null,
    createdAt: earlier,
  };

  it("refuses members", async () => {
    await expect(listBans(banDb().db as never, member, { active: true }, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lists a site admin's live bans, newest first, a page at a time", async () => {
    const { db } = banDb({ bans: [listed] });
    const result = await listBans(db as never, admin, { active: true, userId: "u_m" }, 2);
    const live = { liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }] };
    expect(db.forumBan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [live, {}, { userId: "u_m" }] },
        orderBy: { createdAt: "desc" },
        skip: BANS_PER_PAGE,
        take: BANS_PER_PAGE,
      })
    );
    expect(result).toEqual({ rows: [{ ...listed }], total: 1 });
  });

  it("lists finished bans and keeps other moderators to their scope", async () => {
    const { db } = banDb();
    await listBans(db as never, realmMod, { active: false }, 1);
    expect(db.forumBan.findMany.mock.calls[0]![0].where).toEqual({
      AND: [
        { OR: [{ liftedAt: { not: null } }, { expiresAt: { lte: NOW } }] },
        {
          OR: [
            { scope: "realm", scopeId: { in: ["r_eurth"] } },
            { scope: "category", scopeId: { in: ["cat_eurth_hub"] } },
          ],
        },
        {},
      ],
    });
  });
});
