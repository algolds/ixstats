/** @jest-environment node */
/**
 * Plan 402: redirects are recognised the way MediaWiki recognises them (text STARTS with
 * #REDIRECT), and the target is a canonical title plus an optional fragment.
 */
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
});
