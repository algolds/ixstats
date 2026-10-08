/**
 * Realm boards on the region page: officers with the board power moderate, muted nations can't post,
 * banned nations aren't members, and embassy-flagged posts show on partner realms' boards.
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
import {
  getRealmBoardAccess,
  ownHashtags,
  storedPseudoTags,
  syncRealmBoardMembers,
} from "~/server/shared/realm-board";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

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
  it("makes an officer with the board power a manager", async () => {
    const access = await getRealmBoardAccess(makeDb() as never, "board1", OFFICER);
    expect(access).toMatchObject({ isManager: true, isMember: true, restriction: null });
  });

  it("keeps a muted owner a member, with the mute attached", async () => {
    const access = await getRealmBoardAccess(
      makeDb({ kind: "mute", until: null }) as never,
      "board1",
      OWNER
    );
    expect(access.isMember).toBe(true);
    expect(access.restriction).toMatchObject({ kind: "mute" });
  });

  it("takes a banned owner off the board", async () => {
    const access = await getRealmBoardAccess(
      makeDb({ kind: "ban", until: null }) as never,
      "board1",
      OWNER
    );
    expect(access.isMember).toBe(false);
  });

  it("only counts restrictions still in force", async () => {
    const db = makeDb();
    await getRealmBoardAccess(db as never, "board1", OWNER);
    expect(db.realmBoardBan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          countryId: { in: ["c_eurth"] },
          OR: [{ until: null }, { until: { gt: expect.any(Date) } }],
        }),
      })
    );
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
      !where.countryId || where.countryId.in.includes("c_eurth")
        ? [{ countryId: "c_eurth", kind: "ban", until: null, reason: "Spam", createdAt: BANNED_AT }]
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

  it("drops the banned player from the board on sync, and keeps the next claimant", async () => {
    const db = abandonedDb();
    db.thinktankMember.findMany.mockResolvedValue([
      { id: "m1", userId: OWNER, isActive: true },
      { id: "m2", userId: NEXT, isActive: true },
    ]);
    db.country.findMany.mockResolvedValue([
      { id: "c_other", ownerUserId: `db_${OWNER}`, owner: { clerkUserId: OWNER } },
      { id: "c_eurth", ownerUserId: `db_${NEXT}`, owner: { clerkUserId: NEXT } },
    ]);
    await syncRealmBoardMembers(
      db as never,
      { groupId: "board1", realmId: "eurth", conversationId: "conv1", realmOwnerId: FOUNDER },
      null
    );
    expect(db.thinktankMember.updateMany).toHaveBeenCalledWith({
      where: { groupId: "board1", userId: { in: [OWNER] } },
      data: { isActive: false },
    });
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

  it("tags an embassy-flagged post with the realm", async () => {
    const db = makeDb();
    await callerAs(OWNER, db).createGroupPost({
      groupId: "board1",
      content: "Greetings, friends",
      embassy: true,
    });
    const tags = JSON.parse(db.thinkpagesPost.create.mock.calls[0][0].data.hashtags);
    expect(tags).toEqual(expect.arrayContaining(["group:board1", "embassy:eurth"]));
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

describe("the board feed", () => {
  it("includes embassy posts made on active partners' own boards, labelled with their realm", async () => {
    const db = makeDb();
    db.realmBoard.findMany.mockResolvedValue([{ realmId: "terra", groupId: "terra_board" }]);
    db.realmEmbassy.findMany.mockResolvedValue([
      {
        fromRealmId: "eurth",
        fromRealm: { id: "eurth", name: "Eurth", slug: "eurth" },
        toRealm: { id: "terra", name: "Terra", slug: "terra" },
      },
    ]);
    db.thinkpagesPost.findMany.mockResolvedValue([
      {
        id: "x1",
        hashtags: JSON.stringify(["group:terra_board", "embassy:terra"]),
        account: null,
        _count: { reactions: 0, replies: 0, reposts: 0 },
      },
    ]);
    const feed = await callerAs(OWNER, db).getGroupFeed({ groupId: "board1" });
    const where = db.thinkpagesPost.findMany.mock.calls[0][0].where;
    // A forged embassy tag on a plain post isn't enough: it must be a board post on the partner's board.
    expect(where.OR).toEqual([
      { hashtags: { contains: "group:board1" } },
      {
        visibility: "thinktank",
        AND: [
          { hashtags: { contains: '"group:terra_board"' } },
          { hashtags: { contains: '"embassy:terra"' } },
        ],
      },
    ]);
    expect(feed.posts[0]?.embassyFrom).toMatchObject({ name: "Terra", slug: "terra" });
  });
});

describe("pseudo-tags", () => {
  it("are never taken from a caller", () => {
    expect(ownHashtags(["news", "group:b1", "#embassy:eurth", "Group:x", "embassy-tour"])).toEqual([
      "news",
      "embassy-tour",
    ]);
  });

  it("are kept from the stored post when its tags are edited", () => {
    expect(storedPseudoTags(JSON.stringify(["group:b1", "news", "embassy:eurth"]))).toEqual([
      "group:b1",
      "embassy:eurth",
    ]);
    expect(storedPseudoTags("not json")).toEqual([]);
  });
});

describe("board membership sync", () => {
  it("drops a player banned on one nation even when they own another there", async () => {
    const db = makeDb();
    db.thinktankMember.findMany.mockResolvedValue([{ id: "m1", userId: OWNER, isActive: true }]);
    db.country.findMany.mockResolvedValue([
      { id: "c_x", ownerUserId: `db_${OWNER}`, owner: { clerkUserId: OWNER } },
      { id: "c_y", ownerUserId: `db_${OWNER}`, owner: { clerkUserId: OWNER } },
    ]);
    db.realmBoardBan.findMany.mockResolvedValue([
      { countryId: "c_x", kind: "ban", until: null, reason: null },
    ]);
    await syncRealmBoardMembers(
      db as never,
      { groupId: "board1", realmId: "eurth", conversationId: "conv1", realmOwnerId: FOUNDER },
      null
    );
    expect(db.thinktankMember.updateMany).toHaveBeenCalledWith({
      where: { groupId: "board1", userId: { in: [OWNER] } },
      data: { isActive: false },
    });
    expect(db.conversationParticipant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId: "conv1", userId: { in: [OWNER] } } })
    );
  });
});
