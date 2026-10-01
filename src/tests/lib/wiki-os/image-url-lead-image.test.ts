/** @jest-environment node */
/**
 * Plan 406 follow-up: `extractLeadImageFromWikitext` runs on MediaWiki text in the inbound sync, so it
 * is linear. It answers exactly what the regular-expression version it replaces answered (checked below
 * against a verbatim copy of that version on thousands of random small texts), and it finishes hostile
 * 100,000-opener inputs in well under 100 ms.
 */
import {
  extractLeadImageFromWikitext,
  getImageUrl,
  isNoticeOrUtilityIcon,
} from "~/lib/wiki-os/transformers/image-url";

/** The implementation this one replaced, unchanged: the oracle for small inputs. */
function legacyExtractLeadImageFromWikitext(wikitext: string): string | null {
  if (!wikitext) return null;
  const infoboxFieldMatch = wikitext.match(
    /\|\s*(?:image|logo|company_logo|flag|image_flag|coat_of_arms|image_coat|seal|image_seal|map|image_map|photo|image_photo|portrait|image_portrait|album_cover|cover|poster|emblem|badge|insignia|picture|header_image|leader_image|flag_image|symbol)\s*=\s*([^|\n}]+)/i
  );
  if (infoboxFieldMatch && infoboxFieldMatch[1]) {
    const rawFile = infoboxFieldMatch[1]
      .replace(/\[\[(?:File|Image):/gi, "")
      .replace(/\]\]/g, "")
      .split(/[|\]}\n]/)[0]!
      .replace(/^(?:File|Image|file|image):/i, "")
      .trim();
    if (rawFile && !isNoticeOrUtilityIcon(rawFile)) return getImageUrl(rawFile);
  }
  const cleanWikitext = wikitext.replace(
    /^\{\{(?:Underconstruction|under_construction|WIP|work_in_progress|Stub|Cleanup|Ambox|Notice|Disambig|About|Short description)\b[\s\S]*?\}\}/gim,
    ""
  );
  const fileRegex = /\[\[(?:File|Image):([^|\]\n]+)[^\]]*\]\]/gi;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(cleanWikitext)) !== null) {
    const rawFile = match[1]?.trim();
    if (rawFile && !isNoticeOrUtilityIcon(rawFile)) return getImageUrl(rawFile);
  }
  return null;
}

const url = (file: string) => getImageUrl(file);

describe("extractLeadImageFromWikitext", () => {
  it("takes the first infobox picture parameter, whatever its name", () => {
    expect(
      extractLeadImageFromWikitext(
        "{{Infobox country\n| name = Eurth\n| flag = Flag of Eurth.svg\n}}"
      )
    ).toBe(url("Flag of Eurth.svg"));
    expect(
      extractLeadImageFromWikitext("{{Infobox company\n|logo=Acme logo.png\n|image=Other.jpg}}")
    ).toBe(url("Acme logo.png"));
    for (const name of [
      "image",
      "company_logo",
      "coat_of_arms",
      "image_map",
      "album_cover",
      "symbol",
      "LOGO",
    ]) {
      expect(extractLeadImageFromWikitext(`{{Infobox\n| ${name} = A.png\n}}`)).toBe(url("A.png"));
    }
  });

  it("reads [[File:]] syntax and a File: prefix inside the parameter, up to the next delimiter", () => {
    expect(extractLeadImageFromWikitext("| image = [[File:Crest.png|200px]]")).toBe(
      url("Crest.png")
    );
    expect(extractLeadImageFromWikitext("| image = File:Crest.png | caption = x")).toBe(
      url("Crest.png")
    );
    expect(extractLeadImageFromWikitext("| image = Crest.png }}")).toBe(url("Crest.png"));
  });

  it("prefers the infobox parameter to a file in the body", () => {
    expect(extractLeadImageFromWikitext("[[File:Body.png|thumb]] {{Infobox|image=Box.png}}")).toBe(
      url("Box.png")
    );
  });

  it("falls back to the first content file when the parameter is blank or a notice icon", () => {
    expect(extractLeadImageFromWikitext("| image = \n| x = 1\n[[File:Body.png|thumb|cap]]")).toBe(
      url("Body.png")
    );
    expect(extractLeadImageFromWikitext("| image = Ambox warning.png\n[[File:Body.png]]")).toBe(
      url("Body.png")
    );
  });

  it("skips notice templates at the top of a page, and notice icons among the files", () => {
    expect(
      extractLeadImageFromWikitext("{{Stub|[[File:Stub icon.png]]}}\n[[Image:Real.jpg|thumb]]")
    ).toBe(url("Real.jpg"));
    expect(extractLeadImageFromWikitext("[[File:Ambox notice.png]] [[File:Real.jpg]]")).toBe(
      url("Real.jpg")
    );
  });

  it("finds the first usable [[File:]] or [[Image:]] in any case", () => {
    expect(extractLeadImageFromWikitext("text [[FILE:A.png]] [[Image:B.png]]")).toBe(url("A.png"));
    expect(extractLeadImageFromWikitext("text [[image:B.png|left]]")).toBe(url("B.png"));
  });

  it("is null for no picture, for blank input and for what is not text", () => {
    expect(extractLeadImageFromWikitext("plain text with [[links]] and {{templates}}")).toBeNull();
    expect(extractLeadImageFromWikitext("")).toBeNull();
    expect(extractLeadImageFromWikitext(null)).toBeNull();
    expect(extractLeadImageFromWikitext(undefined)).toBeNull();
  });

  it("does not take a file name longer than MediaWiki allows for one", () => {
    expect(extractLeadImageFromWikitext(`| image = ${"a".repeat(1000)}.png`)).toBeNull();
    expect(extractLeadImageFromWikitext(`[[File:${"a".repeat(1000)}.png]]`)).toBeNull();
  });
});

describe("it answers what the regular-expression version answered", () => {
  const PIECES = [
    "[[",
    "]]",
    "[",
    "]",
    "|",
    "}",
    "{{",
    "}}",
    "{{Stub",
    "{{stub",
    "{{Notice",
    "{{Short description",
    "{{About",
    "File:",
    "Image:",
    "file:",
    "IMAGE:",
    "|image",
    "| image =",
    "|logo=",
    "| FLAG = ",
    "|map",
    "=",
    " ",
    "  ",
    "\n",
    "\r",
    "\t",
    " ",
    "a",
    "Flag.svg",
    "x.png",
    "A b.jpg",
    "ambox.png",
    "icon.png",
    "Real.jpg",
    "thumb",
    "200px",
    "stub",
    "_",
    "{",
    "}x",
  ];

  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  it("on 20,000 random small texts built from markup pieces", () => {
    const next = random(406);
    const disagreements: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      const length = 1 + Math.floor(next() * 14);
      const text = Array.from({ length }, () => PIECES[Math.floor(next() * PIECES.length)]).join(
        ""
      );
      const expected = legacyExtractLeadImageFromWikitext(text);
      const actual = extractLeadImageFromWikitext(text);
      if (actual !== expected) disagreements.push(JSON.stringify({ text, expected, actual }));
    }
    expect(disagreements.slice(0, 5)).toEqual([]);
  });

  it("on random texts with a picture in them", () => {
    const next = random(2026);
    const disagreements: string[] = [];
    const picture = [
      "| image = Real.jpg",
      "[[File:Real.jpg|x]]",
      "[[Image:Real.jpg]]",
      "|logo=Real.jpg}}",
    ];
    for (let i = 0; i < 20_000; i++) {
      const length = 1 + Math.floor(next() * 8);
      const parts = Array.from({ length }, () => PIECES[Math.floor(next() * PIECES.length)]);
      parts.splice(
        Math.floor(next() * parts.length),
        0,
        picture[Math.floor(next() * picture.length)]!
      );
      const text = parts.join("");
      const expected = legacyExtractLeadImageFromWikitext(text);
      const actual = extractLeadImageFromWikitext(text);
      if (actual !== expected) disagreements.push(JSON.stringify({ text, expected, actual }));
    }
    expect(disagreements.slice(0, 5)).toEqual([]);
  });
});

describe("hostile input is read in linear time", () => {
  const BUDGET_MS = 100;

  function ms(text: string): number {
    const started = performance.now();
    extractLeadImageFromWikitext(text);
    return performance.now() - started;
  }

  const HOSTILE: Array<[string, string]> = [
    ["100,000 unclosed [[File: openers", "[[File:".repeat(100_000)],
    ["100,000 unclosed [[Image: openers", "[[Image:".repeat(100_000)],
    ["100,000 unclosed openers with a closing ] at the very end", "[[File:a".repeat(100_000) + "]"],
    ["100,000 openers whose ] is not followed by another", "[[File:a]".repeat(100_000)],
    ["100,000 piped openers", "[[File:a|".repeat(100_000)],
    ["a 200,000 character file name", "[[File:" + "a".repeat(200_000)],
    ["a 200,000 character file name in an infobox", "| image = " + "a".repeat(200_000)],
    ["100,000 bars", "|".repeat(200_000)],
    ["100,000 blank image parameters", "|image=\n".repeat(50_000)],
    ["100,000 image names without a value", "|image".repeat(30_000)],
    ["200,000 blanks after a bar", "|" + " ".repeat(200_000)],
    ["100,000 bars each followed by blanks", "| ".repeat(100_000)],
    ["100,000 notice templates that never close", "{{Stub\n".repeat(30_000)],
    ["100,000 notice templates, one close at the end", "{{Stub\n".repeat(30_000) + "}}"],
    ["200,000 open braces", "{{".repeat(100_000)],
    ["200,000 square brackets", "[".repeat(200_000)],
    ["200,000 closing brackets", "]".repeat(200_000)],
  ];

  it.each(HOSTILE)("%s", (_name, text) => {
    // Twice: the first call may be the one that warms the engine up.
    ms(text);
    expect(ms(text)).toBeLessThan(BUDGET_MS);
  });

  it("answers what the old version answered for a link that swallows the openers before it", () => {
    // The first opener runs to the first `]]` there is: the link of the real picture.
    const text = "[[File:a|x".repeat(10) + "\n[[File:Real.jpg]]";
    expect(extractLeadImageFromWikitext(text)).toBe(legacyExtractLeadImageFromWikitext(text));
    expect(extractLeadImageFromWikitext(text)).toBe(url("A"));
    expect(ms("[[File:a|x".repeat(100_000) + "\n[[File:Real.jpg]]")).toBeLessThan(BUDGET_MS);
  });
});
