import { readingMinutes, readingProgress } from "~/lib/lore/reading";

describe("readingMinutes", () => {
  it("counts the words in the text, not the markup, at 230 a minute", () => {
    const words = Array.from({ length: 690 }, () => "word").join(" ");
    expect(readingMinutes(`<p class="lead">${words}</p><table><tr><td></td></tr></table>`)).toBe(3);
  });

  it("never says less than a minute for a short page, and nothing for an empty one", () => {
    expect(readingMinutes("<p>A short stub.</p>")).toBe(1);
    expect(readingMinutes("<div> </div>")).toBe(0);
  });
});

describe("readingProgress", () => {
  const viewport = 800;
  it("is 0 before the article reaches the top, 1 once its end is in view", () => {
    expect(readingProgress({ top: 200, height: 4000 }, viewport)).toBe(0);
    expect(readingProgress({ top: -3200, height: 4000 }, viewport)).toBe(1);
    expect(readingProgress({ top: -9000, height: 4000 }, viewport)).toBe(1);
  });

  it("runs linearly through the article", () => {
    expect(readingProgress({ top: -1600, height: 4000 }, viewport)).toBeCloseTo(0.5, 5);
  });

  it("treats an article shorter than the viewport as read once it is in view", () => {
    expect(readingProgress({ top: 0, height: 300 }, viewport)).toBe(1);
  });
});
