/** @jest-environment node */
/**
 * F25: the control characters XML cannot carry are never part of a WikiOS page, as in MediaWiki.
 */
import { stripXmlForbiddenControlChars } from "~/lib/wiki-os/xml/control-chars";

describe("stripXmlForbiddenControlChars", () => {
  const forbidden = [
    ...Array.from({ length: 9 }, (_, i) => i), // U+0000-U+0008
    0x0b,
    0x0c,
    ...Array.from({ length: 18 }, (_, i) => 0x0e + i), // U+000E-U+001F
    0xfffe,
    0xffff,
  ].map((code) => String.fromCharCode(code));

  it("removes every character in the forbidden set", () => {
    expect(forbidden).toHaveLength(9 + 2 + 18 + 2);
    for (const char of forbidden) {
      expect(stripXmlForbiddenControlChars(`a${char}b${char}${char}c`)).toBe("abc");
    }
  });

  it("keeps tab, line feed, carriage return, DEL, the C1 controls and every other character", () => {
    const kept = "tab\tline\nreturn\r del\u007F c1\u0085 nbsp  é 日本語 😀 ﻿ � {{Infobox|x=1}} [[Link]]";
    expect(stripXmlForbiddenControlChars(kept)).toBe(kept);
  });

  it("leaves the empty string empty", () => {
    expect(stripXmlForbiddenControlChars("")).toBe("");
  });
});
