/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/websocket-server", () => ({
  getThinkPagesBroadcaster: jest.fn(() => ({
    broadcastBoard: jest.fn(),
    broadcastMessage: jest.fn(),
  })),
}));
jest.mock("~/server/modules/thinkpages-forum", () => {
  const actual = jest.requireActual("~/server/modules/thinkpages-forum");
  return {
    ...actual,
    issueBan: jest.fn(actual.issueBan),
    issueWarning: jest.fn(),
    revokeWarning: jest.fn(),
    liftBan: jest.fn(),
    reviewAppeal: jest.fn(),
    listReports: jest.fn(),
    listModLog: jest.fn(),
    listWarnings: jest.fn(),
    listBans: jest.fn(),
    listAppeals: jest.fn(),
    listCategoryModerators: jest.fn(),
    resolveReport: jest.fn(async () => undefined),
    setThreadFlag: jest.fn(async () => undefined),
    moveThread: jest.fn(async () => undefined),
    setPostHidden: jest.fn(async () => undefined),
    modEditPost: jest.fn(async () => undefined),
    publishBoardPost: jest.fn(async () => undefined),
    notifyWarning: jest.fn(async () => undefined),
    notifyBan: jest.fn(async () => undefined),
    notifyBanLifted: jest.fn(async () => undefined),
    notifyAutoBanShortened: jest.fn(async () => undefined),
    notifyAppealDecision: jest.fn(async () => undefined),
  };
});
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumModRouter } from "~/server/api/routers/thinkpagesForum/mod";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import {
  ForumError,
  modEditPost,
  publishBoardPost,
  setPostHidden,
  issueWarning,
  liftBan,
  listReports,
  notifyBan,
  notifyBanLifted,
  notifyWarning
} from "~/server/modules/thinkpages-forum";

const caller = (user: object | null, db: object) =>
  createCallerFactory(thinkpagesForumModRouter)(
    createMockRouterContext({
      auth: user ? { userId: "clerk_1" } : null,
      user: user as never,
      db,
    }) as never
  );

const USER_ROLE = { name: "user", level: 100 };
const member = { id: "u1", clerkUserId: "clerk_1", countryId: "c1", role: USER_ROLE };
const founder = { ...member, id: "u_f", clerkUserId: "founder" };
const admin = { ...member, id: "u_a", role: { name: "admin", level: 10 } };

const EURTH = { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" };
const hub = {
  id: "rcat_hub",
  key: "hub",
  name: "Hub",
  scope: "realm",
  realmId: "r_eurth",
  visibility: "public",
  postRole: "any",
  order: 10,
};
const when = new Date("2026-10-09T12:00:00Z");
const rawUser = (id: string, handle: string) => ({
  id,
  handle,
  wikiUsername: null,
  country: null,
  email: `${id}@example.com`,
  clerkUserId: `clerk_${id}`,
});

/** moderatorContext's lookups (by Clerk id for founders, T0-10), Eurth and its Hub, and display names. */
function modDb() {
  return {
    realm: {
      findMany: jest.fn(async ({ where }: { where?: { ownerId?: string } } = {}) =>
        [EURTH].filter((r) => where?.ownerId === undefined || r.ownerId === where.ownerId)
      ),
      findUnique: jest.fn(async ({ where }: { where: { slug?: string; id?: string } }) =>
        where.slug === "eurth" || where.id === "r_eurth" ? EURTH : null
      ),
    },
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
    forumCategory: {
      findMany: jest.fn(async () => [hub]),
      findFirst: jest.fn(async ({ where }: { where: { key: string } }) =>
        where.key === "hub" ? hub : null
      ),
    },
    user: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => rawUser(id, `handle_${id}`))
      ),
    },
    thinkpagesAccount: { findMany: jest.fn(async () => []) },
  };
}

beforeEach(() => jest.clearAllMocks());

describe("thinkpagesForumMod router", () => {
  describe("context", () => {
    it("is empty for a plain member, never an error", async () => {
      await expect(caller(member, modDb()).context()).resolves.toEqual({
        isSiteAdmin: false,
        realms: [],
        categories: [],
      });
    });
  });

  describe("ban", () => {
    const site = { userId: "u2", scope: { kind: "site" }, reason: "Abuse", days: null } as const;

    it("surfaces the module's FORBIDDEN when a non-admin bans sitewide, and sends no notice", async () => {
      for (const who of [member, founder]) {
        await expect(caller(who, modDb()).ban(site)).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      expect(notifyBan).not.toHaveBeenCalled();
    });
  });

  describe("warn", () => {
    const input = {
      userId: "u2",
      points: 2,
      reason: "Rude",
      target: { type: "post", id: "p1" },
    } as const;
    it("never fails the call when a notice fails", async () => {
      jest
        .mocked(issueWarning)
        .mockResolvedValueOnce({ warningId: "w1", activePoints: 1, autoBan: null });
      jest.mocked(notifyWarning).mockRejectedValueOnce(new Error("notifications down"));
      await expect(caller(admin, modDb()).warn(input)).resolves.toMatchObject({ warningId: "w1" });
    });

    it("sends nothing when the module refuses", async () => {
      jest
        .mocked(issueWarning)
        .mockRejectedValueOnce(new ForumError("FORBIDDEN", "You can't act at this scope."));
      await expect(caller(member, modDb()).warn(input)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "You can't act at this scope.",
      });
      expect(notifyWarning).not.toHaveBeenCalled();
    });
  });

  describe("lifts, revokes and appeal decisions", () => {
    it("never fails a committed lift when the place lookup fails; the notice names a generic place (I-2)", async () => {
      jest.mocked(liftBan).mockResolvedValueOnce({
        userId: "u2",
        scope: "category",
        scopeId: "rcat_hub",
        autoBan: null,
      });
      const db = modDb();
      db.forumCategory.findMany.mockRejectedValue(new Error("connection reset"));
      await expect(caller(founder, db).liftBan({ banId: "b1" })).resolves.toBeUndefined();
      expect(notifyBanLifted).toHaveBeenCalledWith(expect.anything(), {
        userId: "u2",
        ban: { scope: "category", scopeName: null },
      });
    });

    it("tells the member of the automatic ban a lift re-tiered, after the lift notice (M2)", async () => {
      const expiresAt = new Date("2026-11-08T12:00:00Z");
      const reason = "Automatic: 10 active warning points";
      jest.mocked(liftBan).mockResolvedValueOnce({
        userId: "u2",
        scope: "site",
        scopeId: null,
        autoBan: { kind: "issued", banId: "b_new", autoTier: 10, days: 30, expiresAt, reason },
      });
      await caller(admin, modDb()).liftBan({ banId: "b1" });
      expect(notifyBanLifted).toHaveBeenCalledWith(expect.anything(), {
        userId: "u2",
        ban: { scope: "site", scopeName: null },
      });
      expect(notifyBan).toHaveBeenCalledWith(expect.anything(), {
        userId: "u2",
        ban: { scope: "site", expiresAt, reason },
      });
    });
  });

  describe("lists", () => {
    const reportRow = {
      id: "rep1",
      targetType: "post",
      targetId: "p1",
      threadId: "t1",
      threadTitle: "Hello",
      excerpt: "Spam spam",
      targetAuthorId: "u_author",
      categoryId: "rcat_hub",
      category: { key: "hub", name: "Hub", realm: { slug: "eurth", name: "Eurth" } },
      ownTarget: false,
      reporterId: "u_reporter",
      reason: "Spam",
      status: "resolved",
      handledBy: "u_f",
      handledAt: when,
      note: null,
      createdAt: when,
    };

    it("returns reports with display-safe names for the reporter, the handler and the author", async () => {
      jest.mocked(listReports).mockResolvedValueOnce({ rows: [reportRow], total: 1 } as never);
      const out = await caller(founder, modDb()).reports({ status: "resolved", page: 1 });
      expect(listReports).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: "u_f" }),
        { status: "resolved", realmId: null },
        1
      );
      expect(Object.keys(out.authors.users).sort()).toEqual(["u_author", "u_f", "u_reporter"]);
      expect(out.authors.users.u_reporter).toEqual({
        name: "handle_u_reporter",
        handle: "handle_u_reporter",
        avatarUrl: null,
        flagUrl: null,
      });
      expect(JSON.stringify(out)).not.toContain("@example.com");
      expect(JSON.stringify(out)).not.toContain("clerk_u_");
    });

    it("names no reporter where the module withheld one", async () => {
      jest.mocked(listReports).mockResolvedValueOnce({
        rows: [{ ...reportRow, ownTarget: true, reporterId: null, handledBy: null }],
        total: 1,
      } as never);
      const out = await caller(admin, modDb()).reports({ status: "open", page: 1 });
      expect(Object.keys(out.authors.users)).toEqual(["u_author"]);
    });
  });
  it("publishes a hide, an unhide and an edit of a post to the realm board's room after they commit", async () => {
    const c = caller(founder, modDb());
    await c.setPostHidden({ postId: "p1", hidden: true });
    await c.setPostHidden({ postId: "p1", hidden: false });
    await c.editPost({ postId: "p2", html: "<p>x</p>", note: "Tidied" });
    expect(
      jest.mocked(publishBoardPost).mock.calls.map(([, , postId, kind]) => [postId, kind])
    ).toEqual([
      ["p1", "updated"],
      ["p1", "updated"],
      ["p2", "updated"],
    ]);
    expect(jest.mocked(publishBoardPost).mock.calls[0]![1]).toEqual({
      broadcastBoard: expect.any(Function),
      broadcastMessage: expect.any(Function),
    });
  });

  it("publishes nothing when the moderator action is refused", async () => {
    jest.mocked(setPostHidden).mockRejectedValueOnce(new ForumError("FORBIDDEN", "No."));
    jest.mocked(modEditPost).mockRejectedValueOnce(new ForumError("CONFLICT", "Edited."));
    const c = caller(founder, modDb());
    await expect(c.setPostHidden({ postId: "p1", hidden: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      c.editPost({ postId: "p1", html: "<p>x</p>", note: "Tidied" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(publishBoardPost).not.toHaveBeenCalled();
  });
});
