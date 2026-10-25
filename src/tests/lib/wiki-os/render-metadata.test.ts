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
});

describe("in production with no internal URL (B3: the loopback renderer is required)", () => {
  const parsoid = jest.requireActual<typeof import("~/lib/wiki-os/adapters/mediawiki/parsoid")>(
    "~/lib/wiki-os/adapters/mediawiki/parsoid"
  );
  let fetchSpy: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.replaceProperty(process, "env", {
      ...process.env,
      NODE_ENV: "production",
      WIKIOS_MEDIAWIKI_INTERNAL_URL: "",
    });
    fetchSpy = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no request expected"));
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("a render sends no request and returns null, and says why once per process", async () => {
    await expect(parsoid.renderArticleViaMediaWiki("[[Eurth]] text", "Aurelia")).resolves.toBeNull();
    await expect(parsoid.renderArticleViaMediaWiki("[[Eurth]] text", "Aurelia")).resolves.toBeNull();

    expect(fetchSpy).not.toHaveBeenCalled();
    const named = warn.mock.calls.filter(([message]) =>
      String(message).includes("WIKIOS_MEDIAWIKI_INTERNAL_URL is not set")
    );
    expect(named).toHaveLength(1);
  });

  it("an editor preview sends no request either: it is compiled locally", async () => {
    const html = await parsoid.wikitextToHtml("'''Bold''' text", "Aurelia");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(html).toContain("Bold");
  });

  it("the render stores nothing: no empty HTML, not marked rendered, the previous view stays", async () => {
    const id = stubArticle();
    mockRender.mockImplementation(parsoid.renderArticleViaMediaWiki);

    await expect(renderArticle(id)).resolves.toEqual({ ok: false });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("outside production the render still goes to MediaWiki", async () => {
    jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: "development" });
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ parse: { text: HTML } }), { status: 200 })
    );

    await expect(parsoid.renderArticleViaMediaWiki("[[Eurth]] text", "Aurelia")).resolves.toMatchObject({
      html: HTML,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
