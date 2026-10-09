/** @jest-environment node */
/**
 * Phase 4b (Q10): the global feed's forum slice comes from native ThinkPages forum threads (public categories,
 * site section or published realms; `latestPublicThreads`), not from XenForo.
 */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getRecentChanges: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/server/modules/thinkpages-forum", () => ({
  latestPublicThreads: jest.fn(),
}));

import { describe, expect, it } from "@jest/globals";
import { activitiesFeedGlobalRouter } from "~/server/api/routers/activities/feed/global";
import { createCallerFactory } from "~/server/api/trpc";
import { latestPublicThreads } from "~/server/modules/thinkpages-forum";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const AT = new Date("2026-10-09T10:00:00Z");

function thread(id: string, replyCount: number) {
  return {
    id,
    title: `Thread ${id}`,
    author: "jane",
    categoryName: "General",
    replyCount,
    createdAt: AT,
    lastPostAt: AT,
    href: `/thinkpages/t/${id}`,
  };
}

describe("activities.getGlobalFeed forum slice", () => {
  it("lists native public threads, linking to the thread", async () => {
    jest.mocked(latestPublicThreads).mockResolvedValue([thread("t1", 0), thread("t2", 3)]);
    const db = createMockPrisma();
    const caller = createCallerFactory(activitiesFeedGlobalRouter)(
      createMockRouterContext({ db }) as never
    );
    const { activities } = await caller.getGlobalFeed({ filter: "community", limit: 20 });

    expect(latestPublicThreads).toHaveBeenCalledWith(db, 20);
    const forum = activities.filter((a: { source: string }) => a.source === "forum");
    expect(forum).toHaveLength(2);
    expect(forum[0]).toMatchObject({
      id: "forum-thread-t1",
      type: "social",
      user: { name: "jane" },
      content: {
        title: "New forum thread: Thread t1",
        description: "jane posted in General",
        metadata: { source: "forum", forumName: "General", replyCount: 0, forumUrl: "/thinkpages/t/t1" },
      },
      timestamp: AT,
    });
    expect(forum[1]).toMatchObject({
      content: { title: "Forum reply in: Thread t2" },
      engagement: { comments: 3 },
    });
  });

  it("keeps the feed when the forum read fails", async () => {
    jest.mocked(latestPublicThreads).mockRejectedValue(new Error("db down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const caller = createCallerFactory(activitiesFeedGlobalRouter)(
      createMockRouterContext({ db: createMockPrisma() }) as never
    );
    await expect(caller.getGlobalFeed({ filter: "community", limit: 20 })).resolves.toMatchObject({
      activities: [],
    });
    error.mockRestore();
  });
});
