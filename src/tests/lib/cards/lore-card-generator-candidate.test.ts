/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factory relies on the ambient global.
//
// Cards refresh Phase 2: the generator reads a sister wiki's article (here AltHistory, through its MediaWiki API) into
// a card candidate: the lead image with the file name the licence lookup needs, the quality signals and score, and
// no rarity. A page that cannot become a card is an ArticleRejected with its reason.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findMany: async () => [] } },
  isDatabaseReadOnly: true,
}));

import { afterEach, describe, expect, it } from "@jest/globals";
import { ArticleRejected } from "~/lib/cards/lore-card-candidate";
import { wikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const CDN = "https://static.wikia.nocookie.net/althistory/images";
const BODY = "'''Aramelia''' is a nation of the Roman Survival timeline. ".repeat(14);

interface FakePage {
  original?: { source: string };
  pageimage?: string;
  images?: Array<{ title: string }>;
  wikitext?: string;
  /** A wiki with TextExtracts: the lead and its sections, which it heads as asked (`exsectionformat`). */
  sections?: { lead: string; headings: string[] };
}

/** TextExtracts' plain text: section headings as `== Heading ==` lines, unless asked for plain ones. */
function textExtract(sections: NonNullable<FakePage["sections"]>, format: string | null): string {
  const heading = (title: string) => (format === "plain" ? title : `== ${title} ==`);
  return [sections.lead, ...sections.headings.map(heading)].join("\n\n");
}

/** AltHistory answering the generator's reads: the page, its backlinks, its first editors and file URLs. */
function althistory(page: FakePage) {
  return (url: URL) => {
    const params = url.searchParams;
    if (params.get("list") === "backlinks") {
      return { query: { backlinks: [{ title: "A" }, { title: "B" }] } };
    }
    if (params.get("prop") === "imageinfo") {
      const name = (params.get("titles") ?? "").replace(/^File:/, "").replace(/ /g, "_");
      const info = [{ url: `${CDN}/1/12/${name}/revision/latest?cb=20200405180536` }];
      return { query: { pages: { 7: { title: params.get("titles"), imageinfo: info } } } };
    }
    if (params.get("prop") === "revisions") {
      const revisions = [{ user: "Kir", timestamp: "2020-01-01T00:00:00Z" }];
      return { query: { pages: { 1: { title: "Aramelia (Roman Survival)", revisions } } } };
    }
    // AltHistory has no TextExtracts: the page comes back without an `extract`, with a warning.
    return {
      warnings: { query: { "*": 'Unrecognized value for parameter "prop": extracts' } },
      query: {
        pages: {
          1: {
            title: "Aramelia (Roman Survival)",
            extract: page.sections && textExtract(page.sections, params.get("exsectionformat")),
            original: page.original,
            pageimage: page.pageimage,
            images: page.images,
            categories: [{ title: "Category:Nations" }, { title: "Category:Roman Survival" }],
            revisions: [
              {
                "*": page.wikitext ?? BODY,
                user: "Kir",
                timestamp: "2020-01-01T00:00:00Z",
              },
            ],
          },
        },
      },
    };
  };
}

let guard: FetchGuard;
/** Whether each request carried an abort signal (a timeout), in order. */
let signalled: boolean[] = [];
/** Whether each request was sent inside a turn of the caller's pace, in order. */
let sentInTurn: boolean[] = [];
let turnOpen = false;
const read = (
  page: FakePage,
  options?: Parameters<typeof wikiLoreCardGenerator.generateCard>[2]
) => {
  signalled = [];
  sentInTurn = [];
  const answer = althistory(page);
  guard = installFetchGuard((url, init) => {
    signalled.push(init?.signal instanceof AbortSignal);
    sentInTurn.push(turnOpen);
    return answer(url);
  });
  return wikiLoreCardGenerator.generateCard("Aramelia (Roman Survival)", "althistory", options);
};
afterEach(() => guard.restore());

describe("generateCard for a sister wiki", () => {
  it("reads the page into a candidate: lead image and its file, signals and score, no rarity", async () => {
    const source = `${CDN}/a/ab/Aramelia_flag_%28cropped%29.png/revision/latest?cb=20200405180536`;
    const card = await read({ original: { source }, pageimage: "Aramelia_flag_(cropped).png" });

    expect(card).toMatchObject({
      title: "Aramelia (Roman Survival)",
      artwork: source,
      imageFile: "Aramelia_flag_(cropped).png",
      wikiSource: "althistory",
      wikiArticleTitle: "Aramelia (Roman Survival)",
      signals: {
        length: BODY.length,
        referenceCount: 0,
        inboundLinks: 2,
        categoryCount: 2,
        hasInfobox: false,
        isFeatured: false,
      },
    });
    expect(card.qualityScore).toBeCloseTo((BODY.length / 1000) * 0.3 + 0.8 + 1);
    expect(card.fullExcerpt).toContain("Aramelia");
    expect(card.authorInfo).toMatchObject({ creator: "Kir" });
    expect(card).not.toHaveProperty("rarity");
    expect(guard.calls().every((url) => new URL(url).hostname === "althistory.fandom.com")).toBe(
      true
    );
  });

  it("names the file from the page image's address when the wiki gives no name", async () => {
    const source = `${CDN}/a/ab/Aramelia_flag_%28cropped%29.png/revision/latest?cb=20200405180536`;
    const card = await read({ original: { source } });
    expect(card.imageFile).toBe("Aramelia_flag_(cropped).png");
  });

  it("names no file for a page image on another host", async () => {
    const card = await read({ original: { source: "https://example.org/Aramelia.png" } });
    expect(card.artwork).toBe("https://example.org/Aramelia.png");
    expect(card.imageFile).toBeNull();
  });

  it("takes the infobox image, and its file name without the namespace", async () => {
    const wikitext = `{{Infobox country\n| image = File:Aramelia map.png\n}}\n${BODY}`;
    const card = await read({ wikitext });
    expect(card.imageFile).toBe("Aramelia map.png");
    expect(card.artwork).toBe(`${CDN}/1/12/Aramelia_map.png/revision/latest?cb=20200405180536`);
    expect(card.signals.hasInfobox).toBe(true);
  });

  it("gives every read of the article a timeout", async () => {
    const wikitext = `{{Infobox country\n| image = File:Aramelia map.png\n}}\n${BODY}`;
    await read({ wikitext });
    // The page, its image's URL, its backlinks and its first editors.
    expect(signalled).toEqual([true, true, true, true]);
  });

  it("sends every read of the article, and reads its answer, in a turn of the caller's pace", async () => {
    const wikitext = `{{Infobox country\n| image = File:Aramelia map.png\n}}\n${BODY}`;
    let turns = 0;
    const pace = async <T>(work: () => Promise<T>): Promise<T> => {
      turns++;
      turnOpen = true;
      try {
        return await work();
      } finally {
        turnOpen = false;
      }
    };
    const card = await read({ wikitext }, { pace });
    expect(sentInTurn).toEqual([true, true, true, true]);
    expect(turns).toBe(4);
    expect(card.signals.inboundLinks).toBe(2);
    expect(card.authorInfo).toMatchObject({ creator: "Kir" });
  });

  it("reads unpaced when the caller gives no pace", async () => {
    await read({});
    expect(sentInTurn).toEqual([false, false, false]);
  });

  it("takes the first article image when there is no page or infobox image, skipping icons", async () => {
    const card = await read({
      images: [{ title: "File:Aramelia flag icon.png" }, { title: "File:Aramelia coast.jpg" }],
    });
    expect(card.imageFile).toBe("Aramelia coast.jpg");
  });

  it("reads a page without an image as no artwork", async () => {
    const card = await read({});
    expect(card.artwork).toBeNull();
    expect(card.imageFile).toBeNull();
  });

  it("rejects a page without an image when one is required", async () => {
    await expect(read({}, { requireImage: true })).rejects.toEqual(
      new ArticleRejected("no-image", '"Aramelia (Roman Survival)" has no usable image.')
    );
  });

  it("cleans the excerpt from the wikitext, as IxWiki's is, when the wiki has no TextExtracts", async () => {
    const wikitext = [
      "{{Infobox country\n| name = Aramelia\n}}",
      "[[File:001 islam.gif|thumb|The faith of the half world]]",
      '<p style="text-align:justify">In this timeline the [[Ottoman Empire (Ottoman World)|Ottomans]] ' +
        "held the '''straits''' for [[Constantinople]].{{cn}}</p>",
      "== History ==",
      "=== Rise ===",
      BODY,
    ].join("\n");
    const card = await read({ wikitext });

    for (const text of [card.fullExcerpt, card.description]) {
      for (const markup of ["[[", "]]", "{{", "}}", "==", "'''", "<p", "style=", "File:", "thumb"])
        expect(text).not.toContain(markup);
      expect(text).toMatch(
        /^In this timeline the Ottomans held the straits for Constantinople\. Aramelia/
      );
    }
    expect(card.fullExcerpt.length).toBeLessThanOrEqual(2000);
    // The length gate still counts the article's text, not the cleaned excerpt
    expect(card.signals.length).toBeGreaterThan(card.fullExcerpt.length);
  });

  it("asks TextExtracts for plain section headings, so the excerpt keeps no == lines", async () => {
    const sections = {
      lead: "Aramelia is a nation of the Roman Survival timeline.",
      headings: ["History", "Rise"],
    };
    const card = await read({ sections });
    expect(card.fullExcerpt).not.toContain("==");
    expect(card.fullExcerpt).toBe(
      "Aramelia is a nation of the Roman Survival timeline.\n\nHistory\n\nRise"
    );
  });

  it("rejects a stub, unless the caller lowers the length gate", async () => {
    await expect(read({ wikitext: "'''Aramelia''' is a nation." })).rejects.toMatchObject({
      kind: "too-short",
      message: '"Aramelia (Roman Survival)" is too short (27 characters; the minimum is 600).',
    });
    guard.restore();
    const card = await read({ wikitext: "'''Aramelia''' is a nation." }, { minLength: 0 });
    expect(card.signals.length).toBe(27);
  });
});
