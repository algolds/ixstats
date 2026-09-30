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
import { activitiesFeedPersonalRouter } from "~/server/api/routers/activities/feed/personal";
import { thinkpagesAccountsRouter } from "~/server/api/routers/thinkpages/accounts";
import { thinkpagesThinktanksRouter } from "~/server/api/routers/thinkpages/thinktanks";
import {
  ensurePersonalAccount,
  toUsernameBase,
  usernameCandidate,
} from "~/server/api/routers/thinkpages/personal-account";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const ME = "user_me";
const THEM = "user_them";

const createFollowsCaller = createCallerFactory(activitiesFollowsRouter);
const createFeedCaller = createCallerFactory(activitiesFeedPersonalRouter);
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
  it("follows as the caller's personal persona and moves both counts in one transaction", async () => {
    const db = makeDb();
    const result = await createFollowsCaller(ctxAs(ME, db)).followPersona({
      accountId: "acc_them",
    });

    expect(result).toMatchObject({ alreadyFollowing: false, followerAccountId: "acc_personal" });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.thinkpagesFollow.create).toHaveBeenCalledWith({
      data: {
        followerAccountId: "acc_personal",
        followedAccountId: "acc_them",
        followerClerkUserId: ME,
      },
    });
    expect(db.thinkpagesAccount.update).toHaveBeenCalledWith({
      where: { id: "acc_them" },
      data: { followerCount: { increment: 1 } },
    });
    expect(db.thinkpagesAccount.update).toHaveBeenCalledWith({
      where: { id: "acc_personal" },
      data: { followingCount: { increment: 1 } },
    });
  });

  it("notifies the followed persona's owner by Clerk id, linking the follower's profile", async () => {
    const db = makeDb();
    await createFollowsCaller(ctxAs(ME, db)).followPersona({ accountId: "acc_them" });
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: THEM,
        category: "social",
        href: "/thinkpages/profile/Rowan",
        message: "Rowan (@Rowan) followed @herald",
      })
    );
  });

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

  it("can follow from another persona the caller owns", async () => {
    const mine = account({ id: "acc_gov", accountType: "government" });
    const db = makeDb([MY_PERSONAL, THEIR_PERSONA, mine]);
    await createFollowsCaller(ctxAs(ME, db)).followPersona({
      accountId: "acc_them",
      followerAccountId: "acc_gov",
    });
    expect(db.thinkpagesFollow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ followerAccountId: "acc_gov" }),
    });
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

  it("refuses to follow the caller's own personas", async () => {
    const db = makeDb([MY_PERSONAL, account({ id: "acc_mine" })]);
    await expect(
      createFollowsCaller(ctxAs(ME, db)).followPersona({ accountId: "acc_mine" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.thinkpagesFollow.create).not.toHaveBeenCalled();
  });

  it("404s on an unknown or deactivated persona", async () => {
    const db = makeDb([
      MY_PERSONAL,
      account({ id: "acc_off", clerkUserId: THEM, isActive: false }),
    ]);
    for (const accountId of ["missing", "acc_off"]) {
      await expect(
        createFollowsCaller(ctxAs(ME, db)).followPersona({ accountId })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("sends no notification for imported system personas", async () => {
    const db = makeDb([MY_PERSONAL, account({ id: "acc_sys", clerkUserId: "system_ixtwitter_x" })]);
    await createFollowsCaller(ctxAs(ME, db)).followPersona({ accountId: "acc_sys" });
    expect(db.thinkpagesFollow.create).toHaveBeenCalled();
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
});

describe("unfollowPersona", () => {
  it("removes the row and decrements both counts", async () => {
    const db = makeDb();
    db.thinkpagesFollow.deleteMany.mockResolvedValue({ count: 1 });
    const result = await createFollowsCaller(ctxAs(ME, db)).unfollowPersona({
      accountId: "acc_them",
    });
    expect(result).toEqual({ success: true, wasFollowing: true });
    expect(db.thinkpagesFollow.deleteMany).toHaveBeenCalledWith({
      where: { followerAccountId: "acc_personal", followedAccountId: "acc_them" },
    });
    expect(db.thinkpagesAccount.update).toHaveBeenCalledWith({
      where: { id: "acc_them" },
      data: { followerCount: { decrement: 1 } },
    });
    expect(db.thinkpagesAccount.update).toHaveBeenCalledWith({
      where: { id: "acc_personal" },
      data: { followingCount: { decrement: 1 } },
    });
  });

  it("leaves the counts alone when there was no follow", async () => {
    const db = makeDb();
    db.thinkpagesFollow.deleteMany.mockResolvedValue({ count: 0 });
    const result = await createFollowsCaller(ctxAs(ME, db)).unfollowPersona({
      accountId: "acc_them",
    });
    expect(result.wasFollowing).toBe(false);
    expect(db.thinkpagesAccount.update).not.toHaveBeenCalled();
  });

  it("does not create a personal persona just to unfollow", async () => {
    const db = makeDb([THEIR_PERSONA], false);
    const result = await createFollowsCaller(ctxAs(ME, db)).unfollowPersona({
      accountId: "acc_them",
    });
    expect(result.wasFollowing).toBe(false);
    expect(db.thinkpagesAccount.create).not.toHaveBeenCalled();
  });
});

describe("getFollowingFeed includes followed personas", () => {
  it("shows followed personas' posts to a user with no country", async () => {
    const db = makeDb();
    db.thinkpagesFollow.findMany.mockResolvedValue([{ followedAccountId: "acc_them" }]);
    db.thinkpagesPost.findMany.mockResolvedValue([
      {
        id: "p1",
        accountId: "acc_them",
        content: "hello",
        hashtags: null,
        reactionCounts: null,
        visibility: "public",
        trending: false,
        isAutoGenerated: false,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        ixTimeTimestamp: new Date("2026-09-01T00:00:00Z"),
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        impressions: 0,
        account: { ...THEIR_PERSONA, country: null },
        reactions: [],
        mediaAttachments: [],
      },
    ]);

    const result = await createFeedCaller(ctxAs(ME, db, null)).getFollowingFeed({ limit: 10 });

    expect(db.thinkpagesFollow.findMany).toHaveBeenCalledWith({
      where: { followerClerkUserId: ME },
      select: { followedAccountId: true },
    });
    expect(db.countryFollow.findMany).not.toHaveBeenCalled();
    expect(db.activityFeed.findMany).not.toHaveBeenCalled();
    expect(db.thinkpagesPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { visibility: "public", OR: [{ accountId: { in: ["acc_them"] } }] },
      })
    );
    expect(result.followingCount).toBe(1);
    expect(result.activities.map((a: any) => a.id)).toEqual(["thinkpages-p1"]);
  });

  it("combines followed countries and followed personas", async () => {
    const db = makeDb();
    db.countryFollow.findMany.mockResolvedValue([{ followedCountryId: "c9" }]);
    db.thinkpagesFollow.findMany.mockResolvedValue([{ followedAccountId: "acc_them" }]);

    const result = await createFeedCaller(ctxAs(ME, db, "c1")).getFollowingFeed({ limit: 10 });

    expect(db.thinkpagesPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          visibility: "public",
          OR: [{ account: { countryId: { in: ["c9"] } } }, { accountId: { in: ["acc_them"] } }],
        },
      })
    );
    expect(result.followingCount).toBe(2);
  });

  it("is empty when the user follows nothing", async () => {
    const db = makeDb();
    const result = await createFeedCaller(ctxAs(ME, db, null)).getFollowingFeed({ limit: 10 });
    expect(result).toEqual({ activities: [], followingCount: 0 });
    expect(db.thinkpagesPost.findMany).not.toHaveBeenCalled();
  });
});

describe("personal persona", () => {
  it("derives a valid username stem", () => {
    expect(toUsernameBase("Rowan Gale")).toBe("RowanGale");
    expect(toUsernameBase("42_answer")).toBe("answer");
    expect(toUsernameBase("ab")).toBeNull();
    expect(toUsernameBase("a".repeat(40))).toHaveLength(20);
    expect(usernameCandidate("Rowan", 1)).toBe("Rowan_me");
    expect(usernameCandidate("a".repeat(20), 1)).toBe(`${"a".repeat(17)}_me`);
    expect(usernameCandidate("Rowan", 2)).toMatch(/^Rowan_\d{4}$/);
  });

  it("creates one personal persona with no country, linked to the user", async () => {
    const db = makeDb([], false);
    db.user.findUnique.mockResolvedValue({ forumUsername: "Rowan", wikiUsername: null });
    db.thinkpagesAccount.create.mockImplementation(async ({ data }: any) => ({
      id: "new_personal",
      ...data,
    }));

    const created = await ensurePersonalAccount(db, ME);

    expect(created).toMatchObject({
      id: "new_personal",
      accountType: "personal",
      countryId: null,
      username: "Rowan",
      displayName: "Rowan",
      verified: false,
    });
    expect(db.thinkpagesPersonalAccount.create).toHaveBeenCalledWith({
      data: { clerkUserId: ME, accountId: "new_personal" },
    });
    expect(db.country.findFirst).not.toHaveBeenCalled();
  });

  it("returns the existing personal persona instead of creating another", async () => {
    const db = makeDb();
    await expect(ensurePersonalAccount(db, ME)).resolves.toMatchObject({ id: "acc_personal" });
    expect(db.thinkpagesAccount.create).not.toHaveBeenCalled();
  });

  it("picks another username when the preferred one is taken", async () => {
    const db = makeDb(
      [account({ id: "someone_else", clerkUserId: THEM, username: "Rowan" })],
      false
    );
    db.user.findUnique.mockResolvedValue({ forumUsername: "Rowan" });
    db.thinkpagesAccount.create.mockImplementation(async ({ data }: any) => ({ id: "p", ...data }));
    await expect(ensurePersonalAccount(db, ME)).resolves.toMatchObject({ username: "Rowan_me" });
  });

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

  it("does not count toward the 25-persona cap", async () => {
    const db = makeDb();
    db.country.findUnique.mockResolvedValue({ id: "c1" });
    db.thinkpagesAccount.create.mockResolvedValue({ id: "new" });
    await createAccountsCaller(ctxAs(ME, db, "c1")).createAccount({
      countryId: "c1",
      accountType: "citizen",
      username: "newbie",
      firstName: "New",
    });
    expect(db.thinkpagesAccount.findMany).toHaveBeenCalledWith({
      where: { clerkUserId: ME, accountType: { not: "personal" } },
    });
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

  it("404s on an unknown username", async () => {
    const db = makeDb();
    await expect(
      createAccountsCaller(ctxAs(null, db)).getAccountProfile({ username: "nobody" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
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

  it("creates the personal persona on first use without attaching a country", async () => {
    const db = thinktankDb();
    db.thinkpagesPersonalAccount.findUnique.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue({ forumUsername: "Rowan", wikiUsername: null });
    db.thinkpagesAccount.create.mockImplementation(async ({ data }: any) => ({
      id: "fresh",
      ...data,
    }));

    await createThinktanksCaller(ctxAs(ME, db, "c1")).createGroupPost({
      groupId: "g1",
      content: "hi",
    });

    expect(db.thinkpagesAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountType: "personal", countryId: null }),
    });
    expect(db.thinkpagesPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accountId: "fresh" }) })
    );
    expect(db.country.findFirst).not.toHaveBeenCalled();
  });
});
