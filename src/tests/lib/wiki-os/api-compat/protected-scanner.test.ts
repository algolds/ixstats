/** @jest-environment node */
/** Plan 410: a ProtectedScanner changes how fast the tag lookups are, never what they answer. */
import { findTagClose, matchOpenTag, ProtectedScanner, skipProtectedAt } from "~/lib/wiki-os/wikitext/protected-regions";

describe("ProtectedScanner", () => {
  it("answers exactly what the lookups without one answer, over random texts of tags and comments", () => {
    const pieces = ["<nowiki>", "</nowiki>", "<nowiki ", "<pre a='b'>", "</PRE >", "<ref name=a>", "</ref>", "<ref/>", "<!--", "-->", "<", ">", "x", " ", "\n", "<referencesfoo>"];
    let seed = 99;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    for (let round = 0; round < 4000; round++) {
      const text = Array.from({ length: 1 + (next() % 14) }, () => pieces[(next() >> 8) % pieces.length]).join("");
      const scanner = new ProtectedScanner(text);
      for (let i = text.indexOf("<"); i !== -1; i = text.indexOf("<", i + 1)) {
        for (const includeRef of [false, true]) {
          expect([text, i, skipProtectedAt(text, i, includeRef, scanner)]).toEqual([text, i, skipProtectedAt(text, i, includeRef)]);
        }
        const tag = matchOpenTag(text, i);
        expect(matchOpenTag(text, i, scanner)).toEqual(tag);
        if (tag) expect(findTagClose(text, tag, scanner)).toBe(findTagClose(text, tag));
      }
    }
  });

  it("keeps nothing between texts: a new scanner of another text is not told about the first", () => {
    const first = new ProtectedScanner("<nowiki>a</nowiki>");
    expect(skipProtectedAt(first.text, 0, false, first)).toBe(18);
    const second = new ProtectedScanner("<nowiki>a");
    expect(skipProtectedAt(second.text, 0, false, second)).toBeNull();
    expect(skipProtectedAt("<nowiki>a", 0)).toBeNull();
  });
});
