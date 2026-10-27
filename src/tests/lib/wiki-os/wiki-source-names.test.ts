/** @jest-environment node */
/**
 * Labels name the wiki an article is from by `WIKI_SOURCES[source].name`: IxWiki is "Wiki" (owner, 2026-10-25), a
 * sister wiki keeps its own name, and the product brand (`siteName`) stays WikiOS.
 */
import { WIKI_SOURCES, wikiosConfig } from "~/lib/wiki-os/config";

describe("wiki source names", () => {
  it("names IxWiki Wiki and each sister wiki by its own name; the product stays WikiOS", () => {
    expect(WIKI_SOURCES.ixwiki.name).toBe("Wiki");
    expect(WIKI_SOURCES.iiwiki.name).toBe("IIWiki");
    expect(WIKI_SOURCES.althistory.name).toBe("AltHistory Wiki");
    expect(wikiosConfig.siteName).toBe("WikiOS");
  });
});
