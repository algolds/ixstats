/** @jest-environment node */
/** Plan 410: a ProtectedScanner changes how fast the tag lookups are, never what they answer; and it is required. */
import { findTagClose, matchOpenTag, ProtectedScanner, skipProtectedAt } from "~/lib/wiki-os/wikitext/protected-regions";

const NAMES = ["nowiki", "pre", "math", "syntaxhighlight", "source", "gallery", "poem", "references", "timeline", "score", "imagemap", "templatedata", "charinsert", "hiero", "mapframe", "maplink", "graph", "inputbox", "categorytree", "indicator", "ref"];

/** The plain reading of the rules: a regex for the opening tag, a forward search for the closing one. */
function reference(text: string, i: number, includeRef: boolean): number | null {
  if (text.charCodeAt(i) !== 60) return null;
  if (text.startsWith("<!--", i)) {
    const close = text.indexOf("-->", i + 4);
    return close === -1 ? text.length : close + 3;
  }
  const open = new RegExp(`<(${NAMES.join("|")})(?=[\\s/>])[^>]*>`, "iy");
  open.lastIndex = i;
  const match = open.exec(text);
  if (!match) return null;
  const name = match[1]!.toLowerCase();
  if (name === "ref" && !includeRef) return null;
  const openEnd = i + match[0].length;
  if (match[0].endsWith("/>")) return openEnd;
  const close = new RegExp(`</${name}\\s*>`, "gi");
  close.lastIndex = openEnd;
  const found = close.exec(text);
  return found ? found.index + found[0].length : null;
}

describe("ProtectedScanner", () => {
  it("answers exactly what the plain reading of the rules answers, over random texts of tags and comments", () => {
    const pieces = ["<nowiki>", "</nowiki>", "<nowiki ", "<pre a='b'>", "</PRE >", "<ref name=a>", "</ref>", "<ref/>", "<!--", "-->", "<", ">", "x", " ", "\n", "<referencesfoo>"];
    let seed = 99;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    for (let round = 0; round < 4000; round++) {
      const text = Array.from({ length: 1 + (next() % 14) }, () => pieces[(next() >> 8) % pieces.length]).join("");
      const scanner = new ProtectedScanner(text);
      for (let i = text.indexOf("<"); i !== -1; i = text.indexOf("<", i + 1)) {
        for (const includeRef of [false, true]) {
          expect([text, i, includeRef, skipProtectedAt(text, i, includeRef, scanner)]).toEqual([text, i, includeRef, reference(text, i, includeRef)]);
        }
        const tag = matchOpenTag(text, i, scanner);
        if (tag) expect(findTagClose(tag, scanner)).toBe(tag.selfClosing ? tag.openEnd : (reference(text, i, true) ?? -1));
      }
    }
  });

  it("keeps nothing between texts: a new scanner of another text is not told about the first", () => {
    const first = new ProtectedScanner("<nowiki>a</nowiki>");
    expect(skipProtectedAt(first.text, 0, false, first)).toBe(18);
    const second = new ProtectedScanner("<nowiki>a");
    expect(skipProtectedAt(second.text, 0, false, second)).toBeNull();
  });
});
