/** @jest-environment node */
/**
 * extractSectionsFromWikitext (getPageSections' heading scan): the `== Heading ==` lines of a page, read a
 * line at a time. It replaced `/^(={2,6})\s*(.+?)\s*\1$/gm`, which took 26 s on a line of `==`, 4,000
 * blanks and a letter, so anyone who could save such a line stalled every reader of the page's sections.
 */
import { extractSectionsFromWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers";
import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";

describe("extractSectionsFromWikitext", () => {
  it("lists level 2 to 6 headings in order, trimmed, with the level of the matching runs", () => {
    const wikitext = [
      "Lead text.",
      "== History ==",
      "Text.",
      "=== Early   years===",
      "==== Deep ====  ",
      "====== Six ======",
      "= Level one =",
      "== Unclosed",
      "=== Uneven ==",
      "== CRLF ==\r",
    ].join("\n");

    expect(extractSectionsFromWikitext(wikitext)).toEqual([
      { level: 2, title: "History", index: 0 },
      { level: 3, title: "Early   years", index: 1 },
      { level: 4, title: "Deep", index: 2 },
      { level: 6, title: "Six", index: 3 },
      { level: 2, title: "= Uneven", index: 4 },
      { level: 2, title: "CRLF", index: 5 },
    ]);
  });

  it("is linear on a heading opener followed by a long blank run", () => {
    const hostile = `==${" ".repeat(200_000)}a\n`.repeat(5);
    const began = performance.now();
    expect(extractSectionsFromWikitext(hostile)).toEqual([]);
    expect(performance.now() - began).toBeLessThan(150 * TIMING_BUDGET_SCALE);
  });
});
