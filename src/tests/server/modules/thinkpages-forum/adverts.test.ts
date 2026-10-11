/** @jest-environment node */
jest.mock("~/server/modules/thinkpages-forum/writes", () => ({
  ...jest.requireActual("~/server/modules/thinkpages-forum/writes"),
  createThread: jest.fn(),
}));

import { Prisma } from "@prisma/client";
import {
  ADVERT_HIDDEN_NOTICE,
  ADVERT_POWER_NOTICE,
  ADVERT_UNLOCK_NOTICE,
} from "~/lib/thinkpages-forum/adverts";
import {
  advertRealmsOf,
  advertStatus,
  createAdvert,
  setAdvertLocked,
} from "~/server/modules/thinkpages-forum/adverts";
import { createThread } from "~/server/modules/thinkpages-forum/writes";
import { banRow, forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";

const USER = { name: "user", level: 100 };
const user = (id: string, clerkUserId: string, extra: object = {}) => ({
  id,
  clerkUserId,
  countryId: null,
  role: USER,
  ...extra,
});
const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const founder = user("u_f", "founder");
const officer = user("u_o", "officer");
const boardOnly = user("u_b", "boarder");
const member = user("u_m", "member");
const moderator = user("u_mod", "mod", {
  mod: { siteAdmin: false, realmIds: [], categoryIds: ["cat_find"] },
});

const EURTH = { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" };
const GRANTS = [
  { userId: "officer", powers: ["appearance"] },
  { userId: "boarder", powers: ["board"] },
];
const FIND = { id: "cat_find", scope: "site", realmId: null };

interface Over {
  realm?: object | null;
  /** The thread `advertRealmId` finds (the realm's advert). */
  advert?: { id: string; hidden: boolean } | null;
  /** The thread `findUnique({ where: { id } })` finds. */
  thread?: object | null;
  bans?: BanRow[];
}

function advertDb(over: Over = {}) {
  const realm = over.realm === undefined ? EURTH : over.realm;
  return {
    realm: {
      findUnique: jest.fn(async (_args?: object) => realm),
      findMany: jest.fn(async (_args?: object) => [] as object[]),
    },
    realmOfficer: {
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) =>
        GRANTS.filter((g) => g.userId === where.userId)
      ),
    },
    forumBan: forumBanFake(over.bans),
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "u_a" ? admin : { id: where.id, clerkUserId: where.id, role: USER }
      ),
    },
    forumThread: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; advertRealmId?: string } }) =>
        where.advertRealmId !== undefined ? (over.advert ?? null) : (over.thread ?? null)
      ),
      update: jest.fn(async (_args?: object) => ({})),
    },
  };
}

const NEW = { realm: "eurth", title: "Join Eurth", wikitext: "Come and play." };
const CREATED = { threadId: "t_new", postId: "p_new", formatting: "done" as const, reward: null };

beforeEach(() => {
  jest.mocked(createThread).mockReset();
  jest.mocked(createThread).mockResolvedValue(CREATED);
});

describe("createAdvert", () => {
  it.each([
    ["the founder", founder],
    ["an officer with the appearance power", officer],
    ["a site admin", admin],
  ])(
    "lets %s create the advert through createThread, fixed to Find a Realm and the realm, and returns its reward",
    async (_who, actor) => {
      const db = advertDb();
      await expect(createAdvert(db as never, actor, NEW)).resolves.toEqual(CREATED);
      expect(createThread).toHaveBeenCalledWith(
        db,
        actor,
        {
          categoryKey: "find-a-realm",
          title: "Join Eurth",
          html: undefined,
          wikitext: "Come and play.",
        },
        { advertRealmId: "r_eurth" }
      );
    }
  );

  it.each([
    ["an officer without the appearance power", boardOnly],
    ["a plain member", member],
  ])("refuses %s", async (_who, actor) => {
    await expect(createAdvert(advertDb() as never, actor, NEW)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(createThread).not.toHaveBeenCalled();
  });

  it("reads an unknown realm, and a draft realm to a member, as not found", async () => {
    await expect(
      createAdvert(advertDb({ realm: null }) as never, founder, NEW)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const draft = { ...EURTH, status: "draft" };
    await expect(
      createAdvert(advertDb({ realm: draft }) as never, member, NEW)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      createAdvert(advertDb({ realm: draft }) as never, officer, NEW)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets the founder advertise a draft realm (the advert stays hidden until it is published)", async () => {
    const draft = { ...EURTH, status: "draft" };
    await expect(
      createAdvert(advertDb({ realm: draft }) as never, founder, NEW)
    ).resolves.toMatchObject({
      threadId: "t_new",
    });
  });

  it("refuses an archived realm, even to its founder", async () => {
    const archived = { ...EURTH, status: "archived" };
    await expect(
      createAdvert(advertDb({ realm: archived }) as never, founder, NEW)
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "An archived realm cannot be advertised, and its advert stays locked.",
    });
    expect(createThread).not.toHaveBeenCalled();
  });

  it("refuses IxWorld, by either slug and for a site admin, since it has no realm row to carry an advert", async () => {
    for (const slug of ["ixworld", "default"]) {
      await expect(
        createAdvert(advertDb({ realm: null }) as never, admin, { ...NEW, realm: slug })
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "IxWorld has no advert." });
    }
    expect(createThread).not.toHaveBeenCalled();
  });

  it("answers a second advert with CONFLICT carrying the first thread's id", async () => {
    const db = advertDb({ advert: { id: "t_old", hidden: false } });
    await expect(createAdvert(db as never, founder, NEW)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This realm already has an advert.",
      context: { threadId: "t_old" },
    });
    expect(createThread).not.toHaveBeenCalled();
  });

  it("names the existing advert only to a manager of a realm the actor can see", async () => {
    const taken = { advert: { id: "t_old", hidden: false } };
    await expect(createAdvert(advertDb(taken) as never, member, NEW)).rejects.toMatchObject({
      code: "FORBIDDEN",
      context: undefined,
    });
    const draft = { realm: { ...EURTH, status: "draft" }, ...taken };
    await expect(createAdvert(advertDb(draft) as never, member, NEW)).rejects.toMatchObject({
      code: "NOT_FOUND",
      context: undefined,
    });
  });

  it("says a moderator hid the realm's advert, and names no thread", async () => {
    const db = advertDb({ advert: { id: "t_old", hidden: true } });
    const error = await createAdvert(db as never, founder, NEW).catch((e: Error) => e);
    expect(error).toMatchObject({ code: "CONFLICT", message: ADVERT_HIDDEN_NOTICE });
    expect(error).toHaveProperty("context", undefined);
    expect(createThread).not.toHaveBeenCalled();
  });

  it("maps a race lost to the unique index to the same CONFLICT with the winner's id", async () => {
    const db = advertDb();
    db.forumThread.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "t_race", hidden: false } as never);
    jest.mocked(createThread).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["advertRealmId"] },
      })
    );
    await expect(createAdvert(db as never, founder, NEW)).rejects.toMatchObject({
      code: "CONFLICT",
      context: { threadId: "t_race" },
    });
    expect(db.forumThread.findUnique).toHaveBeenLastCalledWith({
      where: { advertRealmId: "r_eurth" },
      select: { id: true, hidden: true },
    });
  });

  it("does not report another unique violation as an existing advert", async () => {
    const other = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["activityId"] },
    });
    const db = advertDb();
    jest.mocked(createThread).mockRejectedValue(other);
    await expect(createAdvert(db as never, founder, NEW)).rejects.toBe(other);
    expect(db.forumThread.findUnique).toHaveBeenCalledTimes(1);
  });

  it("passes any other refusal through unchanged", async () => {
    const refusal = Object.assign(new Error("closed"), { code: "FORBIDDEN" });
    jest.mocked(createThread).mockRejectedValue(refusal);
    await expect(createAdvert(advertDb() as never, founder, NEW)).rejects.toBe(refusal);
  });
});

describe("advertRealmsOf", () => {
  it("lists only the realms createAdvert would accept: founded, or served with the appearance power in a published realm, never archived or IxWorld", async () => {
    const db = advertDb();
    db.realm.findMany.mockResolvedValue([
      { slug: "eurth", name: "Eurth", advertThread: { id: "t_ad", hidden: false } },
      { slug: "zeta", name: "Zeta", advertThread: null },
    ]);
    await expect(advertRealmsOf(db as never, officer)).resolves.toEqual([
      { slug: "eurth", name: "Eurth", advertThreadId: "t_ad" },
      { slug: "zeta", name: "Zeta", advertThreadId: null },
    ]);
    expect(db.realm.findMany).toHaveBeenCalledWith({
      where: {
        status: { not: "archived" },
        id: { not: "default" },
        OR: [
          { ownerId: "officer" },
          {
            status: { notIn: ["draft", "generating"] },
            officers: { some: { userId: "officer", powers: { has: "appearance" } } },
          },
        ],
      },
      orderBy: { name: "asc" },
      select: { slug: true, name: true, advertThread: { select: { id: true, hidden: true } } },
    });
  });

  it("offers no thread to open for an advert a moderator hid", async () => {
    const db = advertDb();
    db.realm.findMany.mockResolvedValue([
      { slug: "eurth", name: "Eurth", advertThread: { id: "t_ad", hidden: true } },
    ]);
    await expect(advertRealmsOf(db as never, founder)).resolves.toEqual([
      { slug: "eurth", name: "Eurth", advertThreadId: null },
    ]);
  });
});

describe("advertStatus", () => {
  it("tells a manager the realm's advert thread id, or null", async () => {
    const taken = advertDb({ advert: { id: "t_old", hidden: false } });
    await expect(advertStatus(taken as never, officer, "eurth")).resolves.toEqual({
      threadId: "t_old",
      hiddenByModerator: false,
    });
    await expect(advertStatus(advertDb() as never, founder, "eurth")).resolves.toEqual({
      threadId: null,
      hiddenByModerator: false,
    });
  });

  it("tells a manager a moderator hid the advert, with no thread id to open", async () => {
    const hidden = advertDb({ advert: { id: "t_old", hidden: true } });
    await expect(advertStatus(hidden as never, founder, "eurth")).resolves.toEqual({
      threadId: null,
      hiddenByModerator: true,
    });
  });

  it("refuses everyone else, and reads an unknown or hidden realm as not found", async () => {
    await expect(advertStatus(advertDb() as never, member, "eurth")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      advertStatus(advertDb({ realm: null }) as never, founder, "nope")
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const draft = { ...EURTH, status: "draft" };
    await expect(
      advertStatus(advertDb({ realm: draft }) as never, member, "eurth")
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      advertStatus(advertDb({ realm: null }) as never, admin, "ixworld")
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("setAdvertLocked", () => {
  const advertThread = (over: object = {}) => ({
    id: "t_ad",
    hidden: false,
    advertRealm: EURTH,
    category: FIND,
    ...over,
  });
  const lock = (db: ReturnType<typeof advertDb>, actor: object, locked: boolean) =>
    setAdvertLocked(db as never, actor as never, { threadId: "t_ad", locked });

  it("lets a manager lock the advert", async () => {
    for (const actor of [officer, founder, admin]) {
      const db = advertDb({ thread: advertThread() });
      await expect(lock(db, actor, true)).resolves.toEqual({ locked: true });
      expect(db.forumThread.update).toHaveBeenCalledWith({
        where: { id: "t_ad" },
        data: { locked: true },
      });
    }
  });

  it("lets only a moderator unlock it: an officer and the founder cannot", async () => {
    for (const actor of [officer, founder]) {
      const db = advertDb({ thread: advertThread() });
      await expect(lock(db, actor, false)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: ADVERT_UNLOCK_NOTICE,
      });
      expect(db.forumThread.update).not.toHaveBeenCalled();
    }
    for (const actor of [moderator, admin]) {
      const db = advertDb({ thread: advertThread() });
      await expect(lock(db, actor, false)).resolves.toEqual({ locked: false });
      expect(db.forumThread.update).toHaveBeenCalledWith({
        where: { id: "t_ad" },
        data: { locked: false },
      });
    }
  });

  it("lets a Find a Realm moderator unlock, but not an advert a site admin wrote", async () => {
    const own = advertDb({ thread: advertThread({ authorUserId: "u_f" }) });
    await expect(lock(own, moderator, false)).resolves.toEqual({ locked: false });
    const adminsAdvert = advertDb({ thread: advertThread({ authorUserId: "u_a" }) });
    await expect(lock(adminsAdvert, moderator, false)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only site admins moderate a site admin's posts.",
    });
    expect(adminsAdvert.forumThread.update).not.toHaveBeenCalled();
    await expect(lock(adminsAdvert, admin, false)).resolves.toEqual({ locked: false });
  });

  it("does not let a moderator who is not a manager lock the advert", async () => {
    const db = advertDb({ thread: advertThread() });
    await expect(lock(db, moderator, true)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: ADVERT_POWER_NOTICE,
    });
    expect(db.forumThread.update).not.toHaveBeenCalled();
  });

  it("reads the advert of a draft realm as not found to an officer who does not found it", async () => {
    const draft = advertThread({ advertRealm: { ...EURTH, status: "draft" } });
    const db = advertDb({ thread: draft });
    await expect(lock(db, officer, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(lock(db, founder, true)).resolves.toEqual({ locked: true });
  });

  it("refuses an officer without the power and a member to lock it, writing nothing", async () => {
    const db = advertDb({ thread: advertThread() });
    await expect(lock(db, boardOnly, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(lock(db, member, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.forumThread.update).not.toHaveBeenCalled();
  });

  it("runs the ban check: a banned officer can neither lock nor change the lock, and a site ban binds a moderator too", async () => {
    const bans = [
      banRow({ userId: "u_o", scope: "site" }),
      banRow({ id: "b2", userId: "u_mod", scope: "category", scopeId: "cat_find" }),
    ];
    const db = advertDb({ thread: advertThread(), bans });
    await expect(lock(db, officer, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(lock(db, moderator, false)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.forumThread.update).not.toHaveBeenCalled();
    await expect(lock(db, founder, true)).resolves.toEqual({ locked: true });
  });

  it("reads a thread that is no advert, a hidden thread and an unknown thread as not found", async () => {
    for (const thread of [
      advertThread({ advertRealm: null }),
      advertThread({ hidden: true }),
      null,
    ]) {
      const db = advertDb({ thread });
      await expect(lock(db, founder, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(db.forumThread.update).not.toHaveBeenCalled();
    }
  });

  it("reads a hidden realm's advert as not found to a member, and leaves an archived one locked", async () => {
    const draft = advertThread({ advertRealm: { ...EURTH, status: "draft" } });
    await expect(lock(advertDb({ thread: draft }), member, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const archived = advertThread({ advertRealm: { ...EURTH, status: "archived" } });
    const db = advertDb({ thread: archived });
    await expect(lock(db, founder, true)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(lock(db, admin, false)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.forumThread.update).not.toHaveBeenCalled();
  });
});
