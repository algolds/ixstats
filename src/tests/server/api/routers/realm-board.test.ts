/**
 * Realm boards: a ThinkTank of type "realm_board" whose membership is nation ownership in the realm.
 *
 * Anyone may read the board; owners of a nation in the realm post (as a persona of one of the realm's
 * nations); the realm's moderators (site admins, its founder) remove posts; the board's type, lifetime
 * and membership are not group-managed. A stale member row never grants posting.
 *
 * `jest` is the ambient global because the hoisted jest.mock() factory calls jest.fn() inline.
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

const FOUNDER = "user_founder"; // Realm.ownerId: moderates the board
const OWNER = "user_nation_owner"; // owns a nation in the realm
const EX_OWNER = "user_ex_owner"; // has a stale member row, owns nothing any more
const OUTSIDER = "user_outsider";

const BOARD = {
  id: "board1",
  name: "Eurth Board",
  type: "realm_board",
  createdBy: FOUNDER,
  isActive: true,
  settings: JSON.stringify({ allowPersonaPosting: true }),
  conversationId: "conv1",
};

function makeDb(): Db {
  const db = createMockPrisma();
  db.thinktankGroup.findUnique.mockResolvedValue(BOARD);
  db.realmBoard.findUnique.mockImplementation(async ({ where }: any) =>
    where.groupId === "board1" || where.realmId === "eurth"
      ? { realmId: "eurth", groupId: "board1" }
      : null
  );
  db.realm.findUnique.mockResolvedValue({ ownerId: FOUNDER });
  db.user.findUnique.mockImplementation(async ({ where }: any) => ({
    id: `db_${where.clerkUserId}`,
    clerkUserId: where.clerkUserId,
    role: null,
  }));
  db.country.findMany.mockImplementation(async ({ where }: any) =>
    where.realmId === "eurth" && where.ownerUserId === `db_${OWNER}` ? [{ id: "c_eurth" }] : []
  );
  // The ex-owner still has an active member row: it must not matter on a realm board.
  db.thinktankMember.findUnique.mockImplementation(async (args: any) =>
    args.where.groupId_userId.userId === EX_OWNER
      ? { id: "m_ex", userId: EX_OWNER, role: "member", isActive: true }
      : null
  );
  db.thinkpagesPost.create.mockImplementation(async ({ data }: any) => ({ id: "p1", ...data }));
  return db;
}

function callerAs(userId: string | null, db: Db) {
  return createCaller(
    createMockRouterContext({
      auth: userId ? { userId } : null,
      user: userId ? { id: `db_${userId}`, clerkUserId: userId, isActive: true } : null,
      db,
    }) as never
  );
}

describe("realm board posting follows nation ownership", () => {
  it.each([OUTSIDER, EX_OWNER])("%s cannot post and nothing is written", async (who) => {
    const db = makeDb();
    await expect(
      callerAs(who, db).createGroupPost({ groupId: "board1", content: "Hello realm" })
    ).rejects.toThrow(/Not a member/);
    expect(db.thinkpagesPost.create).not.toHaveBeenCalled();
  });

  it("a nation owner posts as their persona of a nation in the realm, stamped in real time", async () => {
    const db = makeDb();
    db.thinkpagesAccount.findFirst.mockImplementation(async ({ where }: any) =>
      where.countryId?.in?.includes("c_eurth") ? { id: "acc_eurth" } : null
    );
    const before = Date.now();
    await callerAs(OWNER, db).createGroupPost({ groupId: "board1", content: "Hello realm" });

    const data = db.thinkpagesPost.create.mock.calls[0]![0].data;
    expect(data.accountId).toBe("acc_eurth");
    expect(data.visibility).toBe("thinktank");
    expect(JSON.parse(data.hashtags)).toContain("group:board1");
    expect(data.ixTimeTimestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.ixTimeTimestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("a nation owner without a persona in the realm gets a citizen persona of their nation there", async () => {
    const db = makeDb();
    db.thinkpagesAccount.findFirst.mockResolvedValue(null);
    db.country.findUnique.mockResolvedValue({ name: "Gallambria" });
    db.thinkpagesAccount.create.mockResolvedValue({ id: "acc_new" });
    await callerAs(OWNER, db).createGroupPost({ groupId: "board1", content: "First post" });

    expect(db.thinkpagesAccount.create.mock.calls[0]![0].data).toMatchObject({
      clerkUserId: OWNER,
      countryId: "c_eurth",
      accountType: "citizen",
    });
    expect(db.thinkpagesPost.create.mock.calls[0]![0].data.accountId).toBe("acc_new");
  });

  it("rejects a persona of a nation outside the realm", async () => {
    const db = makeDb();
    db.thinkpagesAccount.findFirst.mockImplementation(async ({ where }: any) =>
      // The caller owns the persona, but its country is not in the realm.
      where.country ? null : { id: "acc_elsewhere" }
    );
    await expect(
      callerAs(OWNER, db).createGroupPost({
        groupId: "board1",
        accountId: "acc_elsewhere",
        content: "Hi",
      })
    ).rejects.toThrow(/persona of one of the realm's nations/);
    expect(db.thinkpagesPost.create).not.toHaveBeenCalled();
  });

  it("anyone, signed out included, can read the board feed", async () => {
    const db = makeDb();
    await expect(callerAs(null, db).getGroupFeed({ groupId: "board1" })).resolves.toMatchObject({
      posts: [],
    });
  });
});

describe("realm board membership is not group-managed", () => {
  it("an outsider cannot join; a nation owner can", async () => {
    const db = makeDb();
    await expect(callerAs(OUTSIDER, db).joinThinktank({ groupId: "board1" })).rejects.toThrow(
      /Only owners of a nation/
    );
    expect(db.thinktankMember.create).not.toHaveBeenCalled();

    await callerAs(OWNER, db).joinThinktank({ groupId: "board1" });
    expect(db.thinktankMember.create).toHaveBeenCalledWith({
      data: { groupId: "board1", userId: OWNER, role: "member" },
    });
  });

  it("even its moderator cannot delete it, invite to it or change its type", async () => {
    const db = makeDb();
    const founder = callerAs(FOUNDER, db);
    await expect(founder.deleteThinktank({ groupId: "board1" })).rejects.toThrow(/realm board/);
    await expect(
      founder.inviteToThinktank({ groupId: "board1", userIds: [OUTSIDER] })
    ).rejects.toThrow(/realm board/);
    await expect(founder.updateThinktank({ groupId: "board1", type: "public" })).rejects.toThrow(
      /realm board/
    );
    expect(db.thinktankGroup.delete).not.toHaveBeenCalled();
    expect(db.thinktankInvite.createMany).not.toHaveBeenCalled();
    expect(db.thinktankGroup.update).not.toHaveBeenCalled();
  });

  it("its moderator can save its settings form, which resends the unchanged type", async () => {
    const db = makeDb();
    await callerAs(FOUNDER, db).updateThinktank({
      groupId: "board1",
      name: "Eurth Hall",
      type: "realm_board",
    });
    expect(db.thinktankGroup.update.mock.calls[0]![0].data).toMatchObject({
      name: "Eurth Hall",
      type: "realm_board",
    });
  });

  it("an ordinary group cannot be turned into a realm board", async () => {
    const db = makeDb();
    db.thinktankGroup.findUnique.mockResolvedValue({ ...BOARD, id: "g1", type: "public" });
    await expect(
      callerAs(FOUNDER, db).updateThinktank({ groupId: "g1", type: "realm_board" })
    ).rejects.toThrow(/realm board/);
    expect(db.thinktankGroup.update).not.toHaveBeenCalled();
  });

  it("realm boards are left out of the ThinkTanks directory", async () => {
    const db = makeDb();
    await callerAs(OUTSIDER, db).getThinktanks({ type: "all" });
    expect(db.thinktankGroup.findMany.mock.calls[0]![0].where.type).toEqual({
      not: "realm_board",
    });
  });
});

describe("realm board moderation", () => {
  it("a member who does not moderate cannot remove posts", async () => {
    const db = makeDb();
    await expect(
      callerAs(OWNER, db).removeGroupPost({ groupId: "board1", postId: "p1" })
    ).rejects.toThrow(/owner or a group admin/);
    expect(db.thinkpagesPost.update).not.toHaveBeenCalled();
  });

  it("the realm's founder removes a post from the board and hides it", async () => {
    const db = makeDb();
    db.thinkpagesPost.findFirst.mockResolvedValue({
      id: "p1",
      hashtags: JSON.stringify(["lore", "group:board1"]),
    });
    await callerAs(FOUNDER, db).removeGroupPost({ groupId: "board1", postId: "p1" });
    expect(db.thinkpagesPost.findFirst.mock.calls[0]![0].where).toEqual({
      id: "p1",
      hashtags: { contains: '"group:board1"' },
    });
    expect(db.thinkpagesPost.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { visibility: "removed", hashtags: JSON.stringify(["lore"]) },
    });
  });
});
