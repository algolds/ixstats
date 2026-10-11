/** @jest-environment node */
import {
  FEED_EXCERPT_MAX,
  PANEL_EXCERPT_MAX,
  PANEL_MESSAGES,
  previewExcerpt,
} from "~/lib/thinkpages-forum/preview";

describe("preview constants", () => {
  it("are the spec's numbers", () => {
    expect(FEED_EXCERPT_MAX).toBe(280);
    expect(PANEL_EXCERPT_MAX).toBe(90);
    expect(PANEL_MESSAGES).toBe(3);
  });
});

describe("previewExcerpt", () => {
  it("keeps a short text whole with its whitespace collapsed", () => {
    expect(previewExcerpt("  Hello \n\n  world\t!  ", 280)).toBe("Hello world !");
  });

  it("cuts at a whole word and ends with an ellipsis within the limit", () => {
    const out = previewExcerpt("alpha beta gamma delta", 12);
    expect(out).toBe("alpha beta…");
    expect([...out].length).toBeLessThanOrEqual(12);
  });

  it("keeps the last word when the cut falls exactly on a space", () => {
    expect(previewExcerpt("alpha beta gamma", 11)).toBe("alpha beta…");
  });

  it("cuts one over-long word hard", () => {
    expect(previewExcerpt("a".repeat(50), 10)).toBe(`${"a".repeat(9)}…`);
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(previewExcerpt("Hello, world, again", 14)).toBe("Hello, world…");
  });

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

  it("returns an empty string for nothing", () => {
    expect(previewExcerpt("", 90)).toBe("");
    expect(previewExcerpt("   \n ", 90)).toBe("");
  });
});
