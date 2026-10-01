/** @jest-environment node */
/**
 * Plan 403 Step 4 + plan 406: the link graph is what the render reported. Link targets resolve by
 * canonical title, links to File/Category/Special/Media are not article links whatever their case or
 * leading colon, and every `replace*` swaps the article's whole set inside the transaction it is given.
 */
import { LinkGraphService } from "~/lib/wiki-os/core/link-graph-service";

const tx = {
  wikiArticle: { findMany: jest.fn() },
  wikiLink: { deleteMany: jest.fn(), createMany: jest.fn() },
  wikiTemplateLink: { deleteMany: jest.fn(), createMany: jest.fn() },
  wikiImageLink: { deleteMany: jest.fn(), createMany: jest.fn() },
};
const transaction = tx as never;

jest.mock("~/server/db", () => ({ db: {} }));

const titles = (...list: string[]) => list.map((title) => ({ title }));
const linkRows = (): Array<Record<string, unknown>> => tx.wikiLink.createMany.mock.calls[0]?.[0].data ?? [];

beforeEach(() => {
  jest.clearAllMocks();
  tx.wikiArticle.findMany.mockResolvedValue([]);
  for (const table of [tx.wikiLink, tx.wikiTemplateLink, tx.wikiImageLink]) {
    table.deleteMany.mockResolvedValue({ count: 0 });
    table.createMany.mockResolvedValue({ count: 0 });
  }
});

describe("LinkGraphService.replaceLinks", () => {
  it("records canonical targets, resolves targetArticleId against canonical titles and skips File, Category, Special and Media links", async () => {
    tx.wikiArticle.findMany.mockResolvedValue([{ id: "id-nato", title: "Nato" }]);

    const count = await LinkGraphService.replaceLinks(
      transaction,
      "src-1",
      "ixwiki",
      titles("nato", "file:x.png", "Category:Y", "Image:z.png", "Media:a.ogg", "special:random", "Foo bar")
    );

    expect(count).toBe(2);
    expect(tx.wikiArticle.findMany).toHaveBeenCalledWith({
      where: { source: "ixwiki", status: "PUBLISHED", title: { in: ["Nato", "Foo bar"] } },
      select: { id: true, title: true },
      take: 2,
    });
    expect(linkRows()).toEqual([
      { sourceArticleId: "src-1", targetSlug: "nato", targetArticleId: "id-nato", isExternal: false },
      { sourceArticleId: "src-1", targetSlug: "foo_bar", targetArticleId: null, isExternal: false },
    ]);
  });

  it("replaces the whole set: the old links go first, in the same transaction", async () => {
    await LinkGraphService.replaceLinks(transaction, "src-1", "ixwiki", titles("Foo"));

    expect(tx.wikiLink.deleteMany).toHaveBeenCalledWith({ where: { sourceArticleId: "src-1" } });
    expect(tx.wikiLink.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.wikiLink.createMany.mock.invocationCallOrder[0]!
    );
  });

  it("keeps links to other namespaces, with their canonical prefix, once each", async () => {
    await LinkGraphService.replaceLinks(
      transaction,
      "src-1",
      "ixwiki",
      titles("template:infobox country", "Template:Infobox country", "user talk:jane")
    );

    expect(linkRows().map((row) => row.targetSlug)).toEqual([
      "template:infobox_country",
      "user_talk:jane",
    ]);
  });

  it("leaves a link to NATO unresolved when only Nato exists (titles are case-sensitive after their first letter)", async () => {
    tx.wikiArticle.findMany.mockResolvedValue([{ id: "id-nato", title: "Nato" }]);

    await LinkGraphService.replaceLinks(transaction, "src-1", "ixwiki", titles("NATO"));

    expect(linkRows()).toEqual([expect.objectContaining({ targetSlug: "nato", targetArticleId: null })]);
  });

  it("gives another wiki's links no IxWiki namespaces, but still skips File and Category", async () => {
    await LinkGraphService.replaceLinks(
      transaction,
      "src-1",
      "iiwiki",
      titles("project:foo", "File:x.png", "category:Y", "Bar")
    );

    expect(linkRows().map((row) => row.targetSlug)).toEqual(["project:foo", "bar"]);
  });

  it("queries nothing but the delete when the render reports no article links", async () => {
    const count = await LinkGraphService.replaceLinks(transaction, "src-1", "ixwiki", titles("File:x.png"));

    expect(count).toBe(0);
    expect(tx.wikiArticle.findMany).not.toHaveBeenCalled();
    expect(tx.wikiLink.createMany).not.toHaveBeenCalled();
    expect(tx.wikiLink.deleteMany).toHaveBeenCalledWith({ where: { sourceArticleId: "src-1" } });
  });

  it("does not throw on a title with a stray percent sign, and drops one MediaWiki would refuse", async () => {
    await expect(
      LinkGraphService.replaceLinks(transaction, "src-1", "ixwiki", titles("100% Pure", "100%_Pure", "100%41"))
    ).resolves.toBe(1);
  });

  it("writes a very large set in batches that stay inside PostgreSQL's parameter limit", async () => {
    const many = Array.from({ length: 5_000 }, (_, i) => ({ title: `Page ${i}` }));

    const count = await LinkGraphService.replaceLinks(transaction, "src-1", "ixwiki", many);

    expect(count).toBe(5_000);
    expect(tx.wikiLink.createMany.mock.calls.map(([args]) => args.data.length)).toEqual([2_000, 2_000, 1_000]);
    expect(tx.wikiArticle.findMany).toHaveBeenCalledTimes(3);
  });
});

describe("LinkGraphService.replaceTemplateLinks", () => {
  it("replaces what the article transcludes: canonical titles, Lua modules included, each once", async () => {
    const count = await LinkGraphService.replaceTemplateLinks(transaction, "a1", [
      { title: "template:infobox country" },
      { title: "Template:Infobox country" },
      { title: "Module:Infobox/Utils" },
      { title: "Some page" },
    ]);

    expect(count).toBe(3);
    expect(tx.wikiTemplateLink.deleteMany).toHaveBeenCalledWith({ where: { articleId: "a1" } });
    expect(tx.wikiTemplateLink.createMany).toHaveBeenCalledWith({
      data: [
        { articleId: "a1", templateTitle: "Template:Infobox country" },
        { articleId: "a1", templateTitle: "Module:Infobox/Utils" },
        { articleId: "a1", templateTitle: "Some page" },
      ],
      skipDuplicates: true,
    });
  });

  it("clears the set when the page transcludes nothing any more", async () => {
    await LinkGraphService.replaceTemplateLinks(transaction, "a1", []);

    expect(tx.wikiTemplateLink.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.wikiTemplateLink.createMany).not.toHaveBeenCalled();
  });
});

describe("LinkGraphService.replaceImageLinks", () => {
  it("replaces the files the article uses: names without the prefix, spaces not underscores, each once", async () => {
    const count = await LinkGraphService.replaceImageLinks(transaction, "a1", [
      "Flag_of_Eurth.svg",
      "Flag of Eurth.svg",
      "map.png",
    ]);

    expect(count).toBe(2);
    expect(tx.wikiImageLink.deleteMany).toHaveBeenCalledWith({ where: { articleId: "a1" } });
    expect(tx.wikiImageLink.createMany).toHaveBeenCalledWith({
      data: [
        { articleId: "a1", fileName: "Flag of Eurth.svg" },
        { articleId: "a1", fileName: "Map.png" },
      ],
      skipDuplicates: true,
    });
  });
});
