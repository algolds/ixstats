/** @jest-environment node */
jest.mock("~/server/modules/thinkpages-forum/writes", () => ({
  ...jest.requireActual("~/server/modules/thinkpages-forum/writes"),
  createThread: jest.fn(),
}));

import { Prisma } from "@prisma/client";
import { ADVERT_HIDDEN_NOTICE, ADVERT_UNLOCK_NOTICE } from "~/lib/thinkpages-forum/adverts";
import {
  advertRealmsOf,
  advertStatus,
  createAdvert,
  setAdvertLocked,
} from "~/server/modules/thinkpages-forum/adverts";
import { createThread } from "~/server/modules/thinkpages-forum/writes";
import { banRow, forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";
import {
  advertGate,
  advertHiddenFrom,
  advertRealmHiddenFrom,
  assertAdvertsOnly,
  canEditPost,
  canManageAdvert,
} from "~/server/modules/thinkpages-forum/advert-access";
import { canSeeRealm } from "~/server/modules/thinkpages-forum/realm-access";

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
const CREATED = { threadId: "t_new", postId: "p_new", formatting: "done" as const };

beforeEach(() => {
  jest.mocked(createThread).mockReset();
  jest.mocked(createThread).mockResolvedValue(CREATED);
});

describe("createAdvert", () => {
  it.each([["an officer with the appearance power", officer]])(
    "lets %s create the advert through createThread, fixed to Find a Realm and the realm",
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
});

describe("advertRealmsOf", () => {
  it("lists only the realms createAdvert would accept: founded, or served with the appearance power in a published realm, never archived or Ixnay", async () => {
    const db = advertDb();
    db.realm.findMany.mockResolvedValue([
      { slug: "eurth", name: "Eurth", advertThread: { id: "t_ad", hidden: false } },
      { slug: "zeta", name: "Zeta", advertThread: null },
    ]);
    await expect(advertRealmsOf(db as never, officer)).resolves.toEqual([
      { slug: "eurth", name: "Eurth", advertThreadId: "t_ad", hiddenByModerator: false },
      { slug: "zeta", name: "Zeta", advertThreadId: null, hiddenByModerator: false },
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
});

describe("advertStatus", () => {
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
      advertStatus(advertDb({ realm: null }) as never, admin, "ixnay")
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
});

describe("advert access", () => {
  const founder = {
    id: "u_f",
    clerkUserId: "founder",
    countryId: "c1",
    role: { name: "user", level: 100 },
  };
  const officer = {
    id: "u_o",
    clerkUserId: "officer",
    countryId: "c2",
    role: { name: "user", level: 100 },
  };
  const boardOnly = {
    id: "u_b",
    clerkUserId: "boarder",
    countryId: "c3",
    role: { name: "user", level: 100 },
  };
  const member = {
    id: "u_m",
    clerkUserId: "member",
    countryId: "c4",
    role: { name: "user", level: 100 },
  };
  const realm = {
    id: "r_eurth",
    slug: "eurth",
    name: "Eurth",
    status: "active",
    ownerId: "founder",
  };
  const GRANTS = [
    { userId: "officer", powers: ["appearance", "board"] },
    { userId: "boarder", powers: ["board"] },
  ];
  function officerDb() {
    return {
      realmOfficer: {
        findMany: jest.fn(async ({ where }: { where: { realmId: string; userId: string } }) =>
          GRANTS.filter((g) => g.userId === where.userId)
        ),
      },
      forumPost: {
        findFirst: jest.fn(async (_args?: object) => ({ id: "p_first" })),
      },
    };
  }
  describe("advertGate", () => {
    it("lets anonymous readers see adverts of published realms, ordinary threads and Ixnay only", () => {
      expect(advertGate(null)).toEqual({
        AND: [
          {
            OR: [
              { advertRealmId: null },
              { advertRealmId: "default" },
              { advertRealm: { status: { notIn: ["draft", "generating"] } } },
            ],
          },
        ],
      });
    });
  });
  /** Evaluates the one `advertGate` shape over a thread row, so the list gate can be held against the row check. */
  interface GateRow {
    advertRealmId: string | null;
    advertRealm: { status: string; ownerId: string } | null;
  }
  interface GateClause {
    advertRealmId?: string | null;
    advertRealm?: { status?: { notIn: string[] }; ownerId?: string };
  }
  function passesGate(gate: ReturnType<typeof advertGate>, row: GateRow): boolean {
    const parts = (gate.AND ?? []) as never as Array<{ OR: GateClause[] }>;
    return parts.every(({ OR }) =>
      OR.some((clause) => {
        if (clause.advertRealmId !== undefined) return row.advertRealmId === clause.advertRealmId;
        const cond = clause.advertRealm!;
        if (!row.advertRealm) return false;
        if (cond.status) return !cond.status.notIn.includes(row.advertRealm.status);
        return row.advertRealm.ownerId === cond.ownerId;
      })
    );
  }
  describe("advertGate agrees with canSeeRealm", () => {
    const viewers = { anonymous: null, member, founder };
    const statuses = ["draft"];

    for (const status of statuses) {
      for (const [name, viewer] of Object.entries(viewers)) {
        it(`for a ${status} realm and ${name}`, () => {
          const realmRow = { ...realm, status };
          const row = {
            advertRealmId: realm.id,
            advertRealm: { status, ownerId: realm.ownerId },
          };
          const visible = canSeeRealm(viewer, realmRow);
          expect(passesGate(advertGate(viewer), row)).toBe(visible);
          expect(advertRealmHiddenFrom(viewer, realmRow)).toBe(!visible);
        });
      }
    }
  });
  describe("Ixnay", () => {
    const ixnay = { ...realm, id: "default", slug: "ixnay", name: "Ixnay", status: "draft" };

    it("is never hidden, whatever its row says", async () => {
      expect(advertRealmHiddenFrom(member, ixnay)).toBe(false);
      const db = { realm: { findUnique: jest.fn(async (_args?: object) => ixnay) } };
      await expect(advertHiddenFrom(db as never, null, { advertRealmId: "default" })).resolves.toBe(
        false
      );
    });
  });
  describe("canManageAdvert", () => {
    it("holds for an officer with the appearance power", async () => {
      await expect(canManageAdvert(officerDb() as never, officer, realm)).resolves.toBe(true);
    });
    it("asks for this realm's grants for this user only", async () => {
      const db = officerDb();
      await canManageAdvert(db as never, officer, realm);
      expect(db.realmOfficer.findMany).toHaveBeenCalledWith({
        where: { realmId: "r_eurth", userId: "officer" },
        select: { userId: true, powers: true },
      });
    });
  });
  describe("canEditPost", () => {
    const post = (id: string, authorUserId: string | null) => ({
      id,
      threadId: "t_ad",
      authorUserId,
    });
    const first = (authorUserId: string | null) => post("p_first", authorUserId);
    const second = (authorUserId: string | null) => post("p_second", authorUserId);
    const officerActor = officer;

    it("lets a manager edit the first post, whoever wrote it, and no reply but their own", async () => {
      const db = officerDb();
      await expect(canEditPost(db as never, officerActor, first("u_other"), realm)).resolves.toBe(
        true
      );
      await expect(canEditPost(db as never, officerActor, second("u_other"), realm)).resolves.toBe(
        false
      );
      await expect(canEditPost(db as never, officerActor, second("u_o"), realm)).resolves.toBe(
        true
      );
      expect(db.forumPost.findFirst).toHaveBeenCalledWith({
        where: { threadId: "t_ad" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });
    });

    it("does not let authorship alone edit the first post once the author lost the power", async () => {
      const db = officerDb();
      const exOfficer = { ...boardOnly, id: "u_board" };
      await expect(canEditPost(db as never, exOfficer, first("u_board"), realm)).resolves.toBe(
        false
      );
      await expect(canEditPost(db as never, exOfficer, second("u_board"), realm)).resolves.toBe(
        true
      );
    });
  });
  describe("assertAdvertsOnly", () => {
    const find = { key: "find-a-realm", scope: "site" };

    it("refuses a thread in Find a Realm that names no realm, and nothing else", () => {
      expect(() => assertAdvertsOnly(find, undefined)).toThrow(/adverts only/i);
      expect(() => assertAdvertsOnly(find, "r_eurth")).not.toThrow();
      expect(() => assertAdvertsOnly({ key: "general", scope: "site" }, undefined)).not.toThrow();
      expect(() =>
        assertAdvertsOnly({ key: "find-a-realm", scope: "realm" }, undefined)
      ).not.toThrow();
    });
  });
});
