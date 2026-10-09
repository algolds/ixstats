/** @jest-environment node */
import { Prisma } from "@prisma/client";
import {
  fileAppeal,
  issueWarning,
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
  generalMod,
  member,
  moderatorOf,
  realms,
  users,
} from "~/tests/helpers/forum-mod-fixtures";
import { detailOf, forumStore, type Row } from "~/tests/helpers/forum-store-fake";

const admin3 = { id: "u_a3", clerkUserId: "admin3", countryId: null, role: admin.role };
const eurthMod2 = moderatorOf("u_eurth2", ["r_eurth"]);
const auroraMod = moderatorOf("u_aur", ["r_aurora"]);
const generalMod2 = moderatorOf("u_gen2", [], ["cat_general"]);

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

/** Moves the clock on while the review is inside its transaction, after it read `now`. */
function clockMovesDuringReview(store: Store, ms: number): void {
  const write = store.tx.forumAppeal.updateMany.getMockImplementation()!;
  store.tx.forumAppeal.updateMany.mockImplementationOnce(async (args) => {
    jest.setSystemTime(new Date(NOW.getTime() + ms));
    return write(args);
  });
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

  it.each([
    ["ban", "b_realm", "realm", "r_eurth"],
    ["ban", "b_site", "site", null],
    ["ban", "b_cat", "category", "cat_general"],
    ["warning", "w_eurth", "category", "r_eurth_hub"],
    ["warning", "w_site", "site", null],
  ] as const)(
    "stores the %s %s's scope on the appeal (M7)",
    async (subjectType, subjectId, scope, scopeId) => {
      const store = storeWith();
      await fileAppeal(store.db as never, member, { subjectType, subjectId, body });
      expect(store.state.appeals).toEqual([expect.objectContaining({ subjectId, scope, scopeId })]);
    }
  );

  it.each([["b_realm"], ["b_site"], ["b_auto"], ["b_cat"]])(
    "files an appeal on the member's own active ban %s, permanent ones included",
    async (subjectId) => {
      const store = storeWith();
      await fileAppeal(store.db as never, member, { subjectType: "ban", subjectId, body });
      expect(store.state.appeals).toEqual([
        expect.objectContaining({ subjectType: "ban", subjectId, userId: "u_m" }),
      ]);
    }
  );

  it.each([
    ["someone else's ban", "ban", "b_other"],
    ["a missing ban", "ban", "b_missing"],
    ["a missing warning", "warning", "w_missing"],
  ] as const)(
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

  it.each([
    ["a lifted ban", "ban", "b_lifted", "This ban is no longer active."],
    ["an expired ban", "ban", "b_expired", "This ban is no longer active."],
    ["a revoked warning", "warning", "w_revoked", "This warning is no longer active."],
    ["an expired warning", "warning", "w_expired", "This warning is no longer active."],
  ] as const)("refuses %s (M12, BAD_REQUEST)", async (_case, subjectType, subjectId, message) => {
    const store = storeWith();
    await expect(
      fileAppeal(store.db as never, member, { subjectType, subjectId, body })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message });
    expect(store.state.appeals).toEqual([]);
  });

  it("refuses a ban that ends exactly now", async () => {
    const store = storeWith({ bans: [ban("b_now", { expiresAt: NOW })] });
    await expect(
      fileAppeal(store.db as never, member, { subjectType: "ban", subjectId: "b_now", body })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it.each([["open"], ["upheld"], ["overturned"]])(
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

  it("does not confuse a warning's appeal with a ban's of the same id", async () => {
    const store = storeWith({ appeals: [appeal("a1", "warning", "b_realm")] });
    await fileAppeal(store.db as never, member, { subjectType: "ban", subjectId: "b_realm", body });
    expect(store.state.appeals).toHaveLength(2);
  });

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

  it("passes other database errors through", async () => {
    const store = storeWith();
    store.tx.forumAppeal.create.mockRejectedValueOnce(new Error("connection lost"));
    await expect(
      fileAppeal(store.db as never, member, { subjectType: "warning", subjectId: "w_site", body })
    ).rejects.toThrow("connection lost");
  });

  it.each([
    ["9 characters", "123456789", false],
    ["9 characters padded with spaces", "   123456789   ", false],
    ["10 characters", "1234567890", true],
    ["4000 characters", "x".repeat(4000), true],
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

  it("only updates an appeal that is still open (conditional write)", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm")] });
    await reviewAppeal(store.db as never, eurthMod2, { appealId: "a1", ...upheld });
    expect(store.tx.forumAppeal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a1", status: "open" } })
    );
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

  it("refuses the issuer of a warning (FORBIDDEN)", async () => {
    const store = storeWith({ appeals: [appeal("a1", "warning", "w_site")] });
    await expect(
      reviewAppeal(store.db as never, admin, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Another moderator must review this appeal.",
    });
    expect(warningIn(store, "w_site")).toMatchObject({ revokedAt: null });
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

  it("refuses a moderator whose warning raised the automatic ban to a higher tier", async () => {
    const raised = {
      actorId: "u_a2",
      action: "ban.extend",
      targetType: "user",
      targetId: "u_m",
      scope: "site",
      scopeId: null,
      detail: JSON.stringify({ banId: "b_auto", autoTier: 10, trigger: "warning" }),
    };
    const otherBan = { ...raised, actorId: "u_a3", detail: JSON.stringify({ banId: "b_old" }) };
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_auto")], logs: [raised, otherBan] });
    await expect(
      reviewAppeal(store.db as never, admin2, { appealId: "a1", ...upheld })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      reviewAppeal(store.db as never, admin3, { appealId: "a1", ...upheld })
    ).resolves.toMatchObject({ outcome: "upheld" });
  });

  it("keeps both issuers of an automatic ban built by real warnings from reviewing its appeal", async () => {
    const store = forumStore({ categories, realms, users });
    const sitewide = { userId: "u_m", reason: "Rude", points: 5 };
    const first = await issueWarning(store.db as never, admin, sitewide);
    const second = await issueWarning(store.db as never, admin2, sitewide);
    expect(first.autoBan?.kind).toBe("issued");
    expect(second.autoBan?.kind).toBe("extended");
    const { appealId } = await fileAppeal(store.db as never, member, {
      subjectType: "ban",
      subjectId: first.autoBan!.banId,
      body: "These two warnings were for the same post.",
    });
    for (const issuer of [admin, admin2]) {
      await expect(
        reviewAppeal(store.db as never, issuer, { appealId, ...overturned })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await reviewAppeal(store.db as never, admin3, { appealId, ...overturned });
    expect(banIn(store, first.autoBan!.banId)).toMatchObject({ liftedAt: NOW, liftedBy: "u_a3" });
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
    ["a realm moderator on an automatic (site) ban", eurthMod2, "ban", "b_auto"],
    ["a category moderator on a site warning", generalMod, "warning", "w_site"],
    ["a realm moderator on a sitewide category's warning", eurthMod2, "warning", "w_general"],
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

  it.each([
    [
      "another of the category's moderators on its category ban",
      generalMod2,
      "ban",
      "b_cat",
      "category",
    ],
    ["the category's moderator on a warning in it", generalMod, "warning", "w_general", "category"],
    [
      "a realm moderator on a warning in the realm's category",
      eurthMod2,
      "warning",
      "w_eurth",
      "category",
    ],
    ["a site admin on a site warning", admin2, "warning", "w_site", "site"],
  ] as const)("lets %s review", async (_case, viewer, subjectType, subjectId, scope) => {
    const store = storeWith({ appeals: [appeal("a1", subjectType, subjectId)] });
    await reviewAppeal(store.db as never, viewer, { appealId: "a1", ...upheld });
    expect(appealIn(store, "a1")).toMatchObject({ status: "upheld", reviewedBy: viewer.id });
    expect(store.logs[0]).toMatchObject({ action: "appeal.review", scope });
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

  it("overturning a warning revokes it and lifts the automatic ban when points drop below 5 (M3)", async () => {
    const store = storeWith({ appeals: [appeal("a1", "warning", "w_site")] });
    const result = await reviewAppeal(store.db as never, admin2, { appealId: "a1", ...overturned });
    expect(result).toEqual({
      userId: "u_m",
      subjectType: "warning",
      outcome: "overturned",
      autoBan: { kind: "lifted", banId: "b_auto" },
    });
    expect(warningIn(store, "w_site")).toMatchObject({ revokedAt: NOW, revokedBy: "u_a2" });
    expect(banIn(store, "b_auto")).toMatchObject({ liftedAt: NOW, liftedBy: "u_a2" });
    expect(store.logs.map((l) => l.action)).toEqual([
      "appeal.review",
      "warning.revoke",
      "ban.lift",
    ]);
    expect(store.db.$transaction).toHaveBeenCalledTimes(1);
    expect(store.db.forumModLog.create).not.toHaveBeenCalled();
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

  it.each([["upheld"], ["overturned"], ["moot"]])(
    "refuses an appeal already closed as %s (CONFLICT) before opening a transaction",
    async (status) => {
      const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm", { status })] });
      await expect(
        reviewAppeal(store.db as never, eurthMod2, { appealId: "a1", ...overturned })
      ).rejects.toMatchObject({ code: "CONFLICT", message: "This appeal is already closed." });
      expect(store.db.$transaction).not.toHaveBeenCalled();
    }
  );

  it("refuses an appeal already reviewed (CONFLICT) and leaves the ban alone", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm", { status: "upheld" })] });
    await expect(
      reviewAppeal(store.db as never, eurthMod2, { appealId: "a1", ...overturned })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This appeal is already closed.",
    });
    expect(store.db.$transaction).not.toHaveBeenCalled();
    expect(banIn(store, "b_realm")).toMatchObject({ liftedAt: null });
  });

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

  it("lifts with the review's clock: a ban live at the review's now is lifted even if it ends a moment later", async () => {
    const store = storeWith({
      appeals: [appeal("a1", "ban", "b_soon")],
      bans: [ban("b_soon", { expiresAt: new Date(NOW.getTime() + 1000) })],
    });
    clockMovesDuringReview(store, 2000);
    await reviewAppeal(store.db as never, eurthMod2, { appealId: "a1", ...overturned });
    expect(banIn(store, "b_soon")).toMatchObject({ liftedAt: NOW, liftedBy: "u_eurth2" });
    expect(appealIn(store, "a1")).toMatchObject({ reviewedAt: NOW });
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

  it("revokes with the review's clock", async () => {
    const store = storeWith({ appeals: [appeal("a1", "warning", "w_eurth")] });
    clockMovesDuringReview(store, 2000);
    await reviewAppeal(store.db as never, eurthMod2, { appealId: "a1", ...overturned });
    expect(warningIn(store, "w_eurth")).toMatchObject({ revokedAt: NOW });
  });

  it("is NOT_FOUND for a missing appeal", async () => {
    const store = storeWith();
    await expect(
      reviewAppeal(store.db as never, admin, { appealId: "nope", ...upheld })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Appeal not found." });
  });

  it.each([
    ["blank", "   ", false],
    ["1 character", "x", true],
    ["2000 characters", "x".repeat(2000), true],
    ["2001 characters", "x".repeat(2001), false],
  ])("takes a %s response", async (_case, response, ok) => {
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
  });

  it("lets an archived realm's moderators review (T0-6)", async () => {
    const store = storeWith({
      appeals: [appeal("a1", "ban", "b_old")],
      bans: [ban("b_old", { scopeId: "r_old" })],
    });
    await reviewAppeal(store.db as never, moderatorOf("u_old2", ["r_old"]), {
      appealId: "a1",
      ...overturned,
    });
    expect(banIn(store, "b_old")).toMatchObject({ liftedAt: NOW });
  });
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

  it("a lift leaves an appeal that was already decided alone and logs no moot", async () => {
    const store = storeWith({ appeals: [appeal("a1", "ban", "b_realm", { status: "upheld" })] });
    await liftBan(store.db as never, eurthMod2, { banId: "b_realm" });
    expect(appealIn(store, "a1")).toMatchObject({ status: "upheld" });
    expect(store.logs.map((l) => l.action)).toEqual(["ban.lift"]);
  });

  it("a manual revoke closes the warning's open appeal as moot", async () => {
    const store = storeWith({ appeals: [appeal("a1", "warning", "w_eurth")] });
    await revokeWarning(store.db as never, eurthMod2, { warningId: "w_eurth" });
    expect(appealIn(store, "a1")).toMatchObject({ status: "moot", reviewedBy: null });
    expect(store.logs.map((l) => l.action)).toEqual(["warning.revoke", "appeal.moot"]);
    expect(detailOf(store.logs[1])).toMatchObject({
      cause: "warning revoked",
      subjectId: "w_eurth",
    });
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

  it("overturning the triggering warning's appeal moots the lifted automatic ban's appeal", async () => {
    const store = storeWith({
      appeals: [appeal("a_ban", "ban", "b_auto"), appeal("a_warn", "warning", "w_site")],
    });
    await reviewAppeal(store.db as never, admin2, { appealId: "a_warn", ...overturned });
    expect(appealIn(store, "a_warn")).toMatchObject({ status: "overturned", reviewedBy: "u_a2" });
    expect(appealIn(store, "a_ban")).toMatchObject({ status: "moot", reviewedBy: null });
    expect(store.logs.map((l) => l.action)).toEqual([
      "appeal.review",
      "warning.revoke",
      "ban.lift",
      "appeal.moot",
    ]);
    // The ban's appeal is closed, so nobody can be left to "uphold" a lifted ban.
    await expect(
      reviewAppeal(store.db as never, admin3, {
        appealId: "a_ban",
        outcome: "upheld",
        response: "x",
      })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "This appeal is already closed." });
  });

  it.each([
    ["an expired ban", "ban", "b_expired", "upheld"],
    ["an expired ban", "ban", "b_expired", "overturned"],
    ["a ban lifted outside the lift path", "ban", "b_lifted", "overturned"],
    ["an expired warning", "warning", "w_expired", "overturned"],
    ["an expired warning", "warning", "w_expired", "upheld"],
    ["a revoked warning", "warning", "w_revoked", "overturned"],
  ] as const)(
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
