/** @jest-environment node */
import { authorOf, resolveAuthors } from "~/lib/thinkpages-forum/import/authors";

const at = (iso: string) => new Date(iso);

describe("resolveAuthors", () => {
  it("maps each forum id to its linked user", () => {
    const { byForumId, duplicates } = resolveAuthors([
      { id: "u1", forumUserId: 7, createdAt: at("2025-01-01") },
      { id: "u2", forumUserId: 8, createdAt: at("2025-01-02") },
    ]);
    expect([...byForumId]).toEqual([
      [7, "u1"],
      [8, "u2"],
    ]);
    expect(duplicates).toEqual([]);
  });

  it("resolves a forum id linked to several users to the earliest createdAt, then the id, and reports it", () => {
    const { byForumId, duplicates } = resolveAuthors([
      { id: "late", forumUserId: 7, createdAt: at("2025-03-01") },
      { id: "b", forumUserId: 7, createdAt: at("2025-01-01") },
      { id: "a", forumUserId: 7, createdAt: at("2025-01-01") },
    ]);
    expect(byForumId.get(7)).toBe("a");
    expect(duplicates).toEqual([{ forumUserId: 7, userIds: ["a", "b", "late"] }]);
  });
});

describe("authorOf", () => {
  const byForumId = new Map([[7, "u1"]]);

  it("attributes a linked forum user by id and keeps the XenForo name", () => {
    expect(authorOf(byForumId, 7, "Admin")).toEqual({
      authorUserId: "u1",
      importedAuthorName: "Admin",
      xenforoUserId: 7,
    });
  });

  it("leaves an unlinked forum user unattributed with its XenForo id", () => {
    expect(authorOf(byForumId, 9, "Someone")).toEqual({
      authorUserId: null,
      importedAuthorName: "Someone",
      xenforoUserId: 9,
    });
  });

  it("never matches users by name", () => {
    expect(authorOf(byForumId, 9, "u1").authorUserId).toBeNull();
  });

  it("leaves guests (user_id 0) unattributed with no XenForo id, named Guest when nameless", () => {
    expect(authorOf(byForumId, 0, "")).toEqual({
      authorUserId: null,
      importedAuthorName: "Guest",
      xenforoUserId: null,
    });
    expect(authorOf(byForumId, 0, "Visitor").importedAuthorName).toBe("Visitor");
  });

  it("names a nameless member Member", () => {
    expect(authorOf(byForumId, 9, " ").importedAuthorName).toBe("Member");
  });
});
