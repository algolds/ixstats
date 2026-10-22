/**
 * Social identity loop: persona follows (SL-9) and the personal persona ("post as yourself", N13).
 *
 * - followPersona / unfollowPersona write a ThinkpagesFollow row and move followerCount /
 *   followingCount in the same transaction, and notify the followed persona's owner by Clerk id.
 * - The Following feed includes posts from followed personas, also for users without a country.
 * - Each user has at most one personal persona (accountType "personal", no country); ThinkTank
 *   "post as yourself" uses it instead of the oldest persona or `db.country.findFirst()`.
 *
 * `jest` is the ambient global because the hoisted jest.mock() factories call jest.fn() inline.
 */
const mockNotificationCreate = jest.fn().mockResolvedValue("n1");
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: (...args: any[]) => mockNotificationCreate(...args) },
  default: { create: (...args: any[]) => mockNotificationCreate(...args) },
}));
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onThinktankActivity: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"), // the tRPC context needs the real Cache class
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByPattern: jest.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Prisma } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { activitiesFollowsRouter } from "~/server/api/routers/activities/follows";
import { thinkpagesAccountsRouter } from "~/server/api/routers/thinkpages/accounts";
import { thinkpagesThinktanksRouter } from "~/server/api/routers/thinkpages/thinktanks";
import { ensurePersonalAccount } from "~/server/api/routers/thinkpages/personal-account";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { ensurePersonalAccount as ensureSharedPersonalAccount } from "~/server/shared/thinkpages-personal-account";
import { wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";

const ME = "user_me";
const THEM = "user_them";

const createFollowsCaller = createCallerFactory(activitiesFollowsRouter);
const createAccountsCaller = createCallerFactory(thinkpagesAccountsRouter);
const createThinktanksCaller = createCallerFactory(thinkpagesThinktanksRouter);

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc",
    clerkUserId: ME,
    countryId: "c1",
    accountType: "citizen",
    username: "someone",
    displayName: "Someone",
    isActive: true,
    verified: false,
    ...overrides,
  };
}

const MY_PERSONAL = account({
  id: "acc_personal",
  accountType: "personal",
  countryId: null,
  username: "Rowan",
  displayName: "Rowan",
});
const THEIR_PERSONA = account({ id: "acc_them", clerkUserId: THEM, username: "herald" });

/** A mock db whose ThinkpagesAccount rows are `rows`, with the caller's personal link in place. */
function makeDb(rows: any[] = [MY_PERSONAL, THEIR_PERSONA], personalLink = true) {
  const db: any = createMockPrisma();
  db.$transaction = jest.fn((cb: any) => cb(db));
  db.thinkpagesAccount.findUnique.mockImplementation(async ({ where }: any) => {
    return rows.find((r) => (where.id ? r.id === where.id : r.username === where.username)) ?? null;
  });
  db.thinkpagesPersonalAccount.findUnique.mockResolvedValue(
    personalLink ? { clerkUserId: ME, accountId: MY_PERSONAL.id } : null
  );
  db.thinkpagesFollow.create.mockResolvedValue({ id: "f1" });
  db.thinkpagesAccount.update.mockResolvedValue({});
  return db;
}

function ctxAs(userId: string | null, db: any, countryId: string | null = null) {
  return createMockRouterContext({
    auth: userId ? { userId } : null,
    user: userId ? { id: `db_${userId}`, clerkUserId: userId, countryId } : null,
    db,
  }) as never;
}

beforeEach(() => {
  mockNotificationCreate.mockClear();
});

describe("followPersona", () => {
  it("is idempotent: an existing follow leaves the counts alone and sends nothing", async () => {
    const db = makeDb();
    db.thinkpagesFollow.create.mockRejectedValue(uniqueViolation());
    const result = await createFollowsCaller(ctxAs(ME, db)).followPersona({
      accountId: "acc_them",
    });
    expect(result).toMatchObject({ alreadyFollowing: true });
    expect(db.thinkpagesAccount.update).not.toHaveBeenCalled();
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
  it("refuses to follow from someone else's persona", async () => {
    const db = makeDb([MY_PERSONAL, THEIR_PERSONA, account({ id: "acc_x", clerkUserId: "other" })]);
    await expect(
      createFollowsCaller(ctxAs(ME, db)).followPersona({
        accountId: "acc_them",
        followerAccountId: "acc_x",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.thinkpagesFollow.create).not.toHaveBeenCalled();
  });
});

describe("unfollowPersona", () => {
  it("leaves the counts alone when there was no follow", async () => {
    const db = makeDb();
    db.thinkpagesFollow.deleteMany.mockResolvedValue({ count: 0 });
    const result = await createFollowsCaller(ctxAs(ME, db)).unfollowPersona({
      accountId: "acc_them",
    });
    expect(result.wasFollowing).toBe(false);
    expect(db.thinkpagesAccount.update).not.toHaveBeenCalled();
  });
});
describe("personal persona", () => {
  it("uses the persona a concurrent request created", async () => {
    const db = makeDb([MY_PERSONAL], false);
    db.user.findUnique.mockResolvedValue({ forumUsername: "Rowan2" });
    db.$transaction = jest.fn(async () => {
      // The other request's link lands between our check and our insert.
      db.thinkpagesPersonalAccount.findUnique.mockResolvedValue({
        clerkUserId: ME,
        accountId: MY_PERSONAL.id,
      });
      throw uniqueViolation();
    });
    await expect(ensurePersonalAccount(db, ME)).resolves.toMatchObject({ id: "acc_personal" });
  });

  it("ensurePersonalAccount procedure acts as the caller", async () => {
    const db = makeDb();
    await expect(
      createAccountsCaller(ctxAs(ME, db)).ensurePersonalAccount()
    ).resolves.toMatchObject({ id: "acc_personal", accountType: "personal" });
  });

  it("a personal persona's type cannot be changed", async () => {
    const db = makeDb();
    await expect(
      createAccountsCaller(ctxAs(ME, db)).updateAccount({
        accountId: "acc_personal",
        accountType: "government",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.thinkpagesAccount.update).not.toHaveBeenCalled();
  });
});

describe("getAccountProfile", () => {
  it("returns counts from follow rows, the viewer's follow state, and no Clerk id", async () => {
    const db = makeDb();
    db.thinkpagesAccount.findUnique.mockImplementation(async ({ where }: any) =>
      where.username === "herald"
        ? { ...THEIR_PERSONA, country: { id: "c1", name: "Aland", flag: null, slug: "aland" } }
        : where.id === "acc_personal"
          ? MY_PERSONAL
          : null
    );
    db.thinkpagesFollow.count.mockImplementation(async ({ where }: any) =>
      where.followedAccountId ? 3 : 1
    );
    db.thinkpagesPost.count.mockResolvedValue(7);
    db.thinkpagesFollow.findUnique.mockResolvedValue({ id: "f1" });

    const profile = await createAccountsCaller(ctxAs(ME, db)).getAccountProfile({
      username: "herald",
    });

    expect(profile).toMatchObject({
      id: "acc_them",
      followerCount: 3,
      followingCount: 1,
      postCount: 7,
      isFollowing: true,
      isOwnAccount: false,
    });
    expect(profile).not.toHaveProperty("clerkUserId");
    expect(db.thinkpagesFollow.findUnique).toHaveBeenCalledWith({
      where: {
        followerAccountId_followedAccountId: {
          followerAccountId: "acc_personal",
          followedAccountId: "acc_them",
        },
      },
      select: { id: true },
    });
  });
});

describe("N13: ThinkTank 'post as yourself'", () => {
  function thinktankDb() {
    const db = makeDb();
    db.thinktankGroup.findUnique.mockResolvedValue({
      id: "g1",
      type: "public",
      createdBy: "owner",
      isActive: true,
      settings: null,
    });
    db.thinktankMember.findUnique.mockResolvedValue({
      id: "m",
      userId: ME,
      role: "member",
      isActive: true,
    });
    db.thinkpagesPost.create.mockImplementation(async ({ data }: any) => ({ id: "p1", ...data }));
    return db;
  }

  it("posts through the caller's personal persona, never the oldest persona or a random country", async () => {
    const db = thinktankDb();
    await createThinktanksCaller(ctxAs(ME, db)).createGroupPost({ groupId: "g1", content: "hi" });

    expect(db.thinkpagesPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accountId: "acc_personal" }) })
    );
    expect(db.thinkpagesAccount.findFirst).not.toHaveBeenCalled();
    expect(db.country.findFirst).not.toHaveBeenCalled();
  });
});

/**
 * A new personal persona ("post as yourself") is seeded from the player's names, and with wiki attribution
 * (`showWikiAttribution`) off never from their wiki name: the forum name, else the existing non-wiki fallback. The
 * switch is read once and a read error counts as off. An existing persona keeps the name it has.
 */
describe("a personal persona and wiki attribution", () => {
  const ME = "user_me";
  /** A db with no personal persona yet, whose user row carries `names`. */
  function newPersonaDb(names: { forumUsername: string | null; wikiUsername: string | null }) {
    const db = createMockPrisma();
    db.$transaction = jest.fn((cb: (tx: typeof db) => Promise<object>) => cb(db));
    db.thinkpagesPersonalAccount.findUnique.mockResolvedValue(null);
    db.thinkpagesAccount.findUnique.mockResolvedValue(null);
    db.thinkpagesAccount.create.mockImplementation(async ({ data }: { data: object }) => ({
      id: "new_personal",
      ...data,
    }));
    db.user.findUnique.mockResolvedValue(names);
    return db;
  }
  const created = (db: ReturnType<typeof newPersonaDb>) =>
    ensureSharedPersonalAccount(db as never, ME) as Promise<{
      username: string;
      displayName: string;
    }>;
  describe("ensurePersonalAccount and wiki attribution", () => {
    it("seeds a player with the switch off from the forum name", async () => {
      const db = newPersonaDb({ forumUsername: "Rowan", wikiUsername: "Wiki Rowan" });
      db.userConnection.findMany.mockResolvedValue(wikiAttributionOff(ME));
      await expect(created(db)).resolves.toMatchObject({ username: "Rowan", displayName: "Rowan" });
      expect(db.userConnection.findMany).toHaveBeenCalledTimes(1);
    });
    it("fails closed: a switch it cannot read keeps the wiki name out", async () => {
      const db = newPersonaDb({ forumUsername: null, wikiUsername: "WikiRowan" });
      db.userConnection.findMany.mockRejectedValue(new Error("db down"));
      const persona = await created(db);
      expect(persona.username).toMatch(/^member_\d{4}$/);
      expect(JSON.stringify(db.thinkpagesAccount.create.mock.calls)).not.toContain("WikiRowan");
    });
  });
});
