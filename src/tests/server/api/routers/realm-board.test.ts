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
import { getRealmBoardAccess } from "~/server/shared/realm-board";

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
  it("an ordinary group cannot be turned into a realm board", async () => {
    const db = makeDb();
    db.thinktankGroup.findUnique.mockResolvedValue({ ...BOARD, id: "g1", type: "public" });
    await expect(
      callerAs(FOUNDER, db).updateThinktank({ groupId: "g1", type: "realm_board" })
    ).rejects.toThrow(/realm board/);
    expect(db.thinktankGroup.update).not.toHaveBeenCalled();
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
});

/**
 * Realm boards on the region page: officers with the board power moderate, muted nations can't post,
 * banned nations aren't members, and embassy-flagged posts show on partner realms' boards.
 *
 * `jest` is the ambient global because the hoisted jest.mock() factory calls jest.fn() inline.
 */
describe("board restrictions follow the player", () => {
  const createCaller = createCallerFactory(thinkpagesThinktanksRouter);
  type Db = ReturnType<typeof createMockPrisma>;
  const FOUNDER = "user_founder";
  const OWNER = "user_nation_owner";
  const OFFICER = "user_officer";
  const BOARD = {
    id: "board1",
    name: "Eurth Board",
    type: "realm_board",
    createdBy: FOUNDER,
    isActive: true,
    settings: JSON.stringify({ allowPersonaPosting: true }),
    conversationId: "conv1",
  };
  function makeDb(restriction: { kind: string; until: Date | null } | null = null): Db {
    const db = createMockPrisma();
    db.thinktankGroup.findUnique.mockResolvedValue(BOARD);
    db.realmBoard.findUnique.mockResolvedValue({ realmId: "eurth", groupId: "board1" });
    db.realm.findUnique.mockResolvedValue({ ownerId: FOUNDER });
    db.user.findUnique.mockImplementation(async ({ where }: any) => ({
      id: `db_${where.clerkUserId}`,
      clerkUserId: where.clerkUserId,
      role: null,
    }));
    db.country.findMany.mockImplementation(async ({ where }: any) =>
      where.ownerUserId === `db_${OWNER}` ? [{ id: "c_eurth" }] : []
    );
    db.realmOfficer.findMany.mockImplementation(async ({ where }: any) =>
      where.userId === OFFICER ? [{ userId: OFFICER, powers: ["board"] }] : []
    );
    db.realmBoardBan.findMany.mockResolvedValue(
      restriction ? [{ countryId: "c_eurth", reason: "Spam", ...restriction }] : []
    );
    db.thinkpagesAccount.findFirst.mockResolvedValue({ id: "acc_owner" });
    db.thinkpagesPost.create.mockImplementation(async ({ data }: any) => ({ id: "p1", ...data }));
    return db;
  }
  function callerAs(userId: string, db: Db) {
    return createCaller(
      createMockRouterContext({
        auth: { userId },
        user: { id: `db_${userId}`, clerkUserId: userId, isActive: true },
        db,
        rateLimitIdentifier: `${userId}_${Math.random()}`,
      }) as never
    );
  }
  describe("board access on the region page", () => {
    it("takes a banned owner off the board", async () => {
      const access = await getRealmBoardAccess(
        makeDb({ kind: "ban", until: null }) as never,
        "board1",
        OWNER
      );
      expect(access.isMember).toBe(false);
    });
  });
  describe("a board restriction follows the player who held the nation", () => {
    const BANNED_AT = new Date("2026-05-01");
    const day = (iso: string) => new Date(iso);
    const NEXT = "user_next_owner";

    /** c_eurth was claimed by OWNER, banned, then left; NEXT claimed it afterwards. OWNER now owns c_other. */
    function abandonedDb() {
      const db = makeDb();
      db.country.findMany.mockImplementation(async ({ where }: any) => {
        if (where.ownerUserId === `db_${OWNER}`) return [{ id: "c_other" }];
        if (where.ownerUserId === `db_${NEXT}`) return [{ id: "c_eurth" }];
        return [];
      });
      const claims = [
        { userId: `db_${OWNER}`, countryId: "c_eurth", reviewedAt: day("2026-04-01") },
        { userId: `db_${OWNER}`, countryId: "c_other", reviewedAt: day("2026-04-02") },
        { userId: `db_${NEXT}`, countryId: "c_eurth", reviewedAt: day("2026-06-01") },
      ];
      db.realmClaim.findMany.mockImplementation(async ({ where }: any) =>
        claims.filter(
          (c) =>
            (!where.userId || c.userId === where.userId) &&
            (!where.countryId?.in || where.countryId.in.includes(c.countryId))
        )
      );
      db.realmBoardBan.findMany.mockImplementation(async ({ where }: any) =>
        where.countryId.in.includes("c_eurth")
          ? [
              {
                countryId: "c_eurth",
                kind: "ban",
                until: null,
                reason: "Spam",
                createdAt: BANNED_AT,
              },
            ]
          : []
      );
      return db;
    }

    it("keeps a banned player off the board after they abandon the nation", async () => {
      const access = await getRealmBoardAccess(abandonedDb() as never, "board1", OWNER);
      expect(access.ownedCountryIds).toEqual(["c_other"]);
      expect(access.isMember).toBe(false);
      expect(access.restriction).toMatchObject({ kind: "ban", reason: "Spam" });
    });

    it("never passes the restriction to the nation's next claimant", async () => {
      const access = await getRealmBoardAccess(abandonedDb() as never, "board1", NEXT);
      expect(access).toMatchObject({ isMember: true, restriction: null });
    });
  });
  describe("posting to a realm board", () => {
    it("refuses a muted nation's post with the reason", async () => {
      const db = makeDb({ kind: "mute", until: null });
      await expect(
        callerAs(OWNER, db).createGroupPost({ groupId: "board1", content: "Hello" })
      ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringMatching(/muted.*Spam/) });
      expect(db.thinkpagesPost.create).not.toHaveBeenCalled();
    });
    it("drops forged board and embassy tags", async () => {
      const db = makeDb();
      await callerAs(OWNER, db).createGroupPost({
        groupId: "board1",
        content: "Sneaky",
        hashtags: ["group:other_board", "embassy:terra", "news"],
      });
      const tags = JSON.parse(db.thinkpagesPost.create.mock.calls[0][0].data.hashtags);
      expect(tags.sort()).toEqual(["group:board1", "news"]);
    });
  });
});
