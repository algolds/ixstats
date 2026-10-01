/** @jest-environment node */
/**
 * F25: the characters XML cannot carry are never part of a WikiOS page, as in MediaWiki; m5: nor is a lone surrogate.
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

  it("removes U+FFFE and U+FFFF, written here as escapes", () => {
    expect(stripXmlForbiddenControlChars("a\uFFFEb\uFFFFc")).toBe("abc");
  });

  it("keeps tab, line feed, carriage return, DEL, the C1 controls, U+FFFD and every other character", () => {
    const kept =
      "tab\tline\nreturn\r del\u007F c1\u0085 nbsp  é 日本語 \u{1F600} bom﻿ repl\uFFFD {{Infobox|x=1}} [[Link]]";
    expect(stripXmlForbiddenControlChars(kept)).toBe(kept);
  });

  it("leaves the empty string empty", () => {
    expect(stripXmlForbiddenControlChars("")).toBe("");
  });
});

describe("lone surrogates (PostgreSQL cannot store them: a save of one was a 500)", () => {
  it.each([
    ["a lone high surrogate", "a\uD800b", "a\uFFFDb"],
    ["a lone low surrogate", "a\uDC00b", "a\uFFFDb"],
    ["a high surrogate at the end", "end\uD83D", "end\uFFFD"],
    ["a low surrogate at the start", "\uDE00start", "\uFFFDstart"],
    ["a reversed pair", "\uDC00\uD800", "\uFFFD\uFFFD"],
    ["a high surrogate before another high one", "\uD800𐀀", "\uFFFD𐀀"],
  ])("replaces %s with U+FFFD, as MediaWiki's UTF-8 normalisation does", (_name, input, expected) => {
    expect(stripXmlForbiddenControlChars(input)).toBe(expected);
  });

  it("keeps a well-formed pair (an emoji, a character outside the BMP)", () => {
    expect(stripXmlForbiddenControlChars("\u{1F600} \u{20BB7} 😀")).toBe("\u{1F600} \u{20BB7} 😀");
  });

  it("never joins two lone surrogates into a pair by removing a control between them", () => {
    expect(stripXmlForbiddenControlChars("\uD800\u0001\uDC00")).toBe("\uFFFD\uFFFD");
  });

  it("gives text PostgreSQL and the export can carry: what it returns survives a UTF-8 round trip", () => {
    const stripped = stripXmlForbiddenControlChars("x\uD800y\uDC00z\u0000\uFFFE\uD83D");

    expect(Buffer.from(stripped, "utf8").toString("utf8")).toBe(stripped);
    expect(stripped).toBe("x\uFFFDy\uFFFDz\uFFFD");
  });
});

describe("the strip is a fixed point (stripping stripped text changes nothing)", () => {
  it("holds for every pair of the interesting characters", () => {
    const parts = ["a", "\u0000", "\u0001", "\t", "\uFFFE", "\uFFFF", "\uFFFD", "\uD800", "\uDC00", "\u{1F600}", "\uDE00", "\uD83D"];
    for (const left of parts) {
      for (const middle of parts) {
        for (const right of parts) {
          const once = stripXmlForbiddenControlChars(`${left}${middle}${right}`);
          expect(stripXmlForbiddenControlChars(once)).toBe(once);
        }
      }
    }
  });
});
