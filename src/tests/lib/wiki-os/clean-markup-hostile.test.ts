import {
  CLEAN_MARKUP_CEILING,
  cleanWikiMarkup,
  cleanWikitextExcerpt,
  stripWikitextFiles,
  unpackInternalLinks,
} from "~/lib/wiki-os/transformers/wikitext-parser";

const legacyUnpack = (text: string): string =>
  text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");

describe("unpackInternalLinks", () => {
  it("unpacks piped and plain links", () => {
    expect(unpackInternalLinks("See [[Treaty of Oakhaven|the treaty]] and [[Vesper]].")).toBe(
      "See the treaty and Vesper."
    );
    expect(unpackInternalLinks("[[A|b|c]] [[|x]] [[a|]] [[a]]")).toBe(
      legacyUnpack("[[A|b|c]] [[|x]] [[a|]] [[a]]")
    );
  });

  it("leaves what is not a link alone", () => {
    for (const text of [
      "[[",
      "[[]]",
      "[[a]",
      "[[a] ]",
      "a]]",
      "[[a\n]]b",
      "[ [a]]",
      "[[a]]]",
      "]]]]",
      "[[[a]]]",
    ]) {
      expect(unpackInternalLinks(text)).toBe(legacyUnpack(text));
    }
  });

  it("answers what the regular expression answered, on 30,000 random small texts", () => {
    const pieces = [
      "[[",
      "]]",
      "[",
      "]",
      "|",
      "a",
      "b c",
      " ",
      "\n",
      "[[a|b]]",
      "[[a]]",
      "||",
      "x|",
      "|y",
    ];
    let state = 406;
    const next = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const disagreements: string[] = [];
    for (let i = 0; i < 30_000; i++) {
      const length = 1 + Math.floor(next() * 12);
      const text = Array.from({ length }, () => pieces[Math.floor(next() * pieces.length)]).join(
        ""
      );
      if (unpackInternalLinks(text) !== legacyUnpack(text)) disagreements.push(text);
    }
    expect(disagreements.slice(0, 5)).toEqual([]);
  });
});

describe("cleanWikiMarkup on hostile text", () => {
  // Not linear: bounded by the ceiling (about 0.2 s for the worst family at 20,000 characters on a busy machine).
  it("reads no more than the ceiling of a text for an excerpt, and all of it for a whole page", () => {
    expect(CLEAN_MARKUP_CEILING).toBe(20_000);
    const lead = "The lead paragraph. ";
    const text = lead + "x ".repeat(100_000) + " END";
    const excerpt = cleanWikiMarkup(text, 1_000_000);
    expect(excerpt).toBe((lead + "x ".repeat(100_000)).slice(0, CLEAN_MARKUP_CEILING).trim());
    expect(excerpt).not.toContain("END");
    expect(cleanWikiMarkup(text).endsWith(" END")).toBe(true);
  });

  it("leaves a text within the ceiling, and an excerpt of a long page, as they were", () => {
    expect(cleanWikiMarkup("The [[Treaty|treaty]] was '''signed'''.")).toBe(
      "The treaty was signed."
    );
    expect(cleanWikitextExcerpt("Lead text. " + "More. ".repeat(50_000), 40)).toBe(
      "Lead text. More. More. More. More. More.…"
    );
  });
});

describe("stripWikitextFiles on hostile text", () => {
  it("strips closed file links and keeps the rest, nested links included", () => {
    expect(
      stripWikitextFiles(
        "a [[File:A.png|thumb|Flag of [[Urcea]]]] b [[Image:B.png]] c [[Media:C.ogg]]"
      )
    ).toBe("a  b  c ");
  });
});
