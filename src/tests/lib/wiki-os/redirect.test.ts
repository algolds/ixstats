/** @jest-environment node */
/**
 * Plan 402: redirects are recognised the way MediaWiki recognises them (text STARTS with
 * #REDIRECT), and the target is a canonical title plus an optional fragment.
 */
import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { parseRedirect } from "~/lib/wiki-os/core/redirect";

describe("parseRedirect", () => {
  it("reads a plain redirect", () => {
    expect(parseRedirect("#REDIRECT [[Foo]]")).toEqual({
      title: "Foo",
      slug: "foo",
      fragment: null,
    });
  });

  it("is case-insensitive, allows leading whitespace and a colon, and canonicalizes the target", () => {
    expect(parseRedirect("  #redirect:[[foo_bar#Sec one]]")).toEqual({
      title: "Foo bar",
      slug: "foo_bar",
      fragment: "Sec one",
    });
  });

  it("drops the pipe label", () => {
    expect(parseRedirect("#REDIRECT [[Foo|label]]")?.title).toBe("Foo");
    expect(parseRedirect("#REDIRECT [[Foo#Bar|label]]")).toMatchObject({
      title: "Foo",
      fragment: "Bar",
    });
  });

  it("strips the leading colon of a namespace link", () => {
    expect(parseRedirect("#REDIRECT [[:Category:X]]")).toMatchObject({
      title: "Category:X",
      fragment: null,
    });
  });

  it("ignores a #REDIRECT that does not start the text", () => {
    expect(parseRedirect("Text first\n#REDIRECT [[Foo]]")).toBeNull();
    expect(parseRedirect("<nowiki>#REDIRECT [[Foo]]</nowiki>")).toBeNull();
  });

  it("ignores an empty, fragment-only or invalid target", () => {
    expect(parseRedirect("#REDIRECT [[]]")).toBeNull();
    expect(parseRedirect("#REDIRECT [[#Section]]")).toBeNull();
    expect(parseRedirect("#REDIRECT [[a{b]]")).toBeNull();
    expect(parseRedirect("#REDIRECT Foo")).toBeNull();
  });

  it("ignores null, undefined and ordinary text", () => {
    expect(parseRedirect(null)).toBeNull();
    expect(parseRedirect(undefined)).toBeNull();
    expect(parseRedirect("")).toBeNull();
    expect(parseRedirect("An article about a [[Redirect]].")).toBeNull();
  });

  it("takes the target up to the first pipe or closing brackets, even with a ] in the label", () => {
    expect(parseRedirect("#REDIRECT [[Foo|la]bel]]")?.title).toBe("Foo");
    expect(parseRedirect("#REDIRECT [[Foo]]]")?.title).toBe("Foo");
    expect(parseRedirect("#REDIRECT [[Foo]bar]]")).toBeNull();
  });

  it("needs the link to close on the same line", () => {
    expect(parseRedirect("#REDIRECT [[Foo")).toBeNull();
    expect(parseRedirect("#REDIRECT [[Foo|label")).toBeNull();
    expect(parseRedirect("#REDIRECT [[Foo\nBar]]")).toBeNull();
    expect(parseRedirect("#REDIRECT [[Foo|label\n]]")).toBeNull();
    expect(parseRedirect("#REDIRECT [[Foo]]\nMore text after the link.")?.title).toBe("Foo");
  });

  it("strips only ASCII whitespace before #REDIRECT: a no-break space or BOM is not a redirect", () => {
    expect(parseRedirect("\u00A0#REDIRECT [[Foo]]")).toBeNull();
    expect(parseRedirect("\uFEFF#REDIRECT [[Foo]]")).toBeNull();
    expect(parseRedirect(" \t\r\n#REDIRECT\n[[Foo]]")?.title).toBe("Foo");
  });

  it("percent-decodes the target and the fragment, as MediaWiki's rawurldecode does", () => {
    expect(parseRedirect("#REDIRECT [[%41bc]]")?.title).toBe("Abc");
    expect(parseRedirect("#REDIRECT [[Foo%20bar#Sec%20one]]")).toMatchObject({
      title: "Foo bar",
      fragment: "Sec one",
    });
    expect(parseRedirect("#REDIRECT [[%3ACategory%3AX]]")?.title).toBe("Category:X");
  });

  it("refuses a target whose percent escape is malformed or decodes to something illegal", () => {
    expect(parseRedirect("#REDIRECT [[Foo%FF]]")).toBeNull();
    expect(parseRedirect("#REDIRECT [[Foo%5Dbar]]")).toBeNull();
    expect(parseRedirect("#REDIRECT [[Foo%0Abar]]")).toBeNull();
  });

  it("rejects catastrophic input in linear time", () => {
    const hostile = [
      "#REDIRECT" + " ".repeat(200_000) + "x",
      " ".repeat(200_000) + "x",
      "#REDIRECT [[" + "a".repeat(200_000),
      "#REDIRECT [[" + "a|".repeat(100_000),
      "#REDIRECT [[" + "]".repeat(100_000) + "x",
    ];
    for (const text of hostile) {
      const started = performance.now();
      parseRedirect(text);
      expect(performance.now() - started).toBeLessThan(100 * TIMING_BUDGET_SCALE);
    }
    expect(parseRedirect("#REDIRECT" + " ".repeat(200_000) + "x")).toBeNull();
  });
});
