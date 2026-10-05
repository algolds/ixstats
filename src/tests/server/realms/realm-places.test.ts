/** @jest-environment node */
/**
 * Realms as places: the board opens (and is created) on demand with membership synced from nation
 * ownership, and the directory reports real nation counts and board activity.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { Prisma } from "@prisma/client";
import { realmsRouter } from "~/server/api/routers/realms";
import { DIRECTORY_REALM_WHERE } from "~/server/api/routers/realms/places";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Db = ReturnType<typeof createMockPrisma>;

const FOUNDER = "clerk_founder";
const OWNER = "clerk_owner";
const EX_OWNER = "clerk_ex_owner";
const OUTSIDER = "clerk_outsider";

/** A realm "eurth" whose board exists when `boardExists`; OWNER owns nation c1 there. */
function makeDb({ boardExists }: { boardExists: boolean }): Db {
  const db = createMockPrisma();
  let board = boardExists ? { realmId: "eurth", groupId: "board1" } : null;
  db.realm.findUnique.mockImplementation(async ({ where }: any) =>
    where.slug === "eurth" || where.id === "eurth"
      ? { id: "eurth", slug: "eurth", name: "Eurth", ownerId: FOUNDER }
      : null
  );
  db.realmBoard.findUnique.mockImplementation(async () => board);
  db.realmBoard.create.mockImplementation(async ({ data }: any) => {
    board = data;
    return data;
  });
  db.thinkshareConversation.create.mockResolvedValue({ id: "conv1" });
  db.thinktankGroup.create.mockResolvedValue({ id: "board1" });
  db.thinktankGroup.findUnique.mockResolvedValue({ id: "board1", conversationId: "conv1" });
  db.user.findUnique.mockImplementation(async ({ where }: any) => ({
    id: `db_${where.clerkUserId}`,
    clerkUserId: where.clerkUserId,
    role: null,
  }));
  db.country.findMany.mockImplementation(async ({ where }: any) => {
    if (where.ownerUserId === `db_${OWNER}`) return [{ id: "c1" }];
    if (where.ownerUserId?.not === null) return [{ owner: { clerkUserId: OWNER } }];
    return [];
  });
  return db;
}

function callerAs(clerkUserId: string | null, db: Db) {
  return realmsRouter.createCaller(
    createMockRouterContext({
      db,
      auth: clerkUserId ? { userId: clerkUserId } : null,
      user: clerkUserId ? { id: `db_${clerkUserId}`, clerkUserId } : null,
    }) as never
  );
}

describe("realms.getBoard", () => {
  it("creates the board on first open and joins a nation owner to it and its chat", async () => {
    const db = makeDb({ boardExists: false });
    const result = await callerAs(OWNER, db).getBoard({ slug: "eurth" });

    expect(db.thinktankGroup.create.mock.calls[0]![0].data).toMatchObject({
      type: "realm_board",
      createdBy: FOUNDER,
      conversationId: "conv1",
    });
    expect(db.realmBoard.create).toHaveBeenCalledWith({
      data: { realmId: "eurth", groupId: "board1" },
    });
    expect(db.thinktankMember.create).toHaveBeenCalledWith({
      data: { groupId: "board1", userId: OWNER, role: "member" },
    });
    expect(db.conversationParticipant.upsert.mock.calls[0]![0].create).toMatchObject({
      conversationId: "conv1",
      userId: OWNER,
    });
    expect(result).toEqual({
      groupId: "board1",
      realm: { id: "eurth", slug: "eurth", name: "Eurth" },
      canPost: true,
      canModerate: false,
      ownedCountryIds: ["c1"],
    });
  });

  it("reuses an existing board and gives an outsider read-only access without joining them", async () => {
    const db = makeDb({ boardExists: true });
    const result = await callerAs(OUTSIDER, db).getBoard({ slug: "eurth" });
    expect(db.thinktankGroup.create).not.toHaveBeenCalled();
    expect(db.thinktankMember.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ canPost: false, canModerate: false, ownedCountryIds: [] });
  });

  it("the realm's founder moderates it", async () => {
    const db = makeDb({ boardExists: true });
    const result = await callerAs(FOUNDER, db).getBoard({ slug: "eurth" });
    expect(result).toMatchObject({ canPost: true, canModerate: true });
  });

  it("drops members who no longer own a nation in the realm, from the board and its chat", async () => {
    const db = makeDb({ boardExists: true });
    db.thinktankMember.findMany.mockResolvedValue([
      { id: "m1", userId: OWNER, isActive: true },
      { id: "m2", userId: EX_OWNER, isActive: true },
    ]);
    await callerAs(null, db).getBoard({ slug: "eurth" });

    expect(db.thinktankMember.updateMany).toHaveBeenCalledWith({
      where: { groupId: "board1", userId: { in: [EX_OWNER] } },
      data: { isActive: false },
    });
    expect(db.conversationParticipant.updateMany.mock.calls[0]![0].where).toEqual({
      conversationId: "conv1",
      userId: { in: [EX_OWNER] },
    });
    expect(db.thinktankGroup.update).toHaveBeenCalledWith({
      where: { id: "board1" },
      data: { memberCount: 1 },
    });
  });

  it("when two first opens race, the loser returns the winner's board", async () => {
    const db = makeDb({ boardExists: false });
    let reads = 0;
    db.realmBoard.findUnique.mockImplementation(async () =>
      reads++ === 0 ? null : { realmId: "eurth", groupId: "board_winner" }
    );
    db.realmBoard.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6",
      })
    );
    db.thinktankGroup.findUnique.mockResolvedValue({ id: "board_winner", conversationId: "c2" });
    const result = await callerAs(null, db).getBoard({ slug: "eurth" });
    expect(result.groupId).toBe("board_winner");
  });

  it("an unknown realm is NOT_FOUND", async () => {
    const db = makeDb({ boardExists: true });
    await expect(callerAs(null, db).getBoard({ slug: "nowhere" })).rejects.toThrow(
      /Realm not found/
    );
  });

  it("a draft or generating realm's board opens for its founder only (AT-6)", async () => {
    for (const status of ["draft", "generating"]) {
      const db = makeDb({ boardExists: true });
      db.realm.findUnique.mockResolvedValue({
        id: "eurth",
        slug: "eurth",
        name: "Eurth",
        ownerId: FOUNDER,
        status,
      });
      await expect(callerAs(OUTSIDER, db).getBoard({ slug: "eurth" })).rejects.toThrow(
        /Realm not found/
      );
      await expect(callerAs(null, db).getBoard({ slug: "eurth" })).rejects.toThrow(
        /Realm not found/
      );
      await expect(callerAs(FOUNDER, db).getBoard({ slug: "eurth" })).resolves.toMatchObject({
        canModerate: true,
      });
    }
  });

  it("an unlisted or archived realm's board stays readable by link", async () => {
    for (const status of ["active", "archived"]) {
      const db = makeDb({ boardExists: true });
      db.realm.findUnique.mockResolvedValue({
        id: "eurth",
        slug: "eurth",
        name: "Eurth",
        ownerId: FOUNDER,
        status,
        visibility: "unlisted",
      });
      await expect(callerAs(OUTSIDER, db).getBoard({ slug: "eurth" })).resolves.toMatchObject({
        canPost: false,
      });
    }
  });
});

describe("realms.directory", () => {
  it("lists open realms with nation counts, the viewer's holdings and board activity", async () => {
    const db = makeDb({ boardExists: true });
    const lastPostAt = new Date("2026-09-29T12:00:00Z");
    db.realm.findMany.mockResolvedValue([
      {
        id: "eurth",
        slug: "eurth",
        name: "Eurth",
        description: null,
        thumbnail: null,
        settings: { maxNationsPerUser: 3 },
        _count: { countries: 4 },
      },
      {
        id: "quiet",
        slug: "quiet",
        name: "Quiet",
        description: null,
        thumbnail: null,
        settings: null,
        _count: { countries: 1 },
      },
    ]);
    db.country.groupBy.mockImplementation(async ({ where }: any) =>
      where.ownerUserId === null
        ? [{ realmId: "eurth", _count: { _all: 2 } }]
        : [{ realmId: "eurth", _count: { _all: 1 } }]
    );
    db.realmBoard.findMany.mockResolvedValue([{ realmId: "eurth", groupId: "board1" }]);
    db.thinkpagesPost.count.mockResolvedValue(5);
    db.thinkpagesPost.findFirst.mockResolvedValue({ createdAt: lastPostAt });

    const rows = await callerAs(OWNER, db).directory();

    expect(db.realm.findMany.mock.calls[0]![0].where).toEqual(DIRECTORY_REALM_WHERE);
    expect(db.thinkpagesPost.count.mock.calls[0]![0].where.hashtags).toEqual({
      contains: '"group:board1"',
    });
    expect(rows).toEqual([
      expect.objectContaining({
        id: "eurth",
        nationCount: 4,
        openNationCount: 2,
        myNationCount: 1,
        maxNationsPerUser: 3,
        board: { recentPosts: 5, lastPostAt },
      }),
      expect.objectContaining({
        id: "quiet",
        nationCount: 1,
        openNationCount: 0,
        myNationCount: 0,
        maxNationsPerUser: 1,
        board: null,
      }),
    ]);
    expect(rows[0]).not.toHaveProperty("settings");
  });
});
