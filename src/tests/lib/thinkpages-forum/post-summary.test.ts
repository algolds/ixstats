/** @jest-environment node */
import { postSummary } from "~/lib/thinkpages-forum/post-summary";

describe("postSummary (M13)", () => {
  it("is the post's text when it has any", () => {
    expect(
      postSummary({ plainText: "  Hello  ", contentHtml: '<p>Hello <img src="/a.png"></p>' })
    ).toBe("Hello");
  });

  it("names the images of an image-only post", () => {
    expect(
      postSummary({ plainText: "", contentHtml: '<p><img src="/images/uploads/a.png"></p>' })
    ).toBe("[1 image]");
    expect(
      postSummary({
        plainText: " ",
        contentHtml: '<p><IMG src="/a.png"><img alt="" src="/b.png"></p>',
      })
    ).toBe("[2 images]");
  });

  it("is empty for a post with neither", () => {
    expect(postSummary({ plainText: "", contentHtml: "<p></p>" })).toBe("");
  });
});
