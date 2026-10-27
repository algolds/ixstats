/** @jest-environment node */
/**
 * The passport's wiki activity feed (identity.feed.ts): every item links to the WikiOS reader by its title, the same
 * path `wikiReaderPath` builds (underscores, encoded), with no base path: the feed's `<Link>` adds it.
 */
import { buildWikiActivityFeed } from "~/server/modules/identity/identity.feed";
import { wikiReaderPath } from "~/lib/wiki-os/config";

const at = new Date("2026-10-20T10:00:00.000Z");

describe("buildWikiActivityFeed links", () => {
  it("a revision's url is wikiReaderPath(title)", () => {
    const [item] = buildWikiActivityFeed(
      [
        {
          id: "r1",
          summary: null,
          minor: false,
          parked: false,
          createdAt: at,
          article: { title: "Holy See", slug: "holy-see" },
        },
      ],
      [],
      [],
      [],
      null
    );
    expect(item?.url).toBe(wikiReaderPath("Holy See"));
    expect(item?.url).toBe("/wiki/Holy_See");
  });

  it("contributions, margin discussions and laurels link by their title the same way", () => {
    const feed = buildWikiActivityFeed(
      [],
      [
        {
          rev_id: 7,
          page_title: "Kingdom of Ćaphiria",
          rev_timestamp: "2026-10-19T10:00:00.000Z",
          rev_len: 10,
          rev_comment: "",
          rev_minor_edit: 0,
          is_new: false,
        },
      ],
      [
        {
          id: "c1",
          content: "A note",
          createdAt: new Date("2026-10-18T10:00:00.000Z"),
          thread: { title: "Margin", articleTitle: "Holy See" },
        },
        {
          id: "c2",
          content: "No page",
          createdAt: new Date("2026-10-17T10:00:00.000Z"),
          thread: { title: "Margin", articleTitle: null },
        },
      ],
      [
        {
          id: "l1",
          date: "2026-10-16T10:00:00.000Z",
          type: "daily",
          winnerUser: "Alpha",
          winnerPage: "Port of Ixnay",
          winnerScore: 3,
          runnerUpPage: null,
          runnerUpScore: null,
        },
      ],
      "Alpha"
    );
    expect(feed.map((item) => item.url)).toEqual([
      "/wiki/Kingdom_of_%C4%86aphiria",
      wikiReaderPath("Holy See"),
      "/wiki",
      wikiReaderPath("Port of Ixnay"),
    ]);
    expect(feed[1]?.url).toBe("/wiki/Holy_See");
    expect(feed[3]?.url).toBe("/wiki/Port_of_Ixnay");
  });
});
