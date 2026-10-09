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
    ["a bare word src", '<p><img src="x"></p>'],
    ["a fragment src", '<p><img src="#"></p>'],
    ["a protocol-relative src", '<p><img src="//e.com/a.png"></p>'],
    ["a data: src", '<p><img src="data:image/png;base64,AAAA"></p>'],
  ])("still refuses %s", (_, html) => {
    expect(() => prepareBody(html)).toThrow("A post needs some text.");
  });

  it("still refuses a token inside an image attribute", () => {
    expect(() =>
      prepareBody('<p><img src="/images/uploads/a.png" alt="[ixaction=a1]"></p>')
    ).toThrow("Action links must be plain text in the post body");
  });

  describe("the media picker's URL forms, through the real sanitizer", () => {
    const saved = process.env.NEXT_PUBLIC_BASE_PATH;
    beforeEach(() => {
      process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    });
    afterEach(() => {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
      else process.env.NEXT_PUBLIC_BASE_PATH = saved;
    });

    it.each([
      ["an upload", "/images/uploads/1700000000-abc.png"],
      [
        "a downloaded external image under the base path",
        "/projects/ixstates/images/downloaded/x.png",
      ],
      ["a downloaded external image at the root", "/images/downloaded/x.png"],
      [
        "a Commons file through the MediaWiki proxy",
        "/api/mediawiki/commons/Special:Filepath/Flag%20of%20Caphiria%20%28alt%29.svg",
      ],
      [
        "a wiki file through the proxy under the base path",
        "/projects/ixstates/api/mediawiki/ixwiki/images/a/ab/Map.png",
      ],
      ["an absolute https image", "https://upload.wikimedia.org/x/a.png"],
    ])("keeps an image-only post with %s", (_, src) => {
      const html = `<p><img src="${src}" alt=""></p>`;
      expect(prepareBody(html)).toEqual({ contentHtml: html, plainText: "" });
    });
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
