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
import { getRealmBoardAccess } from "~/server/shared/realm-board";
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
  it("includes embassy posts from active partners, labelled with their realm", async () => {
    const db = makeDb();
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
    expect(where.OR).toEqual([
      { hashtags: { contains: "group:board1" } },
      { visibility: { not: "removed" }, hashtags: { contains: '"embassy:terra"' } },
    ]);
    expect(feed.posts[0]?.embassyFrom).toMatchObject({ name: "Terra", slug: "terra" });
  });
});
