/** @jest-environment node */
import {
  NAMESPACE_CANONICAL_NAMES,
  canonicalizeTitle,
  decodeTitleParam,
  storedNamespace,
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

  it("knows IxWiki's Campaign namespaces (460, 461) next to the standard ones", () => {
    expect(canonicalizeTitle("campaign:operation dawn")).toMatchObject({
      title: "Campaign:Operation dawn",
      namespaceId: 460,
      namespacePrefix: "Campaign",
      slug: "campaign:operation_dawn",
    });
    expect(canonicalizeTitle("Campaign_talk:Operation dawn")).toMatchObject({
      title: "Campaign talk:Operation dawn",
      namespaceId: 461,
      namespacePrefix: "Campaign talk",
    });
  });

  it("keeps Portal: as a plain main-namespace title (IxWiki has no such namespace)", () => {
    expect(canonicalizeTitle("portal:eurth")).toMatchObject({
      title: "Portal:eurth",
      namespaceId: 0,
      namespacePrefix: null,
    });
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

describe("canonicalizeTitle: MediaWiki's invalid titles (Title::secureAndSplit)", () => {
  it("refuses control characters, wherever they are", () => {
    for (const bad of ["a\u0000b", "a\tb", "a\nb", "a\rb", "a\u001Fb", "a\u007Fb", "\u0001a"]) {
      expect(canonicalizeTitle(bad)).toBeNull();
    }
    expect(canonicalizeTitle("Talk:a\nb")).toBeNull();
    expect(canonicalizeTitle("a\u0080b")).not.toBeNull();
  });

  it("refuses a percent followed by two hex digits, but not a bare percent", () => {
    expect(canonicalizeTitle("a%41b")).toBeNull();
    expect(canonicalizeTitle("a%e9b")).toBeNull();
    expect(canonicalizeTitle("Talk:100%25")).toBeNull();
    expect(titleOf("100% Pure")).toBe("100% Pure");
    expect(titleOf("a%4")).toBe("A%4");
    expect(titleOf("a%zz")).toBe("A%zz");
  });

  it("refuses relative path segments", () => {
    for (const bad of [
      ".",
      "..",
      "./a",
      "../a",
      "a/./b",
      "a/../b",
      "a/.",
      "a/..",
      "Talk:..",
      "Talk:a/../b",
    ]) {
      expect(canonicalizeTitle(bad)).toBeNull();
    }
    for (const fine of ["...", "a/b", "a/.b", "a./b", "a/..b", "Wait...", ".hidden", "a.b/c.d"]) {
      expect(canonicalizeTitle(fine)).not.toBeNull();
    }
  });

  it("refuses the signature magic word", () => {
    expect(canonicalizeTitle("a~~~b")).toBeNull();
    expect(canonicalizeTitle("Talk:~~~")).toBeNull();
    expect(titleOf("a~~b")).toBe("A~~b");
  });

  it("refuses a namespace prefix followed by an empty or colon-leading name", () => {
    expect(canonicalizeTitle("Talk:")).toBeNull();
    expect(canonicalizeTitle("Talk: ")).toBeNull();
    expect(canonicalizeTitle("Talk::Foo")).toBeNull();
    expect(canonicalizeTitle("user talk:_:x")).toBeNull();
    expect(titleOf("Talk:Foo:bar")).toBe("Talk:Foo:bar");
  });

  it("normalises again after capitalising, so a canonical title is stable", () => {
    for (const raw of ["\u0345abc", "ǆa", "ǰx", "a\u0300b", "\u1E9Bx", "ßa", "ǅx"]) {
      const first = canonicalizeTitle(raw);
      expect(first?.title).toBe(first?.title.normalize("NFC"));
      expect(canonicalizeTitle(first?.title ?? "")?.title).toBe(first?.title);
    }
  });
});

describe("canonicalizeTitle for another wiki", () => {
  const foreign = (raw: string, source = "iiwiki") => canonicalizeTitle(raw, { source });

  it("never applies IxWiki's namespace table", () => {
    expect(foreign("project:Foo")).toMatchObject({
      title: "Project:Foo",
      namespaceId: 0,
      namespacePrefix: null,
      base: "Project:Foo",
    });
    expect(foreign("image:x.png")?.title).toBe("Image:x.png");
    expect(foreign("ixwiki:about")?.title).toBe("Ixwiki:about");
    expect(foreign("user talk:jane")?.title).toBe("User talk:jane");
  });

  it("still normalises, capitalises and validates", () => {
    expect(foreign("foo_bar  baz", "althistory")?.title).toBe("Foo bar baz");
    expect(foreign(":portal:eurth")?.title).toBe("Portal:eurth");
    expect(foreign("e\u0301cole")?.title).toBe("\u00c9cole");
    expect(foreign("Foo#bar_baz")).toMatchObject({ title: "Foo", fragment: "bar baz" });
    expect(foreign("a[b")).toBeNull();
    expect(foreign("a%41")).toBeNull();
    expect(foreign("Project:")?.title).toBe("Project:");
  });

  it("gives IxWiki the table, whether the source is omitted or named", () => {
    expect(canonicalizeTitle("project:Foo")?.title).toBe("IxWiki:Foo");
    expect(canonicalizeTitle("project:Foo", { source: "ixwiki" })?.title).toBe("IxWiki:Foo");
  });
});

describe("storedNamespace", () => {
  it("uses the canonical namespace for a namespace the table knows", () => {
    const canon = canonicalizeTitle("user talk:Jane");
    expect(canon && storedNamespace(canon, 3)).toEqual({
      namespaceId: 3,
      namespacePrefix: "User talk",
    });
  });

  it("keeps MediaWiki's namespace and the title's own prefix for one the table lacks", () => {
    const canon = canonicalizeTitle("Portal:Eurth");
    expect(canon && storedNamespace(canon, 100)).toEqual({
      namespaceId: 100,
      namespacePrefix: "Portal",
    });
  });

  it("leaves a main-namespace page in namespace 0", () => {
    const canon = canonicalizeTitle("Foo");
    expect(canon && storedNamespace(canon, 0)).toEqual({ namespaceId: 0, namespacePrefix: null });
    const colon = canonicalizeTitle("Star Wars: A Story");
    expect(colon && storedNamespace(colon, 0)).toEqual({ namespaceId: 0, namespacePrefix: null });
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
