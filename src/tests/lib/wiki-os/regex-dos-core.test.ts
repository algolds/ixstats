/** @jest-environment node */
/**
 * The linear rewrites and ceilings of core/ and xml/ (plan F15, the regex-DoS sweep): the title ceiling, the
 * redirect target of a dump and the files a save finds in a page's text, each held against a verbatim copy of the
 * code it replaced on random small texts made of the tokens it reads, and on the real-looking pages of
 * src/tests/fixtures/wikitext. The gate that they are fast is regex-dos.test.ts.
 */
import { disagreements, fixtureTexts, randomTexts } from "../../helpers/wikitext-fuzz";
import { referencedFilenames } from "~/lib/wiki-os/core/media-references";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
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
});

// ---- core/media-references: the files a save finds in a page's text ---------------------------------------------

/** What `MediaAssetService.processContentImages` found in a text before it asked a scan for it: three expressions. */
function legacyReferencedFilenames(content: string): Set<string> {
  const foundFilenames = new Set<string>();
  const fileRegex = /\[\[(?:File|Image):([^\]|#]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(content)) !== null) {
    if (match[1]) foundFilenames.add(match[1].trim());
  }
  const infoboxParamRegex =
    /\|\s*(?:image|logo|flag|coat_of_arms|seal|map|photo)\s*=\s*([^|\n\r]+)/gi;
  while ((match = infoboxParamRegex.exec(content)) !== null) {
    const raw = match[1]?.trim();
    if (raw && !raw.startsWith("{{") && /\.(?:png|jpg|jpeg|svg|gif|webp)$/i.test(raw)) {
      foundFilenames.add(
        raw
          .replace(/^\[\[(?:File|Image):/i, "")
          .replace(/\]\].*$/, "")
          .trim()
      );
    }
  }
  const htmlImgRegex =
    /<img[^>]+(?:src=["'](?:[^"']*\/images\/[^"']*\/([^"'/?#]+))|data-file=["']([^"']+)["'])/gi;
  while ((match = htmlImgRegex.exec(content)) !== null) {
    const raw = match[1] || match[2];
    if (raw) {
      const clean = decodeURIComponent(raw).replace(/^(\d+px-)/i, "");
      foundFilenames.add(clean);
    }
  }
  return foundFilenames;
}

describe("referencedFilenames finds the files a text names, as the expressions did", () => {
  const TOKENS = [
    '<img src="/images/a/ab/Flag.png">',
    '<img data-file="X.png" src="/x/y.png">',
    '<img alt="a" src=\'/images/thumb/a/ab/N.png/300px-N.png\' width="3">',
    '<img src="/images/a/ab/200px-Z.svg.png?x=1#f">',
    '<IMG SRC="/IMAGES/z.png">',
    '<img src="/images/">',
    '<img src="/images/a/">',
    '<img src="/images/a//b.png">',
    '<img src="https://ixwiki.com/images/c/cd/Name%20one.png">',
    '<img data-file="">',
    "<img>",
    '<img src="/other/q.png">',
    '<img data-src="/images/p/pq/W.png" src="/images/p/pq/V.png">',
    "[[File:A.png|thumb]]",
    "[[Image:B c.jpg]]",
    "[[File:",
    "| image = [[File:B.png]]",
    "| flag = C.svg",
    "|logo=D.webp",
    "| map = {{x}}.png",
    "| photo = E.txt",
    "| seal =\n",
    "| coat_of_arms = F.gif|",
    " ",
    "\n",
    "text ",
    ">",
    "<",
    "|",
    '"',
    "'",
  ];
  it("on 30,000 random texts and the real pages", () => {
    const texts = [...randomTexts(TOKENS, 30_000, 131, 12), ...fixtures];
    expect(
      disagreements(
        texts,
        (t) => [...referencedFilenames(t)],
        (t) => [...legacyReferencedFilenames(t)]
      )
    ).toEqual([]);
  });
});
