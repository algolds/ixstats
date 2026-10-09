/** @jest-environment node */
/** M13: image-only posts (allowed since phase 4) read as their images in report excerpts and the edit log. */
import { listReports, modEditPost } from "~/server/modules/thinkpages-forum";
import { admin, eurthMod, expectOneLog, seed } from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";

const IMAGE_ONLY = { contentHtml: '<p><img src="/images/uploads/a.png"></p>', plainText: "" };

function storeWithImageOnlyPost() {
  const base = seed();
  const posts = base.posts.map((p) => (p.id === "p_e2" ? { ...p, ...IMAGE_ONLY } : p));
  return forumStore({ ...base, posts });
}

describe("image-only posts in moderator views (M13)", () => {
  it("gives a reported image-only post an excerpt naming its images", async () => {
    const store = storeWithImageOnlyPost();
    const { rows } = await listReports(store.db as never, admin, { status: "open" }, 1);
    expect(rows.find((r) => r.id === "rep_post")).toMatchObject({ excerpt: "[1 image]" });
  });

  it("logs an edited image-only post's previous body as its images", async () => {
    const store = storeWithImageOnlyPost();
    await modEditPost(store.db as never, eurthMod, {
      postId: "p_e2",
      html: "<p>Caption added</p>",
      note: "context",
    });
    const detail = expectOneLog(store, { action: "post.edit", targetId: "p_e2" });
    expect(detail).toEqual({ note: "context", previous: "[1 image]" });
  });
});
