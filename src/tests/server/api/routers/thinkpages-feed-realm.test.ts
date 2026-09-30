/** @jest-environment node */
/**
 * The ThinkPages feed's realm filter: public posts by personas of the realm's nations, plus the posts
 * on the realm's board (ThinkTank posts). Without a realm the feed is unchanged (all realms).
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesFeedRouter } from "~/server/api/routers/thinkpages/feed";
import { globalCache } from "~/lib/cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(thinkpagesFeedRouter);

function feedWhere(db: ReturnType<typeof createMockPrisma>) {
  return db.thinkpagesPost.findMany.mock.calls[0]![0].where;
}

function caller(db: ReturnType<typeof createMockPrisma>) {
  return createCaller(createMockRouterContext({ db, auth: null, user: null }) as never);
}

describe("thinkpages.getFeed realm filter", () => {
  it("keeps the all-realms feed unchanged when no realm is given", async () => {
    const db = createMockPrisma();
    await caller(db).getFeed({});
    expect(feedWhere(db)).toEqual({ visibility: "public" });
    expect(db.realmBoard.findUnique).not.toHaveBeenCalled();
  });

  it("shows the realm's nations' public posts and its board's posts", async () => {
    const db = createMockPrisma();
    db.realmBoard.findUnique.mockResolvedValue({ groupId: "board1" });
    await caller(db).getFeed({ realmId: "eurth" });

    expect(db.realmBoard.findUnique.mock.calls[0]![0].where).toEqual({ realmId: "eurth" });
    expect(feedWhere(db)).toEqual({
      AND: [
        {
          OR: [
            { visibility: "public", account: { country: { realmId: "eurth" } } },
            { visibility: "thinktank", hashtags: { contains: '"group:board1"' } },
          ],
        },
      ],
    });
  });

  it("shows only the nations' posts while the realm has no board", async () => {
    const db = createMockPrisma();
    await caller(db).getFeed({ realmId: "eurth" });
    expect(feedWhere(db)).toEqual({
      AND: [{ visibility: "public", account: { country: { realmId: "eurth" } } }],
    });
  });

  it("composes with the hashtag filter and caches per realm", async () => {
    const db = createMockPrisma();
    await caller(db).getFeed({ realmId: "eurth", hashtag: "lore" });
    expect(feedWhere(db)).toMatchObject({
      hashtags: { contains: '"lore"' },
      AND: [{ visibility: "public", account: { country: { realmId: "eurth" } } }],
    });
    const key = (globalCache.set as jest.Mock).mock.calls.at(-1)![0] as string;
    expect(key).toContain(":eurth:");
  });
});
