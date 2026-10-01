/** @jest-environment node */
/**
 * Plan 406 D: the render stores what MediaWiki reported about the page (links, templates, images,
 * categories, display title, properties), each replaced as a set, in one transaction, after the bundle.
 */
import { Prisma } from "@prisma/client";
import { renderArticle } from "~/lib/wiki-os/services/render-service";

const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
const mockRender = jest.fn();
const mockTransaction = jest.fn();

const tx = {
  wikiArticle: { findMany: jest.fn(), update: jest.fn() },
  wikiLink: { deleteMany: jest.fn(), createMany: jest.fn() },
  wikiTemplateLink: { deleteMany: jest.fn(), createMany: jest.fn() },
  wikiImageLink: { deleteMany: jest.fn(), createMany: jest.fn() },
  wikiCategory: { upsert: jest.fn() },
  wikiCategoryMember: { deleteMany: jest.fn(), createMany: jest.fn() },
};

jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  renderArticleViaMediaWiki: (...a: unknown[]) => mockRender(...a),
}));

const HTML = '<div class="mw-parser-output"><p>Intro.</p></div>';

const metadata = (over: Record<string, unknown> = {}) => ({
  links: [],
  templates: [],
  images: [],
  categories: [],
  displayTitle: null,
  properties: {},
  ...over,
});

let ids = 0;
function stubArticle(
  wikitext = "[[Eurth]] text",
  extra: { contentHtml?: string | null; revisions?: Array<{ byteSize: number; textDeleted: boolean }> } = {}
) {
  const id = `art-${++ids}`;
  mockFindUnique.mockResolvedValue({
    title: "Aurelia",
    source: "ixwiki",
    wikitext,
    contentHtml: null,
    revisions: [],
    ...extra,
  });
  return id;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockTransaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
  tx.wikiArticle.findMany.mockResolvedValue([]);
  tx.wikiCategory.upsert.mockImplementation(async ({ where }) => ({ id: `cat-${where.slug}` }));
  for (const table of [tx.wikiLink, tx.wikiTemplateLink, tx.wikiImageLink, tx.wikiCategoryMember]) {
    table.deleteMany.mockResolvedValue({ count: 0 });
    table.createMany.mockResolvedValue({ count: 0 });
  }
});

describe("a page its last edit blanked", () => {
  it("has no links, templates, images or categories any more: the derived data of its old text is replaced by nothing", async () => {
    const id = stubArticle("", { contentHtml: "<p>Old [[Eurth]]</p>", revisions: [{ byteSize: 0, textDeleted: false }] });

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(mockRender).not.toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // each set is replaced: the old rows deleted, none created
    expect(tx.wikiLink.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.wikiTemplateLink.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.wikiImageLink.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.wikiCategoryMember.deleteMany).toHaveBeenCalledTimes(1);
    for (const table of [tx.wikiLink, tx.wikiTemplateLink, tx.wikiImageLink, tx.wikiCategoryMember]) {
      expect(table.createMany).not.toHaveBeenCalled();
    }
    expect(tx.wikiArticle.update.mock.calls[0]?.[0].data).toEqual({ displayTitle: null, pageProps: Prisma.DbNull });
  });
});

describe("renderArticle stores what MediaWiki reported", () => {
  it("replaces the links, templates (Lua modules included), images and categories in one transaction, after the bundle", async () => {
    const id = stubArticle();
    tx.wikiArticle.findMany.mockResolvedValue([{ id: "art-eurth", title: "Eurth" }]);
    mockRender.mockResolvedValue({
      html: HTML,
      metadata: metadata({
        links: [
          { ns: 0, title: "Eurth" },
          { ns: 0, title: "Nowhere" },
          { ns: 6, title: "File:A.png" },
        ],
        templates: [
          { ns: 10, title: "Template:Infobox country" },
          { ns: 828, title: "Module:Infobox" },
        ],
        images: ["Flag_of_Aurelia.svg"],
        categories: [{ name: "Countries_in_Eurth", sortKey: "Aurelia", hidden: false }],
      }),
    });

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockTransaction.mock.invocationCallOrder[0]!
    );
    expect(tx.wikiLink.createMany.mock.calls[0]?.[0].data).toEqual([
      { sourceArticleId: id, targetSlug: "eurth", targetArticleId: "art-eurth", isExternal: false },
      { sourceArticleId: id, targetSlug: "nowhere", targetArticleId: null, isExternal: false },
    ]);
    expect(tx.wikiTemplateLink.createMany.mock.calls[0]?.[0].data).toEqual([
      { articleId: id, templateTitle: "Template:Infobox country" },
      { articleId: id, templateTitle: "Module:Infobox" },
    ]);
    expect(tx.wikiImageLink.createMany.mock.calls[0]?.[0].data).toEqual([
      { articleId: id, fileName: "Flag of Aurelia.svg" },
    ]);
    expect(tx.wikiCategoryMember.createMany.mock.calls[0]?.[0].data).toEqual([
      { articleId: id, categoryId: "cat-countries_in_eurth", sortKey: "Aurelia" },
    ]);
  });

  it("is a replace-set: a category the page no longer has disappears, a link it lost is deleted", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({
      html: HTML,
      metadata: metadata({ categories: [{ name: "Kept", sortKey: null, hidden: false }] }),
    });

    await renderArticle(id);

    // Every membership of the article is deleted, then only the reported ones are written back.
    expect(tx.wikiCategoryMember.deleteMany).toHaveBeenCalledWith({ where: { articleId: id } });
    expect(tx.wikiCategoryMember.createMany.mock.calls[0]?.[0].data).toEqual([
      { articleId: id, categoryId: "cat-kept", sortKey: null },
    ]);
    expect(tx.wikiLink.deleteMany).toHaveBeenCalledWith({ where: { sourceArticleId: id } });
    expect(tx.wikiLink.createMany).not.toHaveBeenCalled();
  });

  it("clears every set when the page now reports none", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({ html: HTML, metadata: metadata() });

    await renderArticle(id);

    expect(tx.wikiCategoryMember.deleteMany).toHaveBeenCalledWith({ where: { articleId: id } });
    expect(tx.wikiTemplateLink.deleteMany).toHaveBeenCalledWith({ where: { articleId: id } });
    expect(tx.wikiImageLink.deleteMany).toHaveBeenCalledWith({ where: { articleId: id } });
    expect(tx.wikiLink.deleteMany).toHaveBeenCalledWith({ where: { sourceArticleId: id } });
  });

  it("flags a hidden category on the category itself, and creates a category it has not seen", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({
      html: HTML,
      metadata: metadata({
        categories: [
          { name: "Pages_with_script_errors", sortKey: null, hidden: true },
          { name: "Countries", sortKey: null, hidden: false },
        ],
      }),
    });

    await renderArticle(id);

    expect(tx.wikiCategory.upsert).toHaveBeenCalledWith({
      where: { slug: "pages_with_script_errors" },
      create: { slug: "pages_with_script_errors", name: "Pages with script errors", hidden: true },
      update: { hidden: true },
      select: { id: true },
    });
    expect(tx.wikiCategory.upsert.mock.calls[1]?.[0].create).toMatchObject({ hidden: false });
  });

  it("keeps the sort key a category was given, and a category with a belfast-like name (no substring filter)", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({
      html: HTML,
      metadata: metadata({
        categories: [
          { name: "Belfast", sortKey: "Belfast, city", hidden: false },
          { name: "Finland", sortKey: null, hidden: false },
        ],
      }),
    });

    await renderArticle(id);

    expect(tx.wikiCategoryMember.createMany.mock.calls[0]?.[0].data).toEqual([
      { articleId: id, categoryId: "cat-belfast", sortKey: "Belfast, city" },
      { articleId: id, categoryId: "cat-finland", sortKey: null },
    ]);
  });

  it("stores the display title (sanitized) and only the page properties worth keeping", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({
      html: HTML,
      metadata: metadata({
        displayTitle: "<i>Aurelia</i><script>alert(1)</script>",
        properties: {
          defaultsort: "Aurelia",
          notoc: "",
          page_image_free: "Flag.svg",
          wikibase_item: "Q42",
          displaytitle: "<i>Aurelia</i>",
        },
      }),
    });

    await renderArticle(id);

    const data = tx.wikiArticle.update.mock.calls[0]?.[0].data;
    expect(data.displayTitle).toContain("<i>Aurelia</i>");
    expect(data.displayTitle).not.toContain("script");
    expect(data.pageProps).toEqual({
      defaultsort: "Aurelia",
      notoc: "",
      page_image_free: "Flag.svg",
    });
  });

  it("stores no display title and no properties for an ordinary page", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({ html: HTML, metadata: metadata() });

    await renderArticle(id);

    expect(tx.wikiArticle.update.mock.calls[0]?.[0].data).toEqual({
      displayTitle: null,
      pageProps: Prisma.DbNull,
    });
  });

  it("leaves alone a set the response did not carry in a readable shape", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({
      html: HTML,
      metadata: metadata({
        links: null,
        templates: null,
        images: null,
        categories: [{ name: "Only", sortKey: null, hidden: false }],
      }),
    });

    await renderArticle(id);

    expect(tx.wikiLink.deleteMany).not.toHaveBeenCalled();
    expect(tx.wikiTemplateLink.deleteMany).not.toHaveBeenCalled();
    expect(tx.wikiImageLink.deleteMany).not.toHaveBeenCalled();
    expect(tx.wikiCategoryMember.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("stores nothing when the response reported none of the four sets", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({
      html: HTML,
      metadata: metadata({ links: null, templates: null, images: null, categories: null }),
    });

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("does not store the metadata of a render a save overtook", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({ html: HTML, metadata: metadata() });
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const result = await renderArticle(id);

    expect(result).toEqual({ ok: false, superseded: true });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("does not lose the render when storing the metadata fails: the page is rendered, the failure logged", async () => {
    const id = stubArticle();
    mockRender.mockResolvedValue({ html: HTML, metadata: metadata() });
    mockTransaction.mockRejectedValue(new Error("deadlock detected"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Aurelia"), expect.any(Error));
    warn.mockRestore();
  });

  it("stores no metadata for an HTML-only row (nothing was rendered)", async () => {
    const id = `art-${++ids}`;
    mockFindUnique.mockResolvedValue({
      title: "Stub",
      source: "ixwiki",
      wikitext: "",
      contentHtml: HTML,
      revisions: [], // no revision: the HTML is all it has
    });

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(mockRender).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
