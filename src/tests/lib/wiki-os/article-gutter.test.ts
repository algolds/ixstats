import { articleUsesInspector } from "~/lib/wiki-os/article-gutter";

describe("articleUsesInspector", () => {
  const base = { reading: true, notFound: false, showToc: true };

  it("uses the Inspector gutter for an article being read with the contents setting on", () => {
    expect(articleUsesInspector(base)).toBe(true);
  });

  it("opts out when the contents setting is off", () => {
    expect(articleUsesInspector({ ...base, showToc: false })).toBe(false);
  });

  it("opts out in the editor and on a missing article, which render no Inspector", () => {
    expect(articleUsesInspector({ ...base, reading: false })).toBe(false);
    expect(articleUsesInspector({ ...base, notFound: true })).toBe(false);
  });
});
