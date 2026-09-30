/**
 * N16: ThinkTank invites by username, and the invitee's `thinktankInvites` privacy preference.
 */
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onThinktankActivity: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesThinktanksRouter } from "~/server/api/routers/thinkpages/thinktanks";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(thinkpagesThinktanksRouter);
type Db = ReturnType<typeof createMockPrisma>;

const OWNER = "user_owner";
const MEMBER = "user_member";
const FRIEND = "user_friend";
const PRIVATE_ONE = "user_private";
const FOLLOW_ONLY = "user_followers_only";

const GROUP = {
  id: "g1",
  name: "Economists",
  type: "public",
  createdBy: OWNER,
  isActive: true,
  settings: null,
  conversationId: null,
};

function privacy(userId: string, cfg: Record<string, unknown>) {
  return { userId, status: JSON.stringify(cfg) };
}

function makeDb(): Db {
  const db = createMockPrisma();
  db.thinktankGroup.findUnique.mockResolvedValue(GROUP);
  db.thinktankMember.findUnique.mockImplementation(async (args: any) => {
    const userId = args.where.groupId_userId.userId as string;
    if (userId === OWNER) return { userId, role: "owner", isActive: true };
    if (userId === MEMBER) return { userId, role: "member", isActive: true };
    return null;
  });
  db.thinktankMember.findMany.mockResolvedValue([]);
  db.user.findMany.mockImplementation(async (args: any) => {
    const ids = args.where.clerkUserId.in as string[];
    return ids.map((id) => ({ clerkUserId: id, countryId: `c_${id}` }));
  });
  db.user.findUnique.mockResolvedValue({ countryId: "c_owner" });
  db.userConnection.findMany.mockImplementation(async (args: any) => {
    if (args.where.connectionType === "privacy_config") {
      return [
        privacy(PRIVATE_ONE, { thinktankInvites: "nobody" }),
        privacy(FOLLOW_ONLY, { thinktankInvites: "followers" }),
      ];
    }
    return [];
  });
  db.countryFollow.findMany.mockResolvedValue([]);
  return db;
}

function callerAs(userId: string, db: Db) {
  return createCaller(
    createMockRouterContext({
      auth: { userId },
      user: { id: `db_${userId}`, clerkUserId: userId, isActive: true },
      db,
    }) as never
  );
}

describe("inviteToThinktank honors the invitee's thinktankInvites preference", () => {
  it("skips users set to 'nobody' and reports how many were skipped", async () => {
    const db = makeDb();
    const result = await callerAs(OWNER, db).inviteToThinktank({
      groupId: "g1",
      userIds: [FRIEND, PRIVATE_ONE],
    });

    expect(db.thinktankInvite.createMany).toHaveBeenCalledWith({
      data: [{ groupId: "g1", invitedUser: FRIEND, invitedBy: OWNER }],
    });
    expect(result.skipped).toBe(1);
  });

  it("'followers' only allows inviters whose country follows the invitee's country", async () => {
    const db = makeDb();
    await callerAs(OWNER, db).inviteToThinktank({ groupId: "g1", userIds: [FOLLOW_ONLY] });
    expect(db.thinktankInvite.createMany).not.toHaveBeenCalled();

    const db2 = makeDb();
    db2.countryFollow.findMany.mockResolvedValue([{ followedCountryId: `c_${FOLLOW_ONLY}` }]);
    await callerAs(OWNER, db2).inviteToThinktank({ groupId: "g1", userIds: [FOLLOW_ONLY] });
    expect(db2.thinktankInvite.createMany).toHaveBeenCalledWith({
      data: [{ groupId: "g1", invitedUser: FOLLOW_ONLY, invitedBy: OWNER }],
    });
  });

  it("does not invite ids that match no active user", async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue([]);
    await callerAs(OWNER, db).inviteToThinktank({ groupId: "g1", userIds: ["user_ghost"] });
    expect(db.thinktankInvite.createMany).not.toHaveBeenCalled();
  });

  it("does not invite a user who blocked the inviter", async () => {
    const db = makeDb();
    db.userConnection.findMany.mockImplementation(async (args: any) =>
      args.where.connectionType === "blocked" ? [{ userId: FRIEND }] : []
    );
    await callerAs(OWNER, db).inviteToThinktank({ groupId: "g1", userIds: [FRIEND] });
    expect(db.thinktankInvite.createMany).not.toHaveBeenCalled();
  });
});

describe("searchInvitableUsers", () => {
  function account(clerkUserId: string, username: string) {
    return {
      clerkUserId,
      username,
      displayName: `Name ${username}`,
      profileImageUrl: null,
      country: { name: "Almadaria" },
    };
  }

  it("rejects a plain member", async () => {
    const db = makeDb();
    await expect(
      callerAs(MEMBER, db).searchInvitableUsers({ groupId: "g1", query: "fri" })
    ).rejects.toThrow(/owner or a group admin/);
    expect(db.thinkpagesAccount.findMany).not.toHaveBeenCalled();
  });

  it("finds by username and returns only safe fields, hiding non-invitable users", async () => {
    const db = makeDb();
    db.thinkpagesAccount.findMany.mockResolvedValue([
      account(FRIEND, "friend"),
      account(PRIVATE_ONE, "friendly_private"),
    ]);

    const results = await callerAs(OWNER, db).searchInvitableUsers({
      groupId: "g1",
      query: "@fri",
    });

    expect(results).toEqual([
      {
        userId: FRIEND,
        username: "friend",
        displayName: "Name friend",
        profileImageUrl: null,
        countryName: "Almadaria",
      },
    ]);
    const where = db.thinkpagesAccount.findMany.mock.calls[0]![0].where;
    expect(where.OR[0].username.contains).toBe("fri");
  });

  it("excludes users hidden from search and existing members", async () => {
    const db = makeDb();
    db.thinkpagesAccount.findMany.mockResolvedValue([
      account(FRIEND, "friend"),
      account("user_hidden", "friend_hidden"),
      account("user_in_group", "friend_member"),
    ]);
    db.thinktankMember.findMany.mockResolvedValue([{ userId: "user_in_group" }]);
    db.userConnection.findMany.mockImplementation(async (args: any) =>
      args.where.connectionType === "privacy_config"
        ? [privacy("user_hidden", { searchDiscoverable: false })]
        : []
    );

    const results = await callerAs(OWNER, db).searchInvitableUsers({
      groupId: "g1",
      query: "friend",
    });
    expect(results.map((r) => r.userId)).toEqual([FRIEND]);
  });
});
