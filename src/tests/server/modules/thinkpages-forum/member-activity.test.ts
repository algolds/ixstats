/** @jest-environment node */
/** Phase 4b (Q11): the passport's forum footprint comes from the native forum. */
import { describe, expect, it, jest } from "@jest/globals";
import {
  forumActivityOf,
  importedAuthorByName,
} from "~/server/modules/thinkpages-forum/member-activity";

function fakeDb(found: object | null = null) {
  return {
    forumPost: {
      count: jest.fn<() => Promise<number>>().mockResolvedValue(12),
      findFirst: jest.fn<() => Promise<object | null>>().mockResolvedValue(found),
    },
    forumThread: { count: jest.fn<() => Promise<number>>().mockResolvedValue(3) },
  };
}

describe("forumActivityOf", () => {
  it("counts the member's own visible posts and threads, never persona content", async () => {
    const db = fakeDb();
    await expect(forumActivityOf(db as never, "u1")).resolves.toEqual({ posts: 12, threads: 3 });
    expect(db.forumPost.count).toHaveBeenCalledWith({
      where: { authorUserId: "u1", authorPersonaId: null, hidden: false, thread: { hidden: false } },
    });
    expect(db.forumThread.count).toHaveBeenCalledWith({
      where: { authorUserId: "u1", authorPersonaId: null, hidden: false },
    });
  });
});

describe("importedAuthorByName", () => {
  it("finds an old forum member by an imported name, case-insensitively, on visible posts only", async () => {
    const db = fakeDb({ xenforoUserId: 77, importedAuthorName: "OldTimer" });
    await expect(importedAuthorByName(db as never, "oldtimer")).resolves.toEqual({
      userId: 77,
      username: "OldTimer",
    });
    expect(db.forumPost.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          importedAuthorName: { equals: "oldtimer", mode: "insensitive" },
          xenforoUserId: { not: null },
          hidden: false,
        },
      })
    );
  });

  it("is null for a name no imported post carries", async () => {
    await expect(importedAuthorByName(fakeDb() as never, "nobody")).resolves.toBeNull();
  });
});
