/** @jest-environment node */
import { modEditPost } from "~/server/modules/thinkpages-forum";
import { prepareBody } from "~/server/modules/thinkpages-forum/writes";
import { eurthMod, postIn, seed } from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";

describe("prepareBody: an image counts as content", () => {
  it("keeps an image-only body with empty plain text", () => {
    expect(prepareBody('<p><img src="/images/uploads/forum/55-abc-x.png" alt=""></p>')).toEqual({
      contentHtml: '<p><img src="/images/uploads/forum/55-abc-x.png" alt=""></p>',
      plainText: "",
    });
  });

  it.each([
    ["no body", "<p></p>"],
    ["an image without src", '<p><img alt=""></p>'],
    ["an image whose src the sanitizer removed", '<p><img src="javascript:alert(1)"></p>'],
    ["an empty src", '<p><img src="" alt=""></p>'],
  ])("still refuses %s", (_, html) => {
    expect(() => prepareBody(html)).toThrow("A post needs some text.");
  });

  it("still refuses a token inside an image attribute", () => {
    expect(() => prepareBody('<p><img src="/images/a.png" alt="[ixaction=a1]"></p>')).toThrow(
      "Action links must be plain text in the post body"
    );
  });

  it("lets a moderator edit a post down to an image", async () => {
    const store = forumStore(seed());
    await modEditPost(store.db as never, eurthMod, {
      postId: "p_e2",
      html: '<p><img src="/images/uploads/a.png" alt=""></p>',
      note: "kept the map only",
    });
    expect(postIn(store, "p_e2")).toMatchObject({
      contentHtml: '<p><img src="/images/uploads/a.png" alt=""></p>',
      plainText: "",
    });
  });
});
