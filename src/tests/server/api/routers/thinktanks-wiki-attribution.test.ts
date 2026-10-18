/**
 * Wiki attribution in ThinkTanks: a member who turned "show wiki attribution" (`showWikiAttribution`) off is never
 * named or found by their wiki name in a group's roster, its feed or its notices, for any viewer; a switch that cannot
 * be read counts as off.
 *
 * `jest` is the ambient global because the hoisted jest.mock() factory calls jest.fn() inline.
 */
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onThinktankActivity: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesThinktanksRouter } from "~/server/api/routers/thinkpages/thinktanks";
import { notificationHooks } from "~/lib/notifications/hooks";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import {
  privacyConfigRow,
  wikiAttributionOff,
  type PrivacyConfigRow,
} from "~/tests/helpers/privacy-config-fake";

const createCaller = createCallerFactory(thinkpagesThinktanksRouter);
type Db = ReturnType<typeof createMockPrisma>;

const OWNER = "user_owner";
const HIDDEN = "user_hidden";
const SHOWN = "user_shown";

const people = [HIDDEN, SHOWN].map((clerkUserId) => ({
  id: `db_${clerkUserId}`,
  clerkUserId,
  forumUsername: null,
  wikiUsername: clerkUserId === HIDDEN ? "Hidden Wiki" : "Shown Wiki",
  country: null,
}));

const members = [HIDDEN, SHOWN].map((userId) => ({ userId, role: "member", isActive: true }));

/** A public group whose two members are `people`; HIDDEN has wiki attribution off unless `privacy` says otherwise. */
function makeDb(privacy: PrivacyConfigRow[] = wikiAttributionOff(HIDDEN)): Db {
  const db = createMockPrisma();
  db.thinktankGroup.findUnique.mockResolvedValue({
    id: "g1",
    name: "Economists",
    avatar: null,
    type: "public",
    createdBy: OWNER,
    isActive: true,
    settings: null,
    tags: null,
    conversationId: "c1",
    conversation: { id: "c1", lastActivity: new Date() },
    members,
    collaborativeDocs: [],
  });
  db.user.findMany.mockResolvedValue(people);
  db.userConnection.findMany.mockResolvedValue([
    ...privacy,
    privacyConfigRow(SHOWN, { showWikiAttribution: true }),
  ]);
  db.thinkpagesPost.findMany.mockResolvedValue(
    [HIDDEN, SHOWN].map((clerkUserId) => ({
      id: `p_${clerkUserId}`,
      hashtags: null,
      account: { clerkUserId, country: null },
      _count: { replies: 0, reposts: 0, reactions: 0 },
    }))
  );
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

interface RosterUser {
  wikiUsername?: string | null;
  displayName?: string;
}

async function roster(db: Db, viewer: string | null) {
  const group = await callerAs(viewer, db).getThinktankById({ groupId: "g1" });
  const users = new Map<string, RosterUser>();
  for (const member of group?.members ?? []) users.set(member.userId, member.user as RosterUser);
  return users;
}

async function feedWikiNames(db: Db) {
  const { posts } = await callerAs(null, db).getGroupFeed({ groupId: "g1" });
  return posts.map((post) => post.realUser?.wikiUsername ?? null);
}

beforeEach(() => {
  (notificationHooks.onThinktankActivity as jest.Mock).mockClear();
});

describe("ThinkTank roster", () => {
  it("names a member with wiki attribution off without their wiki name, and keeps it for one with it on", async () => {
    const users = await roster(makeDb(), null);
    expect(users.get(HIDDEN)).toMatchObject({ wikiUsername: null, displayName: "Unknown user" });
    expect(users.get(SHOWN)).toMatchObject({
      wikiUsername: "Shown Wiki",
      displayName: "Shown Wiki",
    });
  });

  it("hides it from the member themself too, as every viewer sees the same roster", async () => {
    const users = await roster(makeDb(), HIDDEN);
    expect(users.get(HIDDEN)?.wikiUsername).toBeNull();
  });

  it("fails closed: a switch it cannot read hides every wiki name", async () => {
    const db = makeDb();
    db.userConnection.findMany.mockRejectedValue(new Error("db down"));
    const users = await roster(db, null);
    expect([users.get(HIDDEN)?.wikiUsername, users.get(SHOWN)?.wikiUsername]).toEqual([null, null]);
  });
});

describe("ThinkTank feed", () => {
  it("leaves the wiki name off a post's player while their wiki attribution is off", async () => {
    expect(await feedWikiNames(makeDb())).toEqual([null, "Shown Wiki"]);
    expect(await feedWikiNames(makeDb([]))).toEqual(["Hidden Wiki", "Shown Wiki"]);
  });

  it("fails closed: a switch it cannot read hides every wiki name", async () => {
    const db = makeDb();
    db.userConnection.findMany.mockRejectedValue(new Error("db down"));
    expect(await feedWikiNames(db)).toEqual([null, null]);
  });
});

describe("ThinkTank notices", () => {
  it("does not name a joiner with wiki attribution off by their wiki name", async () => {
    const db = makeDb();
    db.thinktankMember.findMany.mockResolvedValue([{ userId: OWNER }]);
    await callerAs(HIDDEN, db).joinThinktank({ groupId: "g1" });
    expect(notificationHooks.onThinktankActivity).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: HIDDEN, actorUserName: "Unknown user" })
    );
  });
});
