/** @jest-environment node */
import { Prisma } from "@prisma/client";
import {
  fileAppeal,
  liftBan,
  reviewAppeal,
  revokeWarning,
} from "~/server/modules/thinkpages-forum";
import { appeal, ban, bans, days, NOW, warnings } from "~/tests/helpers/forum-appeal-fixtures";
import {
  admin,
  admin2,
  categories,
  eurthMod,
  member,
  moderatorOf,
  realms,
  users,
} from "~/tests/helpers/forum-mod-fixtures";
import { detailOf, forumStore, type Row } from "~/tests/helpers/forum-store-fake";
import { DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import { issueWarning, listBans } from "~/server/modules/thinkpages-forum";
import { warning } from "~/tests/helpers/forum-appeal-fixtures";
import { listAppeals } from "~/server/modules/thinkpages-forum";
import { myStanding } from "~/server/modules/thinkpages-forum";
const eurthMod2 = moderatorOf("u_eurth2", ["r_eurth"]);
const auroraMod = moderatorOf("u_aur", ["r_aurora"]);

const storeWith = (seed: { appeals?: Row[]; logs?: Row[]; bans?: Row[] } = {}) =>
  forumStore({ categories, realms, users, warnings, bans, ...seed });
type Store = ReturnType<typeof storeWith>;
const appealIn = (store: Store, id: string) => store.state.appeals.find((a) => a.id === id)!;
const banIn = (store: Store, id: string) => store.state.bans.find((b) => b.id === id)!;
const warningIn = (store: Store, id: string) => store.state.warnings.find((w) => w.id === id)!;

/** The member's lock is the transaction's first statement, keyed by the member. */
function expectLockedFirst(store: Store, userId: string, firstWrite: jest.Mock): void {
  const [strings, key] = store.tx.$executeRaw.mock.calls[0]!;
  expect(strings.join("?")).toBe("SELECT pg_advisory_xact_lock(hashtext(?))");
  expect(key).toBe(`forum-member:${userId}`);
  expect(store.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
    firstWrite.mock.invocationCallOrder[0]!
  );
}

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe("fileAppeal", () => {
  const body = "  I was quoting the other post, not insulting anyone.  ";

  it("files one appeal on the member's own active warning under the member's lock, with no log row", async () => {
    const store = storeWith();
    const result = await fileAppeal(store.db as never, member, {
      subjectType: "warning",
      subjectId: "w_eurth",
      body,
    });
    expect(store.state.appeals).toEqual([
      expect.objectContaining({
        id: result.appealId,
        subjectType: "warning",
        subjectId: "w_eurth",
        userId: "u_m",
        body: "I was quoting the other post, not insulting anyone.",
        status: "open",
      }),
    ]);
    expectLockedFirst(store, "u_m", store.tx.forumAppeal.create);
    expect(store.logs).toEqual([]);
  });
  it.each([["someone else's ban", "ban", "b_other"]] as const)(
    "refuses %s with one message (BAD_REQUEST)",
    async (_case, subjectType, subjectId) => {
      const store = storeWith();
      await expect(
        fileAppeal(store.db as never, member, { subjectType, subjectId, body })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "You can only appeal your own warnings and bans.",
      });
      expect(store.state.appeals).toEqual([]);
    }
  );

  it.each([["a lifted ban", "ban", "b_lifted", "This ban is no longer active."]] as const)(
    "refuses %s (M12, BAD_REQUEST)",
    async (_case, subjectType, subjectId, message) => {
      const store = storeWith();
      await expect(
        fileAppeal(store.db as never, member, { subjectType, subjectId, body })
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message });
      expect(store.state.appeals).toEqual([]);
    }
  );
  it.each([["open"]])(
    "refuses a second appeal on the same subject when the first is %s (CONFLICT)",
    async (status) => {
      const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm", { status })] });
      await expect(
        fileAppeal(store.db as never, member, { subjectType: "ban", subjectId: "b_realm", body })
      ).rejects.toMatchObject({ code: "CONFLICT", message: "You have already appealed this ban." });
      expect(store.state.appeals).toHaveLength(1);
      expect(store.tx.forumAppeal.create).not.toHaveBeenCalled();
    }
  );
  it("maps a racing duplicate (unique violation) to CONFLICT", async () => {
    const store = storeWith();
    store.tx.forumAppeal.create.mockRejectedValueOnce(uniqueViolation());
    await expect(
      fileAppeal(store.db as never, member, { subjectType: "warning", subjectId: "w_site", body })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "You have already appealed this warning.",
    });
  });
  it.each([
    ["9 characters padded with spaces", "   123456789   ", false],
    ["4001 characters", "x".repeat(4001), false],
  ])("takes a body of %s: %s", async (_case, text, ok) => {
    const store = storeWith();
    const filing = fileAppeal(store.db as never, member, {
      subjectType: "ban",
      subjectId: "b_realm",
      body: text,
    });
    if (ok) await expect(filing).resolves.toEqual({ appealId: expect.any(String) });
    else {
      await expect(filing).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "An appeal is 10 to 4000 characters.",
      });
      expect(store.db.$transaction).not.toHaveBeenCalled();
    }
  });
});

describe("reviewAppeal", () => {
  const upheld = { outcome: "upheld" as const, response: "  The ban stands.  " };
  const overturned = { outcome: "overturned" as const, response: "Fair point, lifted." };

  it("upholds: another moderator in scope records the decision and logs it at the subject's scope", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm")] });
    const result = await reviewAppeal(store.db as never, eurthMod2, { appealId: "a1", ...upheld });
    expect(result).toEqual({ userId: "u_m", subjectType: "ban", outcome: "upheld", autoBan: null });
    expect(appealIn(store, "a1")).toMatchObject({
      status: "upheld",
      reviewedBy: "u_eurth2",
      reviewedAt: NOW,
      response: "The ban stands.",
    });
    expect(banIn(store, "b_realm")).toMatchObject({ liftedAt: null });
    expect(store.logs).toEqual([
      expect.objectContaining({
        actorId: "u_eurth2",
        action: "appeal.review",
        targetType: "appeal",
        targetId: "a1",
        scope: "realm",
        scopeId: "r_eurth",
      }),
    ]);
    expect(detailOf(store.logs[0])).toEqual({
      outcome: "upheld",
      subjectType: "ban",
      subjectId: "b_realm",
    });
    expect(store.db.forumModLog.create).not.toHaveBeenCalled();
    expectLockedFirst(store, "u_m", store.tx.forumAppeal.updateMany);
  });
  it("refuses the issuer of a direct ban (FORBIDDEN) and writes nothing", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm")] });
    await expect(
      reviewAppeal(store.db as never, eurthMod, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Another moderator must review this appeal.",
    });
    expect(appealIn(store, "a1")).toMatchObject({ status: "open", reviewedBy: null });
    expect(banIn(store, "b_realm")).toMatchObject({ liftedAt: null });
    expect(store.logs).toEqual([]);
  });
  it("refuses the issuer of an automatic ban, who is the moderator whose warning crossed the tier (M2)", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_auto")] });
    await expect(
      reviewAppeal(store.db as never, admin, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Another moderator must review this appeal.",
    });
    await expect(
      reviewAppeal(store.db as never, admin2, { appealId: "a1", ...upheld })
    ).resolves.toMatchObject({ outcome: "upheld" });
  });
  it("refuses the appellant, even one who has since become a moderator of the scope", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm")] });
    const promoted = { ...moderatorOf("u_m", ["r_eurth"]), clerkUserId: "member" };
    await expect(
      reviewAppeal(store.db as never, promoted, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "You can't review your own appeal." });
    expect(banIn(store, "b_realm")).toMatchObject({ liftedAt: null });
  });

  it.each([
    ["a moderator of another realm on a realm ban", auroraMod, "ban", "b_realm"],
    ["a realm moderator on a site ban", eurthMod2, "ban", "b_site"],
    ["a member", member, "ban", "b_realm"],
    ["a signed-out viewer", null, "ban", "b_realm"],
  ] as const)("refuses %s (FORBIDDEN)", async (_case, viewer, subjectType, subjectId) => {
    const store = storeWith({ appeals: [appeal("a1", subjectType, subjectId)] });
    await expect(
      reviewAppeal(store.db as never, viewer, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(appealIn(store, "a1")).toMatchObject({ status: "open" });
    expect(store.logs).toEqual([]);
  });
  it("overturning a ban lifts it in the same transaction: the appeal, the lift and two log rows", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm")] });
    const result = await reviewAppeal(store.db as never, eurthMod2, {
      appealId: "a1",
      ...overturned,
    });
    expect(result).toEqual({
      userId: "u_m",
      subjectType: "ban",
      outcome: "overturned",
      autoBan: null,
    });
    expect(store.db.$transaction).toHaveBeenCalledTimes(1);
    expect(store.tx.forumBan.updateMany).toHaveBeenCalledTimes(1);
    expect(banIn(store, "b_realm")).toMatchObject({ liftedAt: NOW, liftedBy: "u_eurth2" });
    expect(appealIn(store, "a1")).toMatchObject({ status: "overturned" });
    expect(store.tx.forumModLog.create).toHaveBeenCalledTimes(2);
    expect(store.logs.map((l) => l.action)).toEqual(["appeal.review", "ban.lift"]);
    expect(store.logs[1]).toMatchObject({ actorId: "u_eurth2", targetId: "u_m", scope: "realm" });
    expect(detailOf(store.logs[1])).toEqual({
      reason: "appeal overturned",
      appealId: "a1",
      banId: "b_realm",
    });
  });
  it("overturning a warning keeps the automatic ban while 5 points remain", async () => {
    const store = storeWith({ appeals: [appeal("a1", "warning", "w_eurth")] });
    const result = await reviewAppeal(store.db as never, eurthMod2, {
      appealId: "a1",
      ...overturned,
    });
    expect(result.autoBan).toBeNull();
    expect(warningIn(store, "w_eurth")).toMatchObject({ revokedAt: NOW });
    expect(banIn(store, "b_auto")).toMatchObject({ liftedAt: null });
    expect(store.logs.map((l) => l.action)).toEqual(["appeal.review", "warning.revoke"]);
  });

  it.each([["moot"]])(
    "refuses an appeal already closed as %s (CONFLICT) before opening a transaction",
    async (status) => {
      const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm", { status })] });
      await expect(
        reviewAppeal(store.db as never, eurthMod2, { appealId: "a1", ...overturned })
      ).rejects.toMatchObject({ code: "CONFLICT", message: "This appeal is already closed." });
      expect(store.db.$transaction).not.toHaveBeenCalled();
    }
  );
  it("checks scope before status, so an out-of-scope moderator learns nothing", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm", { status: "upheld" })] });
    await expect(
      reviewAppeal(store.db as never, auroraMod, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("is CONFLICT with nothing written when another review lands first", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm")] });
    store.tx.forumAppeal.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      reviewAppeal(store.db as never, eurthMod2, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This appeal is already closed.",
    });
    expect(banIn(store, "b_realm")).toMatchObject({ liftedAt: null });
    expect(store.logs).toEqual([]);
  });
  it("reads its clock after the member's lock: a ban that ended while the review waited is moot", async () => {
    const store = storeWith({
      appeals: [appeal("a1", "ban", "b_soon")],
      bans: [ban("b_soon", { expiresAt: new Date(NOW.getTime() + 1000) })],
    });
    const waited = new Date(NOW.getTime() + 2000);
    store.tx.$executeRaw.mockImplementationOnce(async () => {
      jest.setSystemTime(waited);
      return 1;
    });
    const result = await reviewAppeal(store.db as never, eurthMod2, {
      appealId: "a1",
      ...overturned,
    });
    expect(result.outcome).toBe("moot");
    expect(banIn(store, "b_soon")).toMatchObject({ liftedAt: null });
    expect(appealIn(store, "a1")).toMatchObject({ reviewedAt: waited });
  });
  it.each([["2001 characters", "x".repeat(2001), false]])(
    "takes a %s response",
    async (_case, response, ok) => {
      const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm")] });
      const review = reviewAppeal(store.db as never, eurthMod2, {
        appealId: "a1",
        outcome: "upheld",
        response,
      });
      if (ok) await expect(review).resolves.toMatchObject({ outcome: "upheld" });
      else
        await expect(review).rejects.toMatchObject({
          code: "BAD_REQUEST",
          message: "A response is 1 to 2000 characters.",
        });
    }
  );
});

describe("moot appeals (the subject ended before a decision)", () => {
  const overturned = { outcome: "overturned" as const, response: "Looked into it." };
  const mootLog = (extra: Row = {}) =>
    expect.objectContaining({ action: "appeal.moot", targetType: "appeal", ...extra });

  it("a manual lift closes the ban's open appeal as moot in the lift's transaction, with a log row", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm")] });
    await liftBan(store.db as never, eurthMod2, { banId: "b_realm" });
    expect(appealIn(store, "a1")).toMatchObject({
      status: "moot",
      reviewedBy: null,
      reviewedAt: NOW,
      response: null,
    });
    expect(store.logs.map((l) => l.action)).toEqual(["ban.lift", "appeal.moot"]);
    expect(store.logs[1]).toEqual(
      mootLog({ actorId: "u_eurth2", targetId: "a1", scope: "realm", scopeId: "r_eurth" })
    );
    expect(detailOf(store.logs[1])).toEqual({
      outcome: "moot",
      subjectType: "ban",
      subjectId: "b_realm",
      cause: "ban lifted",
    });
    expect(store.db.$transaction).toHaveBeenCalledTimes(1);
    expect(store.db.forumModLog.create).not.toHaveBeenCalled();
  });
  it("revoking the triggering warning lifts the automatic ban and moots the ban's appeal", async () => {
    const store = storeWith({
      appeals: [appeal("a_ban", "ban", "b_auto"), appeal("a_warn", "warning", "w_site")],
    });
    await revokeWarning(store.db as never, admin2, { warningId: "w_site" });
    expect(banIn(store, "b_auto")).toMatchObject({ liftedAt: NOW });
    expect(appealIn(store, "a_ban")).toMatchObject({ status: "moot", reviewedBy: null });
    expect(appealIn(store, "a_warn")).toMatchObject({ status: "moot" });
    expect(store.logs.map((l) => [l.action, l.targetId])).toEqual([
      ["warning.revoke", "u_m"],
      ["appeal.moot", "a_warn"],
      ["ban.lift", "u_m"],
      ["appeal.moot", "a_ban"],
    ]);
  });
  it.each([["a revoked warning", "warning", "w_revoked", "overturned"]] as const)(
    "a review of %s's appeal closes it as moot whatever was asked (%s), changing nothing else",
    async (_case, subjectType, subjectId, outcome) => {
      const store = storeWith({ appeals: [appeal("a1", subjectType, subjectId)] });
      const before = JSON.stringify([store.state.bans, store.state.warnings]);
      const result = await reviewAppeal(store.db as never, eurthMod2, {
        appealId: "a1",
        outcome,
        response: "  It had already ended.  ",
      });
      expect(result).toEqual({ userId: "u_m", subjectType, outcome: "moot", autoBan: null });
      expect(appealIn(store, "a1")).toMatchObject({
        status: "moot",
        reviewedBy: "u_eurth2",
        reviewedAt: NOW,
        response: "It had already ended.",
      });
      expect(JSON.stringify([store.state.bans, store.state.warnings])).toBe(before);
      expect(store.logs).toEqual([mootLog({ actorId: "u_eurth2", targetId: "a1" })]);
      expect(detailOf(store.logs[0])).toEqual({ outcome: "moot", subjectType, subjectId });
    }
  );

  it("decides from the subject as it is under the lock, not as it was read before", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm")] });
    // The ban is lifted by someone else while this review waits for the member's lock.
    store.tx.$executeRaw.mockImplementationOnce(async () => {
      banIn(store, "b_realm").liftedAt = days(-0.1);
      return 1;
    });
    const result = await reviewAppeal(store.db as never, eurthMod2, {
      appealId: "a1",
      ...overturned,
    });
    expect(result.outcome).toBe("moot");
    expect(store.logs.map((l) => l.action)).toEqual(["appeal.moot"]);
  });

  it("still needs another moderator in scope to close an ended subject's appeal", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_expired")] });
    await expect(
      reviewAppeal(store.db as never, eurthMod, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      reviewAppeal(store.db as never, auroraMod, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(appealIn(store, "a1")).toMatchObject({ status: "open" });
  });
});

/**
 * Owner rulings on automatic bans (follow-ups M2, M3, M4). M2: lifting or overturning a manual site ban that covered
 * an automatic tier re-tiers at once, as the system. M3: automatic sitewide bans are site admins' alone, whoever's
 * warnings brought them. M4: each new warning while 5+ points stay active issues a fresh tier ban.
 */
describe("automatic bans: re-tiers and who reviews them (M2, M3, M4)", () => {
  /** 10 active points: two site warnings of 5 (u_a's). */
  const tenPoints = [
    warning("w1", { categoryId: null, issuedBy: "u_a", points: 5 }),
    warning("w2", { categoryId: null, issuedBy: "u_a", points: 5 }),
  ];
  /** A 60-day manual site ban that covered the 30-day tier, so no automatic ban was issued under it (M-2). */
  const covering = ban("b_manual", {
    scope: "site",
    scopeId: null,
    issuedBy: "u_a",
    expiresAt: days(58),
    createdAt: days(-2),
  });
  const storeWith = (seed: { bans?: Row[]; warnings?: Row[]; appeals?: Row[] }) =>
    forumStore({ categories, realms, users, warnings: [], bans: [], ...seed });
  type Store = ReturnType<typeof storeWith>;
  const autoBansIn = (store: Store) => store.state.bans.filter((b) => b.auto === true);
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());
  describe("re-tier when a covering manual site ban ends early (M2)", () => {
    it("issues the tier's automatic ban as the system when the manual ban is lifted, logged as a re-tier", async () => {
      const store = storeWith({ bans: [covering], warnings: tenPoints });
      const lifted = await liftBan(store.db as never, admin2, { banId: "b_manual" });
      const [auto] = autoBansIn(store);
      expect(auto).toMatchObject({
        userId: "u_m",
        scope: "site",
        scopeId: null,
        auto: true,
        autoTier: 10,
        issuedBy: "system",
        expiresAt: new Date(NOW.getTime() + 30 * DAY_MS),
        reason: "Automatic: 10 active warning points",
      });
      expect(lifted.autoBan).toEqual({
        kind: "issued",
        banId: auto!.id,
        autoTier: 10,
        days: 30,
        expiresAt: new Date(NOW.getTime() + 30 * DAY_MS),
        reason: "Automatic: 10 active warning points",
      });
      expect(store.logs.map((l) => [l.action, l.actorId])).toEqual([
        ["ban.lift", "u_a2"],
        ["ban.retier", "system"],
      ]);
      expect(store.logs[1]).toMatchObject({ targetType: "user", targetId: "u_m", scope: "site" });
      expect(detailOf(store.logs[1])).toEqual({
        banId: auto!.id,
        days: 30,
        points: 10,
        autoTier: 10,
        trigger: "ban lifted",
        liftedBanId: "b_manual",
      });
      expect(store.db.$transaction).toHaveBeenCalledTimes(1);
    });
    it("never re-tiers on lifting an automatic ban itself", async () => {
      const auto = ban("b_auto", {
        scope: "site",
        scopeId: null,
        auto: true,
        autoTier: 10,
        expiresAt: days(20),
      });
      const store = storeWith({ bans: [auto], warnings: tenPoints });
      const lifted = await liftBan(store.db as never, admin2, { banId: "b_auto" });
      expect(lifted.autoBan).toBeNull();
      expect(store.state.bans).toHaveLength(1);
      expect(store.logs.map((l) => l.action)).toEqual(["ban.lift"]);
    });
  });
  describe("automatic sitewide bans are site admins' alone (M3, kept)", () => {
    const triggered = ban("b_auto", {
      scope: "site",
      scopeId: null,
      issuedBy: "u_eurth",
      auto: true,
      autoTier: 5,
    });

    it("the realm moderator whose warnings brought it can neither see, lift nor review it", async () => {
      const store = storeWith({ bans: [triggered], appeals: [appeal("a1", "ban", "b_auto")] });
      const listed = await listBans(store.db as never, eurthMod, { active: true }, 1);
      expect(listed.rows.map((r) => r.id)).toEqual([]);
      await expect(liftBan(store.db as never, eurthMod, { banId: "b_auto" })).rejects.toMatchObject(
        {
          code: "FORBIDDEN",
        }
      );
      await expect(
        reviewAppeal(store.db as never, eurthMod, {
          appealId: "a1",
          outcome: "overturned",
          response: "Mine.",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(store.state.bans[0]).toMatchObject({ liftedAt: null });
    });
  });
  describe("a fresh tier ban on each warning while 5+ points stay active (M4, kept)", () => {
    const sevenPoints = [warning("w1", { categoryId: null, points: 5 })];
    const warn = (store: Store) =>
      issueWarning(store.db as never, admin, { userId: "u_m", points: 2, reason: "Again" });

    it("after the automatic ban expired", async () => {
      const expired = ban("b_old", {
        scope: "site",
        scopeId: null,
        auto: true,
        autoTier: 5,
        createdAt: days(-8),
        expiresAt: days(-1),
      });
      const store = storeWith({ bans: [expired], warnings: sevenPoints });
      const outcome = await warn(store);
      expect(outcome.autoBan).toMatchObject({ kind: "issued", autoTier: 5, days: 7 });
      expect(autoBansIn(store)).toHaveLength(2);
    });
  });
});

describe("the appeal queue", () => {
  const eurthMod2 = moderatorOf("u_eurth2", ["r_eurth"]);
  const auroraMod = moderatorOf("u_aur", ["r_aurora"]);
  const appeals: Row[] = [
    appeal("a_realm", "ban", "b_realm"),
    appeal("a_site", "ban", "b_site"),
    appeal("a_auto", "ban", "b_auto"),
    appeal("a_cat", "ban", "b_cat"),
    appeal("a_weurth", "warning", "w_eurth"),
    appeal("a_wsite", "warning", "w_site"),
    appeal("a_wgeneral", "warning", "w_general"),
    appeal("a_done", "ban", "b_lifted", {
      status: "overturned",
      reviewedBy: "u_eurth2",
      reviewedAt: days(-0.5),
      response: "Lifted.",
    }),
  ];
  const raisedAuto: Row = {
    actorId: "u_a2",
    action: "ban.extend",
    targetType: "user",
    targetId: "u_m",
    scope: "site",
    scopeId: null,
    detail: JSON.stringify({ banId: "b_auto", autoTier: 10 }),
  };
  const storeWith = (extra: { appeals?: Row[]; logs?: Row[] } = {}) =>
    forumStore({ categories, realms, users, bans, warnings, appeals, ...extra });
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());
  describe("listAppeals", () => {
    it("filters a scoped queue by the appeals' own scope, never reading every appeal of a status (M7)", async () => {
      const store = storeWith();
      await listAppeals(store.db as never, eurthMod2, { status: "open" }, 1);
      expect(store.db.forumAppeal.findMany).toHaveBeenCalledTimes(1);
      expect(store.db.forumAppeal.findMany.mock.calls[0]![0]!.where).toEqual({
        status: "open",
        OR: [
          { scope: "realm", scopeId: { in: ["r_eurth"] } },
          { scope: "category", scopeId: { in: expect.arrayContaining(["r_eurth_hub"]) } },
        ],
      });
    });
    it("gives another realm's moderator nothing of Eurth's", async () => {
      const store = storeWith();
      const result = await listAppeals(store.db as never, auroraMod, { status: "open" }, 1);
      expect(result).toEqual({ rows: [], total: 0 });
    });
    it("marks what the viewer may review: never their own subject, an automatic ban they raised, or their own appeal", async () => {
      const store = storeWith({ logs: [raisedAuto] });
      const byId = async (viewer: Parameters<typeof listAppeals>[1]) => {
        const result = await listAppeals(store.db as never, viewer, { status: "open" }, 1);
        return Object.fromEntries(result.rows.map((r) => [r.id, r.canReview]));
      };
      expect(await byId(admin)).toMatchObject({
        a_site: false,
        a_auto: false,
        a_wsite: false,
        a_wgeneral: false,
        a_realm: true,
        a_cat: true,
        a_weurth: true,
      });
      expect(await byId(admin2)).toMatchObject({ a_site: true, a_auto: false, a_wsite: true });
      expect(await byId(eurthMod)).toEqual({ a_realm: false, a_weurth: false });
      expect(await byId(eurthMod2)).toEqual({ a_realm: true, a_weurth: true });
      const promoted = { ...moderatorOf("u_m", ["r_eurth"]), clerkUserId: "member" };
      expect(await byId(promoted)).toEqual({ a_realm: false, a_weurth: false });
    });
  });
});

describe("a member's standing", () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());
  describe("myStanding", () => {
    it("never names a category the member cannot see (M14)", async () => {
      const staff: Row = {
        ...categories[0]!,
        id: "cat_staff",
        key: "staff",
        name: "Staff",
        visibility: "staff",
      };
      const reports = categories.find((c) => c.id === "cat_reports")!;
      const store = forumStore({
        categories: [...categories, staff],
        realms,
        users,
        warnings,
        bans: [
          ban("b_staff", { scope: "category", scopeId: "cat_staff" }),
          ban("b_reports", { scope: "category", scopeId: reports.id as string }),
        ],
      });
      const standing = await myStanding(store.db as never, member);
      const byId = Object.fromEntries(standing.bans.map((b) => [b.id, b]));
      expect(byId.b_staff).toMatchObject({ scope: "category", scopeName: null });
      expect(byId.b_reports).toMatchObject({ scopeName: "reports" });
    });
  });
});
