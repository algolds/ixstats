/** @jest-environment node */
import { wikiName } from "~/lib/wiki-os/wiki-name";

describe("wikiName", () => {
  it("names IxWiki IxWiki, and a sister wiki by its own name", () => {
    expect(wikiName("ixwiki")).toBe("IxWiki");
    expect(wikiName("iiwiki")).toBe("IIWiki");
    expect(wikiName("althistory")).toBe("AltHistory Wiki");
  });
});
