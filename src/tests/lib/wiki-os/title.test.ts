/** @jest-environment node */
import {
  NAMESPACE_CANONICAL_NAMES,
  canonicalizeTitle,
  decodeTitleParam,
} from "~/lib/wiki-os/core/title";

const titleOf = (raw: string): string | undefined => canonicalizeTitle(raw)?.title;

describe("canonicalizeTitle", () => {
  it("turns underscores into spaces and upper-cases only the first letter", () => {
    expect(titleOf("foo_bar")).toBe("Foo bar");
    expect(titleOf("  foo   bar  ")).toBe("Foo bar");
    expect(titleOf("fooBar_bAZ")).toBe("FooBar bAZ");
  });

  it("keeps an all-caps title and capitalises a lower-case one (NATO vs Nato stay distinct)", () => {
    expect(titleOf("NATO")).toBe("NATO");
    expect(titleOf("nato")).toBe("Nato");
    expect(canonicalizeTitle("NATO")?.slug).toBe(canonicalizeTitle("nato")?.slug);
  });

  it("writes a recognised namespace prefix in its canonical form, case-insensitively", () => {
    const talk = canonicalizeTitle("user talk:jane_doe");
    expect(talk).toMatchObject({
      title: "User talk:Jane doe",
      namespaceId: 3,
      namespacePrefix: "User talk",
      base: "Jane doe",
      slug: "user_talk:jane_doe",
      urlPath: "User_talk:Jane_doe",
    });
    expect(titleOf("TEMPLATE:infobox country")).toBe("Template:Infobox country");
    expect(titleOf("module:foo")).toBe("Module:Foo");
  });

  it("resolves namespace aliases to the canonical name", () => {
    expect(titleOf("Image:x.png")).toBe("File:X.png");
    expect(titleOf("ixwiki:About")).toBe("IxWiki:About");
    expect(titleOf("project talk:rules")).toBe("IxWiki talk:Rules");
  });

  it("reports the main namespace without a prefix", () => {
    expect(canonicalizeTitle("Foo")).toMatchObject({ namespaceId: 0, namespacePrefix: null });
  });

  it("does not treat an unknown prefix as a namespace", () => {
    expect(canonicalizeTitle("star wars: a story")).toMatchObject({
      title: "Star wars: a story",
      namespaceId: 0,
      namespacePrefix: null,
    });
  });

  it("drops a leading colon", () => {
    expect(titleOf(":Foo")).toBe("Foo");
    expect(titleOf(":category:y")).toBe("Category:Y");
  });

  it("splits the fragment off the title", () => {
    expect(canonicalizeTitle("Foo#Bar_baz")).toMatchObject({ title: "Foo", fragment: "Bar baz" });
    expect(canonicalizeTitle("Foo#")).toMatchObject({ title: "Foo", fragment: null });
    expect(canonicalizeTitle("Foo")?.fragment).toBeNull();
    expect(canonicalizeTitle("#Bar")).toBeNull();
  });

  it("keeps a character whose upper-case form is several characters", () => {
    expect(titleOf("ßtraße")).toBe("ßtraße");
  });

  it("upper-cases a single accented letter", () => {
    expect(titleOf("é")).toBe("É");
    expect(titleOf("élan")).toBe("Élan");
  });

  it("treats an astral first character as one code point", () => {
    const title = titleOf("𝒜bc");
    expect(title).toBe("𝒜bc");
    expect(Array.from(title ?? "")).toHaveLength(3);
    expect(title).toHaveLength(4);
    expect(titleOf("𐐨bc")).toBe("𐐀bc");
  });

  it("refuses an empty page name", () => {
    expect(canonicalizeTitle("Talk:")).toBeNull();
    expect(canonicalizeTitle("")).toBeNull();
    expect(canonicalizeTitle("   ")).toBeNull();
    expect(canonicalizeTitle(":")).toBeNull();
  });

  it("refuses the characters MediaWiki forbids in a title", () => {
    for (const bad of ["a[b", "a]b", "a{b", "a}b", "a|b", "a<b", "a>b"]) {
      expect(canonicalizeTitle(bad)).toBeNull();
    }
  });

  it("refuses a page name longer than 255 UTF-8 bytes", () => {
    expect(canonicalizeTitle("a".repeat(255))).not.toBeNull();
    expect(canonicalizeTitle("a".repeat(256))).toBeNull();
    expect(canonicalizeTitle("é".repeat(128))).toBeNull();
    expect(canonicalizeTitle("é".repeat(127))).not.toBeNull();
  });

  it("produces identical output for composed and decomposed input", () => {
    const composed = canonicalizeTitle("école");
    const decomposed = canonicalizeTitle("école");
    expect(decomposed).toEqual(composed);
    expect(composed?.title).toBe("École");
  });

  it("round-trips a title with a percent sign through urlPath and decodeTitleParam", () => {
    const canon = canonicalizeTitle("100% Pure");
    expect(canon?.urlPath).toBe("100%25_Pure");
    expect(canonicalizeTitle(decodeTitleParam(canon?.urlPath ?? ""))?.title).toBe("100% Pure");
  });

  it("keeps ':' and '/' literal in urlPath and encodes everything else", () => {
    expect(canonicalizeTitle("user:jane/sandbox")?.urlPath).toBe("User:Jane/sandbox");
    expect(canonicalizeTitle("café & crème")?.urlPath).toBe("Caf%C3%A9_%26_cr%C3%A8me");
  });

  it("knows the canonical name of every namespace", () => {
    expect(NAMESPACE_CANONICAL_NAMES[-1]).toBe("Special");
    expect(NAMESPACE_CANONICAL_NAMES[-2]).toBe("Media");
    expect(NAMESPACE_CANONICAL_NAMES[828]).toBe("Module");
    expect(NAMESPACE_CANONICAL_NAMES[0]).toBeUndefined();
  });

  it("is idempotent", () => {
    for (const raw of ["foo_bar", "user talk:jane", "Image:x.png", "NATO", "é", "ixwiki:about"]) {
      const first = canonicalizeTitle(raw);
      expect(canonicalizeTitle(first?.title ?? "")?.title).toBe(first?.title);
    }
  });
});

describe("decodeTitleParam", () => {
  it("decodes a path segment once", () => {
    expect(decodeTitleParam("Foo%20bar")).toBe("Foo bar");
    expect(decodeTitleParam("100%2525")).toBe("100%25");
  });

  it("returns a malformed segment untouched instead of throwing", () => {
    expect(decodeTitleParam("%E0%A4%A")).toBe("%E0%A4%A");
    expect(decodeTitleParam("100% Pure")).toBe("100% Pure");
  });

  it("keeps '+' as '+'", () => {
    expect(decodeTitleParam("C++_Guide")).toBe("C++_Guide");
  });
});
