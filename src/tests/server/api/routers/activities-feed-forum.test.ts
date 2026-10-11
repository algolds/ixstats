/** @jest-environment node */
/**
 * Phase 4b (Q10) and sub-project 7: the global feed's forum slice comes from native ThinkPages forum threads (public
 * categories, site section or published realms; `latestPublicThreadPreviews`), not from XenForo, and each item
 * carries the preview of the post it refers to.
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
  latestPublicThreadPreviews: jest.fn(),
}));

import { describe, expect, it } from "@jest/globals";
import { activitiesFeedGlobalRouter } from "~/server/api/routers/activities/feed/global";
import { createCallerFactory } from "~/server/api/trpc";
import { latestPublicThreadPreviews } from "~/server/modules/thinkpages-forum";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const AT = new Date("2026-10-09T10:00:00Z");

function previewed(id: string, replyCount: number, over: object = {}, postedAt: Date = AT) {
  const href = `/thinkpages/t/${id}`;
  return {
    id,
    title: `Thread ${id}`,
    author: "jane",
    categoryName: "General",
    replyCount,
    createdAt: AT,
    lastPostAt: AT,
    postedAt,
    href,
    preview: {
      threadId: id,
      title: `Thread ${id}`,
      threadHref: href,
      postHref: `/thinkpages/post/p_${id}`,
      kind: replyCount === 0 ? "thread" : "reply",
      excerpt: `Excerpt of ${id}`,
      author: {
        name: replyCount === 0 ? "jane" : "herald",
        avatarUrl: null,
        flagUrl: "https://flags.example/e.png",
        persona: false,
      },
      board: { name: "General", href: "/thinkpages/c/general" },
      realm: null,
      style: "ooc",
      replyCount,
      reactionTotal: 4,
      ...over,
    },
  };
}

const callerFor = (db: ReturnType<typeof createMockPrisma>) =>
  createCallerFactory(activitiesFeedGlobalRouter)(createMockRouterContext({ db }) as never);

describe("activities.getGlobalFeed forum slice", () => {
  it("lists native public threads with the preview of the post each refers to", async () => {
    jest
      .mocked(latestPublicThreadPreviews)
      .mockResolvedValue([previewed("t1", 0), previewed("t2", 3)] as never);
    const db = createMockPrisma();
    const { activities } = await callerFor(db).getGlobalFeed({ filter: "community", limit: 20 });

    expect(latestPublicThreadPreviews).toHaveBeenCalledWith(db as never, 20);
    const forum = activities.filter((a: { source: string }) => a.source === "forum");
    expect(forum).toHaveLength(2);
    expect(forum[0]).toMatchObject({
      id: "forum-thread-t1",
      type: "social",
      user: { name: "jane", flagUrl: "https://flags.example/e.png" },
      content: {
        title: "New forum thread: Thread t1",
        description: "Excerpt of t1",
        metadata: {
          source: "forum",
          forumName: "General",
          replyCount: 0,
          forumUrl: "/thinkpages/t/t1",
        },
      },
      forum: { excerpt: "Excerpt of t1", postHref: "/thinkpages/post/p_t1", reactionTotal: 4 },
      timestamp: AT,
    });
    expect(forum[1]).toMatchObject({
      user: { name: "herald" },
      content: { title: "Forum reply in: Thread t2" },
      engagement: { comments: 3 },
    });
  });

  it("describes an item with no excerpt by its author and board", async () => {
    jest
      .mocked(latestPublicThreadPreviews)
      .mockResolvedValue([previewed("t3", 0, { excerpt: "" })] as never);
    const { activities } = await callerFor(createMockPrisma()).getGlobalFeed({
      filter: "community",
      limit: 20,
    });
    const forum = activities.find((a: { source: string }) => a.source === "forum");
    expect(forum).toMatchObject({ content: { description: "jane posted in General" } });
  });

  it("dates an item by the post it previews, not the thread's newer last activity", async () => {
    const earlier = new Date("2026-10-09T09:00:00Z");
    jest
      .mocked(latestPublicThreadPreviews)
      .mockResolvedValue([previewed("t4", 3, {}, earlier)] as never);
    const { activities } = await callerFor(createMockPrisma()).getGlobalFeed({
      filter: "community",
      limit: 20,
    });
    expect(activities.find((a: { source: string }) => a.source === "forum")).toMatchObject({
      timestamp: earlier,
    });
  });

  it("shows a persona item by the persona's name and picture, with no flag", async () => {
    const persona = {
      name: "Herald",
      avatarUrl: "https://img.example/h.png",
      flagUrl: null,
      persona: true,
    };
    jest
      .mocked(latestPublicThreadPreviews)
      .mockResolvedValue([previewed("t5", 2, { author: persona })] as never);
    const { activities } = await callerFor(createMockPrisma()).getGlobalFeed({
      filter: "community",
      limit: 20,
    });
    const item = activities.find((a: { source: string }) => a.source === "forum");
    expect(item).toMatchObject({
      user: { name: "Herald", avatarUrl: "https://img.example/h.png", flagUrl: null },
      forum: { author: persona },
    });
  });

  it("keeps the feed when the forum read fails", async () => {
    jest.mocked(latestPublicThreadPreviews).mockRejectedValue(new Error("db down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      callerFor(createMockPrisma()).getGlobalFeed({ filter: "community", limit: 20 })
    ).resolves.toMatchObject({ activities: [] });
    error.mockRestore();
  });
});
