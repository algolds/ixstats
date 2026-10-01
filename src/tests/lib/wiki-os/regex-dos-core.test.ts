/** @jest-environment node */
/**
 * The linear rewrites and ceilings of core/ and xml/ (plan F15, the regex-DoS sweep): the title ceiling, the
 * redirect target of a dump, each held against a verbatim copy of the
 * code it replaced on random small texts made of the tokens it reads, and on the real-looking pages of
 * src/tests/fixtures/wikitext. The gate that they are fast is regex-dos.test.ts.
 */
import { disagreements, fixtureTexts, randomTexts } from "../../helpers/wikitext-fuzz";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { checkEditPolicy, parseWikiTitle } from "~/lib/wiki-os/namespace-policy";
import { redirectTargetOf } from "~/lib/wiki-os/xml/fetch-dump";

const fixtures = fixtureTexts();

// ---- xml/fetch-dump: redirectTargetOf -------------------------------------------------------------------

describe("redirectTargetOf reads the target in one scan", () => {
  const TOKENS = [
    "#REDIRECT",
    "#redirect",
    "#ReDirect",
    " ",
    " ",
    "\n",
    "\t",
    "\u00a0",
    "\ufeff",
    ":",
    "[[",
    "[",
    "]]",
    "]",
    "|",
    "#",
    "Foo",
    "Foo Bar",
    "Ünï",
    "a",
    "label",
    "Sec tion",
  ];
  /** `redirectTargetOf` as it was. */
  const legacy = (wikitext: string): string | null => {
    const match =
      /^\s*#REDIRECT\s*:?\s*\[\[\s*:?([^\]|#]+?)\s*(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/i.exec(wikitext);
    return match?.[1]?.trim() ?? null;
  };

  it("answers what the expression answered, on random texts that start like a redirect", () => {
    const texts = [...randomTexts(TOKENS, 80_000, 61, 12)].map((t) => `#REDIRECT [[${t}`);
    expect(disagreements(texts, redirectTargetOf, legacy)).toEqual([]);
  });

  it("answers what the expression answered, on random texts and the real pages", () => {
    expect(
      disagreements([...randomTexts(TOKENS, 80_000, 62, 12), ...fixtures], redirectTargetOf, legacy)
    ).toEqual([]);
  });

  it("keeps its answers for the usual forms", () => {
    expect(redirectTargetOf("#REDIRECT [[Foo bar#Sec|label]]")).toBe("Foo bar");
    expect(redirectTargetOf(" \n#redirect: [[ :Foo ]]")).toBe("Foo");
    expect(redirectTargetOf("#REDIRECT [[]]")).toBeNull();
    expect(redirectTargetOf("#REDIRECT [[Foo")).toBeNull();
    expect(redirectTargetOf("text #REDIRECT [[Foo]]")).toBeNull();
  });
});

// ---- core/title: a page name is bounded -----------------------------------------------------------------

describe("canonicalizeTitle looks at no more than 4,096 characters of a title", () => {
  it("still canonicalizes what it did", () => {
    expect(canonicalizeTitle("foo_bar")?.title).toBe("Foo bar");
    expect(canonicalizeTitle(`foo${" ".repeat(4_000)}bar`)?.title).toBe("Foo bar");
    expect(canonicalizeTitle("Foo#Sec_tion")?.fragment).toBe("Sec tion");
  });

  it("refuses a longer one at once, and does not bound the fragment", () => {
    expect(canonicalizeTitle(`foo${" ".repeat(5_000)}bar`)).toBeNull();
    expect(canonicalizeTitle(`foo#${"x".repeat(100_000)}`)?.fragment).toHaveLength(100_000);
  });

  it("is the bound of parseWikiTitle, which every caller of a raw title reaches", () => {
    expect(parseWikiTitle(`Talk:foo${" ".repeat(4_000)}bar`)).toEqual({
      namespaceId: 1,
      base: "foo bar",
    });
    expect(parseWikiTitle(`foo${"x".repeat(5_000)}`)).toBeNull();
    // a title no parser can judge is refused to everyone but an administrator, who is let through as before
    const nobody = { rights: new Set<never>(), linkedWikiUsername: null };
    expect(checkEditPolicy(`foo${"x".repeat(5_000)}`, nobody)).toEqual({
      allowed: false,
      reason: "That page title is not valid.",
    });
  });
});
