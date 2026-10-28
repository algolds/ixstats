/** @jest-environment node */
/**
 * Erasing an account (Privacy 5.2) on the in-memory client: the Clerk user goes first, nations are released with their
 * material purged at once, founded realms go to staff, personal rows are erased by both the Clerk id and the database
 * id, public content is credited to "a former member", and the User row is tombstoned, never deleted. Other users'
 * rows stay. The cron erases every due account and one failure never stops the rest.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/logging/user-logger", () => ({
  UserLogger: { deleteUserLogFiles: jest.fn().mockResolvedValue(0) },
}));
jest.mock("~/server/modules/realms/realms.notices", () => ({
  notifyRealmFounderChanged: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/map-invalidation", () => ({
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/modules/cards/cards.tools", () => ({
  adminCancelListing: jest.fn(),
  adminCancelAuction: jest.fn(),
}));
jest.mock("~/server/modules/cards/trading/trade-service", () => ({
  cancelTradeOffer: jest.fn(),
  rejectTradeOffer: jest.fn(),
}));

const clerk = {
  sessions: { getSessionList: jest.fn(), revokeSession: jest.fn() },
  users: { deleteUser: jest.fn() },
};
jest.mock("@clerk/backend", () => ({ createClerkClient: () => clerk }));

import { describe, it, expect, beforeEach } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";
import { FORMER_MEMBER } from "~/lib/account/deletion";
import { generateIntentSummationDraft } from "~/lib/intent/intent-summation";
import { notifyRealmFounderChanged } from "~/server/modules/realms/realms.notices";
import {
  defaultErasureDeps,
  eraseAccount,
  eraseDueAccounts,
  type ErasureDeps,
} from "~/server/orchestration/account-erasure";
import {
  addMember,
  addNation,
  addPersona,
  addRealm,
  addSiteBoards,
  forumDb,
} from "~/tests/helpers/forum-world";
import type { MemoryPrisma } from "~/tests/helpers/memory-prisma";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-01T00:00:00Z");
/** Alice asked 15 days before NOW: past the 14-day grace. */
const REQUESTED = new Date(NOW.getTime() - 15 * DAY);

let db: MemoryPrisma;
let order: string[];
let deps: ErasureDeps;

async function seed(): Promise<void> {
  await addSiteBoards(db);
  const alice = await addMember(db, "alice", { handle: "alice_h" });
  const bob = await addMember(db, "bob");
  await db.user.update({
    where: { id: "alice" },
    data: { discordUserId: "d1", discordUsername: "alice#1", deletionRequestedAt: REQUESTED },
  });
  await addRealm(db, { id: "eurth", name: "Eurth", ownerClerkId: alice.clerkUserId });
  await addRealm(db, { id: "other", name: "Other", ownerClerkId: bob.clerkUserId });
  await addNation(db, "n1", "eurth", "alice");
  await db.country.update({ where: { id: "n1" }, data: { flag: "/flags/n1.png" } });
  await db.user.update({ where: { id: "alice" }, data: { countryId: "n1" } });
  await addNation(db, "n2", "other", "bob");
  await db.realmOfficer.create({
    data: {
      realmId: "other",
      userId: alice.clerkUserId,
      title: "Envoy",
      appointedBy: bob.clerkUserId,
    },
  });
  await db.realmClaim.create({ data: { realmId: "other", userId: "alice", status: "pending" } });

  await addPersona(db, "p1", alice, "n1", "Alice Persona");
  await db.thinkpagesAccount.update({
    where: { id: "p1" },
    data: { accountType: "GOVERNMENT", bio: "Official channel of n1" },
  });
  await db.thinkpagesAccount.create({
    data: {
      id: "p0",
      clerkUserId: alice.clerkUserId,
      accountType: "personal",
      username: "alicepersonal",
      displayName: "Alice Smith",
      firstName: "Alice",
      lastName: "Smith",
      bio: "About me",
      profileImageUrl: "/me.png",
    },
  });
  await addPersona(db, "p2", bob, "n2", "Bob Persona");
  await db.thinkpagesFollow.create({
    data: {
      followerAccountId: "p1",
      followedAccountId: "p2",
      followerClerkUserId: alice.clerkUserId,
    },
  });
  await db.thinkpagesFollow.create({
    data: {
      followerAccountId: "p2",
      followedAccountId: "p1",
      followerClerkUserId: bob.clerkUserId,
    },
  });

  await db.thinkshareConversation.create({ data: { id: "c1", type: "direct" } });
  await db.conversationParticipant.create({
    data: { conversationId: "c1", userId: alice.clerkUserId },
  });
  await db.conversationParticipant.create({
    data: { conversationId: "c1", userId: bob.clerkUserId },
  });
  const msg = (id: string, userId: string, replyToId?: string) =>
    db.thinkshareMessage.create({
      data: { id, conversationId: "c1", userId, content: id, ixTimeTimestamp: NOW, replyToId },
    });
  await msg("m-clerk", alice.clerkUserId);
  await msg("m-db", "alice"); // the feedback path writes the database id (user-logging.ts)
  await msg("m-bob", bob.clerkUserId, "m-clerk");
  await db.messageReadReceipt.create({
    data: { userId: bob.clerkUserId, thinkshareMessageId: "m-clerk", messageType: "thinkshare" },
  });

  await db.forumThread.create({
    data: {
      id: "t1",
      categoryId: "cat-rules",
      title: "Hello",
      authorUserId: "alice",
      xenforoUserId: 77,
    },
  });
  await db.forumPost.create({
    data: {
      id: "fp-a",
      threadId: "t1",
      authorUserId: "alice",
      xenforoUserId: 77,
      contentHtml: "a",
      plainText: "a",
    },
  });
  await db.forumPost.create({
    data: { id: "fp-b", threadId: "t1", authorUserId: "bob", contentHtml: "b", plainText: "b" },
  });

  await db.wikiAccountLink.create({
    data: { userId: "alice", source: "iiwiki", username: "Alice" },
  });
  await db.userPreferences.create({ data: { userId: alice.clerkUserId } });
  await db.notification.create({ data: { userId: alice.clerkUserId, title: "Hi" } });
  await db.notification.create({ data: { userId: bob.clerkUserId, title: "Hi Bob" } });
  await db.systemLog.create({
    data: { level: "INFO", category: "USER_ACTION", message: "x", userId: "alice" },
  });
  await db.userConnection.create({
    data: { userId: bob.clerkUserId, targetUserId: alice.clerkUserId, connectionType: "friend" },
  });
  await db.thinktankGroup.create({
    data: { id: "g1", name: "Group", createdBy: alice.clerkUserId },
  });
  await db.collaborativeDoc.create({
    data: {
      id: "doc",
      groupId: "g1",
      title: "Doc",
      content: "",
      createdBy: alice.clerkUserId,
      lastEditBy: alice.clerkUserId,
    },
  });
  await seedPrivateRows(alice.clerkUserId);
  await db.activityFeed.create({
    data: {
      type: "post",
      category: "social",
      title: "x",
      description: "x",
      userId: alice.clerkUserId,
    },
  });
}

/** Private and ephemeral rows of Alice's (both id spaces), and Bob's favourite on her generation event. */
async function seedPrivateRows(aliceClerk: string): Promise<void> {
  await db.achievement.create({
    data: {
      key: "first",
      title: "First",
      description: "d",
      category: "c",
      rarity: "common",
      triggerType: "MANUAL",
    },
  });
  await db.userAchievement.create({
    data: {
      userId: aliceClerk,
      achievementId: "first",
      title: "First",
      description: "d",
      category: "c",
      rarity: "common",
    },
  });
  await db.stash.create({
    data: {
      id: "s1",
      userId: aliceClerk,
      items: {
        create: {
          id: "si1",
          pageTitle: "Page",
          pageSlug: "page",
          annotations: {
            create: {
              anchorSelector: "p",
              anchorOffset: 0,
              focusSelector: "p",
              focusOffset: 1,
              selectedText: "x",
            },
          },
        },
      },
    },
  });
  await db.customFieldValue.create({ data: { fieldName: "motto", value: "x", userId: "alice" } });
  await db.forumThreadRead.create({ data: { userId: "alice", threadId: "t1", readAt: NOW } });
  await db.forumThreadWatch.create({ data: { userId: "alice", threadId: "t1" } });
  await db.forumThreadWatch.create({ data: { userId: "bob", threadId: "t1" } });
  const event = (id: string, userId: string) =>
    db.generationEvent.create({
      data: {
        id,
        userId,
        sessionId: "s",
        category: "given",
        trainingMode: "x",
        parameters: {},
        count: 1,
      },
    });
  await event("ge-own", "alice");
  await event("ge-shared", "alice");
  await db.generationFavorite.create({ data: { eventId: "ge-own", userId: "alice", name: "A" } });
  await db.generationFavorite.create({ data: { eventId: "ge-shared", userId: "bob", name: "B" } });
}

beforeEach(async () => {
  db = forumDb();
  order = [];
  deps = {
    deleteClerkUser: jest.fn(async () => {
      // The Clerk user goes before anything else changes
      const user = await db.user.findUnique({ where: { id: "alice" } });
      const nation = await db.country.findUnique({ where: { id: "n1" } });
      order.push(`clerk:${user?.clerkUserId}:${nation?.ownerUserId}`);
    }),
    deleteLogFiles: jest.fn(async (id: string) => {
      // Before the transaction: the row still carries the Clerk id
      const user = await db.user.findUnique({ where: { id: "alice" } });
      order.push(`logs:${id}:${user?.clerkUserId}`);
      return 1;
    }),
    forgetContextUser: jest.fn(async (id: string) => {
      order.push(`forget:${id}`);
    }),
  };
  (notifyRealmFounderChanged as jest.Mock).mockClear();
  await seed();
});

const count = (rows: object[]) => rows.length;

describe("eraseAccount", () => {
  it("deletes the Clerk user first, the log files before the tombstone, and the cached context last", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    expect(order).toEqual([
      "clerk:alice-clerk:alice",
      "logs:alice-clerk:alice-clerk",
      "forget:alice-clerk",
    ]);
  });

  it("does nothing when the request was cancelled or is not yet due", async () => {
    await db.user.update({ where: { id: "alice" }, data: { deletionRequestedAt: null } });
    expect((await eraseAccount(db, "alice", deps, NOW)).outcome).toBe("not-due");
    await db.user.update({
      where: { id: "alice" },
      data: { deletionRequestedAt: new Date(NOW.getTime() - 13 * DAY) },
    });
    expect((await eraseAccount(db, "alice", deps, NOW)).outcome).toBe("not-due");
    expect(deps.deleteClerkUser).not.toHaveBeenCalled();
    expect((await db.user.findUnique({ where: { id: "alice" } }))?.clerkUserId).toBe("alice-clerk");
  });

  it("rolls the rows back when the request is cancelled while the erasure runs", async () => {
    deps.deleteLogFiles = jest.fn(async () => {
      await db.user.update({ where: { id: "alice" }, data: { deletionRequestedAt: null } });
      return 0;
    });
    await expect(eraseAccount(db, "alice", deps, NOW)).rejects.toThrow(/cancelled/);
    expect((await db.user.findUnique({ where: { id: "alice" } }))?.clerkUserId).toBe("alice-clerk");
    expect(await db.thinkshareMessage.count()).toBe(3);
  });

  it("tombstones the User row, never deleting it", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    const deletes = db.store.log.filter(
      (entry) => "model" in entry && entry.model === "User" && String(entry.op).startsWith("delete")
    );
    expect(deletes).toEqual([]);
    expect(await db.user.findUnique({ where: { id: "alice" } })).toMatchObject({
      clerkUserId: "erased:alice",
      handle: null,
      discordUserId: null,
      discordUsername: null,
      countryId: null,
      lastSeenAt: null,
      isActive: false,
      deletionRequestedAt: REQUESTED,
    });
    expect(await db.user.findUnique({ where: { id: "bob" } })).toMatchObject({
      clerkUserId: "bob-clerk",
      isActive: true,
    });
  });

  it("releases nations with their material purged at once, and hands founded realms to staff", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    expect(await db.country.findUnique({ where: { id: "n1" } })).toMatchObject({
      ownerUserId: null,
      flag: null,
    });
    expect(await db.nationMaterialHold.findUnique({ where: { countryId: "n1" } })).toMatchObject({
      formerOwnerUserId: "alice",
      flag: "/flags/n1.png",
      purgeAfter: NOW,
    });
    expect((await db.realm.findUnique({ where: { id: "eurth" } }))?.ownerId).toBe("system");
    expect((await db.country.findUnique({ where: { id: "n2" } }))?.ownerUserId).toBe("bob");
    expect(await db.realmClaim.findMany({ where: { userId: "alice" } })).toMatchObject([
      { status: "withdrawn" },
    ]);
    // The user acted for themselves: no notice goes to the account being erased
    expect(notifyRealmFounderChanged).not.toHaveBeenCalled();
  });

  it("erases messages the user sent under either id, keeping other people's", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    const messages = await db.thinkshareMessage.findMany({});
    expect(messages.map((m) => m.id)).toEqual(["m-bob"]);
    expect(messages[0]?.replyToId).toBeNull();
    expect(count(await db.messageReadReceipt.findMany({}))).toBe(0);
    expect((await db.conversationParticipant.findMany({})).map((p) => p.userId)).toEqual([
      "bob-clerk",
    ]);
  });

  it("erases personal rows keyed on either id, and the social graph both ways", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    expect(count(await db.wikiAccountLink.findMany({}))).toBe(0);
    expect(count(await db.userPreferences.findMany({}))).toBe(0);
    expect((await db.notification.findMany({})).map((n) => n.userId)).toEqual(["bob-clerk"]);
    expect(count(await db.systemLog.findMany({}))).toBe(0);
    expect(count(await db.userConnection.findMany({}))).toBe(0);
    // The user's follows go; another player's follow of the (renamed) persona stays
    expect((await db.thinkpagesFollow.findMany({})).map((f) => f.followerAccountId)).toEqual([
      "p2",
    ]);
    expect(count(await db.realmOfficer.findMany({}))).toBe(0);
  });

  it("erases private and ephemeral rows, never another user's", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    expect(await db.userAchievement.count()).toBe(0);
    expect(await db.stash.count()).toBe(0);
    expect(await db.stashItem.count()).toBe(0);
    expect(await db.stashAnnotation.count()).toBe(0);
    expect(await db.customFieldValue.count()).toBe(0);
    expect(await db.forumThreadRead.count()).toBe(0);
    expect((await db.forumThreadWatch.findMany({})).map((w) => w.userId)).toEqual(["bob"]);
    // An event another user favourited stays (deleting it would cascade into their favourite)
    expect((await db.generationEvent.findMany({})).map((e) => e.id)).toEqual(["ge-shared"]);
    expect((await db.generationFavorite.findMany({})).map((f) => f.userId)).toEqual(["bob"]);
  });

  it("renames personal personas and retires nation personas without renaming them", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    expect(await db.thinkpagesAccount.findUnique({ where: { id: "p0" } })).toMatchObject({
      clerkUserId: "erased:alice",
      displayName: FORMER_MEMBER,
      username: "former-p0",
      firstName: FORMER_MEMBER,
      lastName: "",
      bio: null,
      profileImageUrl: null,
    });
    // The nation's official account is the Shared Record: same name, no longer active, no longer the user's
    expect(await db.thinkpagesAccount.findUnique({ where: { id: "p1" } })).toMatchObject({
      clerkUserId: "erased:alice",
      displayName: "Alice Persona",
      username: "p1",
      bio: "Official channel of n1",
      isActive: false,
    });
  });

  it("gives the nation's next owner a fresh official account, not the retired one", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    await db.country.update({ where: { id: "n1" }, data: { ownerUserId: "bob" } });
    await db.intent.create({
      data: {
        id: "i1",
        countryId: "n1",
        goal: "Build",
        tier: "measured",
        category: "fiscal",
        changesJson: "[]",
        createdIxTime: 0,
      },
    });
    const draft = await generateIntentSummationDraft({ db, intentId: "i1", countryId: "n1" });
    expect(draft?.accountId).not.toBe("p1");
    const account = await db.thinkpagesAccount.findUnique({ where: { id: draft!.accountId } });
    expect(account).toMatchObject({ clerkUserId: "bob-clerk", countryId: "n1", isActive: true });
  });

  it("credits forum posts and shared work to a former member", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    expect(await db.thinkpagesAccount.findUnique({ where: { id: "p2" } })).toMatchObject({
      clerkUserId: "bob-clerk",
      displayName: "Bob Persona",
    });
    // xenforoUserId goes too: relinking the old forum account must never re-attribute these
    expect(await db.forumThread.findUnique({ where: { id: "t1" } })).toMatchObject({
      authorUserId: null,
      importedAuthorName: FORMER_MEMBER,
      xenforoUserId: null,
    });
    expect(await db.forumPost.findUnique({ where: { id: "fp-a" } })).toMatchObject({
      authorUserId: null,
      importedAuthorName: FORMER_MEMBER,
      xenforoUserId: null,
    });
    expect((await db.forumPost.findUnique({ where: { id: "fp-b" } }))?.authorUserId).toBe("bob");
    expect(await db.collaborativeDoc.findUnique({ where: { id: "doc" } })).toMatchObject({
      createdBy: "erased:alice",
      lastEditBy: null,
    });
    expect((await db.activityFeed.findMany({}))[0]?.userId).toBeNull();
  });

  it("does nothing the second time", async () => {
    await eraseAccount(db, "alice", deps, NOW);
    const again = await eraseAccount(db, "alice", deps, NOW);
    expect(again.outcome).toBe("already-erased");
    expect(deps.deleteClerkUser).toHaveBeenCalledTimes(1);
  });

  it("stops before touching any row when the Clerk user cannot be deleted", async () => {
    deps.deleteClerkUser = jest.fn(async () => {
      throw new Error("Clerk down");
    });
    await expect(eraseAccount(db, "alice", deps, NOW)).rejects.toThrow("Clerk down");
    expect((await db.country.findUnique({ where: { id: "n1" } }))?.ownerUserId).toBe("alice");
    expect((await db.user.findUnique({ where: { id: "alice" } }))?.clerkUserId).toBe("alice-clerk");
  });
});

describe("eraseDueAccounts", () => {
  it("erases only accounts past the 14-day grace and not yet erased, and one failure never stops the rest", async () => {
    const at = (days: number) => new Date(NOW.getTime() - days * DAY);
    await db.user.update({ where: { id: "alice" }, data: { deletionRequestedAt: at(15) } });
    await db.user.update({ where: { id: "bob" }, data: { deletionRequestedAt: at(13) } });
    await db.user.create({
      data: { id: "carol", clerkUserId: "carol-clerk", deletionRequestedAt: at(20) },
    });
    await db.user.create({
      data: { id: "dan", clerkUserId: "erased:dan", deletionRequestedAt: at(30) },
    });
    const erased: string[] = [];
    const erase = jest.fn(async (_db: PrismaClient, userId: string) => {
      if (userId === "alice") throw new Error("boom");
      erased.push(userId);
      return {
        userId,
        outcome: "erased" as const,
        nationsReleased: 0,
        realmsReturned: 0,
        marketItemsEnded: 0,
      };
    });
    const result = await eraseDueAccounts(db, NOW, erase);
    expect(erase.mock.calls.map((call) => call[1]).sort()).toEqual(["alice", "carol"]);
    expect(erased).toEqual(["carol"]);
    expect(result).toEqual({ due: 2, erased: 1, failed: ["alice"] });
  });
});

describe("deleting the Clerk user", () => {
  const calls: string[] = [];
  beforeEach(() => {
    calls.length = 0;
    process.env.CLERK_SECRET_KEY = "sk_test";
    clerk.sessions.getSessionList.mockResolvedValue({ data: [{ id: "sess_1" }, { id: "sess_2" }] });
    clerk.sessions.revokeSession.mockImplementation(async (id: string) =>
      calls.push(`revoke:${id}`)
    );
    clerk.users.deleteUser.mockImplementation(async (id: string) => calls.push(`delete:${id}`));
  });

  it("revokes the user's active sessions, then deletes the user", async () => {
    await defaultErasureDeps.deleteClerkUser("alice-clerk");
    expect(clerk.sessions.getSessionList).toHaveBeenCalledWith({
      userId: "alice-clerk",
      status: "active",
    });
    expect(calls).toEqual(["revoke:sess_1", "revoke:sess_2", "delete:alice-clerk"]);
  });

  it("treats a user Clerk no longer has as deleted, and still deletes when revoking fails", async () => {
    clerk.sessions.getSessionList.mockRejectedValue(new Error("rate limited"));
    clerk.users.deleteUser.mockRejectedValue(
      Object.assign(new Error("Not Found"), { status: 404 })
    );
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(defaultErasureDeps.deleteClerkUser("alice-clerk")).resolves.toBeUndefined();
    expect(clerk.users.deleteUser).toHaveBeenCalledWith("alice-clerk");
  });

  it("fails on any other Clerk error, so nothing else is erased", async () => {
    clerk.users.deleteUser.mockRejectedValue(Object.assign(new Error("down"), { status: 503 }));
    await expect(defaultErasureDeps.deleteClerkUser("alice-clerk")).rejects.toThrow("down");
  });
});
