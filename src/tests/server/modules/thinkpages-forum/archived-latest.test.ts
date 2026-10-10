/** @jest-environment node */
/**
 * U12 (owner ruling): archived threads (the Realm Board archive) stay out of "Latest on the forum" and out of a
 * category row's latest activity; they still count as threads there, and the realm directory's activity counts
 * keep counting them.
 */
import { describe, expect, it } from "@jest/globals";
import type { ForumCategory } from "@prisma/client";
import { summarizeCategories } from "~/server/modules/thinkpages-forum/reads";
import { forumPreview } from "~/server/modules/realms/realms.forum-preview";

const hub = {
  id: "cat_hub",
  key: "hub",
  name: "Hub",
  description: "Realm talk",
  icAllowed: false,
  postRole: "any",
  visibility: "public",
  scope: "realm",
  realmId: "r1",
} as ForumCategory;

const older = new Date("2026-10-01");
const newer = new Date("2026-10-05");

describe("summarizeCategories", () => {
  it("counts archived threads but takes the latest activity from the others", async () => {
    const groupBy = jest.fn(async (_args: object) => [
      { categoryId: "cat_hub", archived: true, _count: { _all: 1 }, _max: { lastPostAt: newer } },
      { categoryId: "cat_hub", archived: false, _count: { _all: 3 }, _max: { lastPostAt: older } },
    ]);
    const [row] = await summarizeCategories({ forumThread: { groupBy } } as never, null, [hub]);
    expect(row).toMatchObject({ key: "hub", threadCount: 4, lastPostAt: older });
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["categoryId", "archived"] })
    );
  });

  it("has no latest activity when every thread is archived", async () => {
    const groupBy = jest.fn(async (_args: object) => [
      { categoryId: "cat_hub", archived: true, _count: { _all: 1 }, _max: { lastPostAt: newer } },
    ]);
    const [row] = await summarizeCategories({ forumThread: { groupBy } } as never, null, [hub]);
    expect(row).toMatchObject({ threadCount: 1, lastPostAt: null });
  });
});

describe("forumPreview", () => {
  it("lists only unarchived, unhidden Hub threads", async () => {
    const findMany = jest.fn(async (_args: object) => []);
    const db = {
      forumCategory: { findFirst: jest.fn(async () => ({ id: "cat_hub" })) },
      forumThread: { findMany },
    };
    await forumPreview(db as never, "r1", null);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { categoryId: "cat_hub", hidden: false, archived: false } })
    );
  });
});
