/** @jest-environment node */
/**
 * Plan 403 Step 4: link targets resolve by canonical title, and links to File/Category/Special/Media
 * are not article links whatever their case or leading colon.
 */
import { LinkGraphService } from "~/lib/wiki-os/core/link-graph-service";

const mockFindMany = jest.fn();
const mockDeleteMany = jest.fn();
const mockCreateMany = jest.fn();

jest.mock("~/server/db", () => {
  const tx = {
    wikiLink: {
      deleteMany: (...a: unknown[]) => mockDeleteMany(...a),
      createMany: (...a: unknown[]) => mockCreateMany(...a),
    },
  };
  return {
    db: {
      $transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
      wikiArticle: { findMany: (...a: unknown[]) => mockFindMany(...a) },
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteMany.mockResolvedValue({ count: 0 });
  mockCreateMany.mockResolvedValue({ count: 0 });
});

describe("LinkGraphService.extractLinks", () => {
  it("records canonical targets and skips File, Category, Special and Media links", () => {
    const links = LinkGraphService.extractLinks(
      "[[nato]] [[file:x.png]] [[:Category:Y]] [[Image:z.png]] [[Media:a.ogg]] [[special:random]] [[Foo bar|z]]"
    );

    expect(links.map((l) => [l.targetTitle, l.targetSlug])).toEqual([
      ["Nato", "nato"],
      ["Foo bar", "foo_bar"],
    ]);
    expect(links[1]?.anchorText).toBe("z");
  });

  it("keeps links to other namespaces, with their canonical prefix", () => {
    const links = LinkGraphService.extractLinks("[[template:infobox country]] [[user talk:jane]]");

    expect(links.map((l) => l.targetTitle)).toEqual(["Template:Infobox country", "User talk:Jane"]);
  });

  it("drops a leading colon and decodes percent-escapes in HTML hrefs", () => {
    const links = LinkGraphService.extractLinks(
      "[[:Foo]]",
      '<a href="/wiki/Caf%C3%A9_au_lait">x</a><a href="/wiki/File:Banner.png">f</a>'
    );

    expect(links.map((l) => l.targetTitle)).toEqual(["Foo", "Café au lait"]);
  });

  it("gives another wiki's links no IxWiki namespaces, but still skips File and Category", () => {
    const links = LinkGraphService.extractLinks(
      "[[project:foo]] [[File:x.png]] [[:category:Y]] [[Bar]]",
      undefined,
      "iiwiki"
    );

    expect(links.map((l) => l.targetTitle)).toEqual(["Project:foo", "Bar"]);
  });

  it("does not throw on a title with a stray percent sign", () => {
    expect(() =>
      LinkGraphService.extractLinks("[[100% Pure]]", '<a href="/wiki/100%_Pure">x</a>')
    ).not.toThrow();
  });
});

describe("LinkGraphService.syncArticleLinks", () => {
  it("resolves targetArticleId against canonical titles", async () => {
    mockFindMany.mockResolvedValue([{ id: "id-nato", title: "Nato" }]);

    const count = await LinkGraphService.syncArticleLinks(
      "src-1",
      "[[nato]] [[file:x.png]] [[:Category:Y]] [[Foo bar|z]]"
    );

    expect(count).toBe(2);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { source: "ixwiki", title: { in: ["Nato", "Foo bar"] } },
      select: { id: true, title: true },
    });
    const { data } = mockCreateMany.mock.calls[0]?.[0] ?? {};
    expect(data).toEqual([
      expect.objectContaining({
        sourceArticleId: "src-1",
        targetSlug: "nato",
        targetArticleId: "id-nato",
      }),
      expect.objectContaining({ targetSlug: "foo_bar", targetArticleId: null }),
    ]);
  });

  it("leaves a link to NATO unresolved when only Nato exists", async () => {
    mockFindMany.mockResolvedValue([{ id: "id-nato", title: "Nato" }]);

    await LinkGraphService.syncArticleLinks("src-1", "[[NATO]]");

    const { data } = mockCreateMany.mock.calls[0]?.[0] ?? {};
    expect(data).toEqual([expect.objectContaining({ targetSlug: "nato", targetArticleId: null })]);
  });

  it("queries nothing when the article has no article links", async () => {
    await LinkGraphService.syncArticleLinks("src-1", "[[File:x.png]] plain text");

    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { sourceArticleId: "src-1" } });
  });
});
