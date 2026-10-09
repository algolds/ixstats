/** @jest-environment node */
import { categoryVisibility, importedThread } from "~/lib/thinkpages-forum/import/visibility";
import type { XfPost, XfThread } from "~/lib/thinkpages-forum/import/xenforo-types";

describe("categoryVisibility", () => {
  it("follows the target kind, then the database, then the seeds, and fails safe", () => {
    expect(categoryVisibility({ skip: true }, [])).toBeNull();
    expect(categoryVisibility({ archive: true }, [])).toBe("public");
    expect(categoryVisibility({ archive: true, visibility: "staff" }, [])).toBe("staff");
    expect(categoryVisibility({ scope: "site", key: "staff" }, [])).toBe("staff");
    expect(categoryVisibility({ scope: "site", key: "general" }, [])).toBe("public");
    expect(
      categoryVisibility({ scope: "site", key: "general" }, [
        { key: "general", visibility: "staff" },
      ])
    ).toBe("staff");
    expect(categoryVisibility({ scope: "site", key: "xf-99" }, [])).toBe("restricted");
  });

  it("makes a realm category public only while its realm is published", () => {
    const urcea = { scope: "realm", realm: "urcea", key: "hub" } as const;
    expect(categoryVisibility(urcea, [], new Set(["urcea"]))).toBe("public");
    expect(categoryVisibility(urcea, [], new Set(["ixworld"]))).toBe("restricted");
    expect(categoryVisibility(urcea, [])).toBe("restricted");
  });
});

describe("importedThread", () => {
  const thread = (discussion_state = "visible") => ({ discussion_state }) as XfThread;
  const post = (post_id: number, message_state = "visible", is_first_post = false) =>
    ({ post_id, message_state, is_first_post }) as XfPost;

  it("skips deleted threads, threads without posts and threads whose first post is deleted", () => {
    expect(importedThread(thread("deleted"), [post(1, "visible", true)])).toEqual({
      skip: "deleted",
    });
    expect(importedThread(thread(), [])).toEqual({ skip: "noPosts" });
    expect(importedThread(thread(), [post(1, "deleted", true), post(2)])).toEqual({
      skip: "firstPostDeleted",
    });
  });

  it("keeps posts that are not deleted and hides the thread for a moderated thread or first post", () => {
    const visible = importedThread(thread(), [
      post(1, "visible", true),
      post(2, "deleted"),
      post(3),
    ]);
    expect(visible).toMatchObject({ hidden: false });
    expect("posts" in visible && visible.posts.map((p) => p.post_id)).toEqual([1, 3]);
    expect(importedThread(thread("moderated"), [post(1, "visible", true)])).toMatchObject({
      hidden: true,
    });
    expect(importedThread(thread(), [post(1, "moderated", true), post(2)])).toMatchObject({
      hidden: true,
    });
    expect(
      importedThread(thread(), [post(1, "visible", true), post(2, "moderated")])
    ).toMatchObject({ hidden: false });
  });
});
