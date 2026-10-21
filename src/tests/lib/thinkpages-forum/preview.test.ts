/** @jest-environment node */
import { FEED_EXCERPT_MAX, previewExcerpt } from "~/lib/thinkpages-forum/preview";
describe("previewExcerpt", () => {
  it("is at most 280 characters of whole words for the feed", () => {
    const out = previewExcerpt("word ".repeat(100), FEED_EXCERPT_MAX);
    expect([...out].length).toBeLessThanOrEqual(FEED_EXCERPT_MAX);
    expect(out.endsWith("…")).toBe(true);
    expect(
      out
        .slice(0, -1)
        .split(" ")
        .every((w) => w === "word")
    ).toBe(true);
  });

  it("strips action tokens, including one that joins another when removed", () => {
    expect(previewExcerpt("See [ixaction=a1] this [ixaction=b2]", 280)).toBe("See this");
    expect(previewExcerpt("[ixaction=a1]", 280)).toBe("");
    expect(previewExcerpt("x[ixaction=[ixaction=a]b]y", 280)).toBe("xy");
  });

  it("never splits a surrogate pair", () => {
    expect(previewExcerpt("😀".repeat(20), 10)).toBe(`${"😀".repeat(9)}…`);
  });
});
