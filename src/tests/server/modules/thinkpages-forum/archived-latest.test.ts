/** @jest-environment node */
/**
 * U12 (owner ruling): archived threads (the Realm Board archive) stay out of "Latest on the forum" and out of a
 * category row's latest activity; they still count as threads there, and the realm directory's activity counts
 * keep counting them.
 */
import { describe, expect, it } from "@jest/globals";
import { forumPreview } from "~/server/modules/realms/realms.forum-preview";
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
