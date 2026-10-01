/** @jest-environment node */
/**
 * Plan 406 E: a changed page marks every page that transcludes it stale (invalidateDependents), and the
 * `wiki-render-stale` job renders them in the background (renderStaleBatch): oldest first, two at a time,
 * and a page MediaWiki cannot render never keeps the rest of the queue waiting.
 */
import {
  invalidateDependents,
  invalidateTemplateDependents,
  renderStaleBatch,
  RENDERER_VERSION,
} from "~/lib/wiki-os/services/render-service";

const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockExecuteRaw = jest.fn();
const mockRender = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  renderArticleViaMediaWiki: async (...a: unknown[]) => {
    const html = (await mockRender(...a)) as string | null;
    return html === null
      ? null
      : {
          html,
          metadata: {
            links: null,
            templates: null,
            images: null,
            categories: null,
            displayTitle: null,
            properties: {},
          },
        };
  },
}));

const HTML = '<div class="mw-parser-output"><p>Intro.</p></div>';

/** What makes an article stale: never rendered or edited since (the marker), or an outdated bundle. */
const STALE_OR = [
  { htmlSyncedAt: null },
  { renderedView: { path: ["rendererVersion"], not: RENDERER_VERSION } },
];

let ids = 0;
const freshIds = (count: number) => Array.from({ length: count }, () => `stale-${++ids}`);

/** `findUnique` answers for the given articles; `findMany` lists them as stale. */
function staleArticles(articleIds: string[]) {
  mockFindMany.mockResolvedValue(articleIds.map((id) => ({ id })));
  mockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    title: `Title of ${where.id}`,
    source: "ixwiki",
    wikitext: `text of ${where.id}`,
    contentHtml: null,
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockRender.mockResolvedValue(HTML);
  mockExecuteRaw.mockResolvedValue(0);
  mockFindMany.mockResolvedValue([]);
});

describe("invalidateDependents", () => {
  it("marks every article that transcludes the page stale with one statement", async () => {
    mockExecuteRaw.mockResolvedValue(83);

    await expect(invalidateDependents("Template:Infobox country")).resolves.toBe(83);

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = mockExecuteRaw.mock.calls[0]!;
    const sql = (strings as string[]).join("?").replace(/\s+/g, " ");
    expect(sql).toContain('UPDATE wiki_articles SET "htmlSyncedAt" = NULL');
    expect(sql).toContain('SELECT "articleId" FROM wiki_template_links WHERE "templateTitle" = ?');
    // Only articles with a fresh view are touched: the stale ones are already waiting.
    expect(sql).toContain('"htmlSyncedAt" IS NOT NULL');
    expect(values).toEqual(["ixwiki", "Template:Infobox country"]);
  });

  it("is best effort: a failure is logged and counts as nothing marked", async () => {
    mockExecuteRaw.mockRejectedValue(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(invalidateDependents("Module:Foo")).resolves.toBe(0);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Module:Foo"), expect.any(Error));
    warn.mockRestore();
  });
});

describe("invalidateTemplateDependents", () => {
  it("invalidates for Template and Module titles, however they are spelled", async () => {
    mockExecuteRaw.mockResolvedValue(4);
    await expect(invalidateTemplateDependents("template:infobox_country")).resolves.toBe(4);
    await expect(invalidateTemplateDependents("Module:Foo")).resolves.toBe(4);
    expect(mockExecuteRaw.mock.calls[0]!.slice(1)).toEqual(["ixwiki", "Template:Infobox country"]);
    expect(mockExecuteRaw.mock.calls[1]!.slice(1)).toEqual(["ixwiki", "Module:Foo"]);
  });

  it("leaves ordinary pages alone", async () => {
    await expect(invalidateTemplateDependents("Aurora")).resolves.toBe(0);
    await expect(invalidateTemplateDependents("Talk:Template:Box")).resolves.toBe(0);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});

describe("renderStaleBatch", () => {
  it("renders the stale published articles, oldest first, and counts them", async () => {
    const [a, b, c] = freshIds(3);
    staleArticles([a!, b!, c!]);

    await expect(renderStaleBatch()).resolves.toEqual({ rendered: 3, failed: 0 });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { status: "PUBLISHED", OR: STALE_OR, wikitext: { not: "" } },
      orderBy: { updatedAt: "asc" },
      take: 20,
      select: { id: true },
    });
    expect(mockUpdateMany.mock.calls.map(([args]) => args.where.id)).toEqual([a, b, c]);
  });

  it("takes the number of articles it is given", async () => {
    staleArticles([]);

    await renderStaleBatch(5);

    expect(mockFindMany.mock.calls[0]?.[0].take).toBe(5);
  });

  it("renders nothing when nothing is stale", async () => {
    await expect(renderStaleBatch()).resolves.toEqual({ rendered: 0, failed: 0 });
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("never runs more than two renders at once, and starts them in order", async () => {
    const stale = freshIds(5);
    staleArticles(stale);
    let running = 0;
    let peak = 0;
    const started: string[] = [];
    mockRender.mockImplementation(async (_text: string, title: string) => {
      started.push(title);
      peak = Math.max(peak, ++running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return HTML;
    });

    await renderStaleBatch();

    expect(peak).toBe(2);
    expect(started).toEqual(stale.map((id) => `Title of ${id}`));
  });

  it("leaves out an article whose render failed, so the rest of the queue is not kept waiting", async () => {
    const [broken, fine] = freshIds(2);
    staleArticles([broken!, fine!]);
    mockRender.mockImplementation(async (_text: string, title: string) =>
      title === `Title of ${broken}` ? null : HTML
    );

    await expect(renderStaleBatch()).resolves.toEqual({ rendered: 1, failed: 1 });

    await renderStaleBatch();
    // (the service remembers failures for the life of the process, so other tests' articles may be listed too)
    expect(mockFindMany.mock.calls[1]?.[0].where.id.notIn).toContain(broken);
  });

  it("counts an article that saves keep overtaking as failed, and leaves it out for a while", async () => {
    const [moving] = freshIds(1);
    staleArticles([moving!]);
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(renderStaleBatch()).resolves.toEqual({ rendered: 0, failed: 1 });

    await renderStaleBatch();
    expect(mockFindMany.mock.calls[1]?.[0].where.id.notIn).toContain(moving);
  });

  it("starts no new render once its time budget is spent", async () => {
    const stale = freshIds(6);
    staleArticles(stale);
    const now = jest.spyOn(Date, "now");
    const start = 1_000_000;
    let tick = 0;
    // Every call to Date.now() moves the clock on by 20 s: the budget (45 s) is gone after two renders.
    now.mockImplementation(() => start + 20_000 * tick++);

    const result = await renderStaleBatch();

    expect(result.rendered).toBeLessThan(6);
    expect(result.rendered).toBeGreaterThan(0);
    now.mockRestore();
  });
});

describe("renderStaleBatch: which articles are stale", () => {
  interface Row {
    id: string;
    htmlSyncedAt: Date | null;
    renderedView: { rendererVersion?: string } | null;
  }
  const SYNCED = new Date("2026-09-30T10:00:00Z");

  /**
   * `where` as Postgres evaluates it for the filters the batch uses. `not` on a JSON path is
   * `(col #> path) <> value`: NULL, so no match, when the column is NULL or lacks the key.
   */
  function matches(row: Row, where: { OR: typeof STALE_OR }): boolean {
    return where.OR.some((branch) => {
      if ("htmlSyncedAt" in branch) return row.htmlSyncedAt === null;
      const version = row.renderedView?.rendererVersion;
      return version !== undefined && version !== branch.renderedView.not;
    });
  }

  it("lists never-rendered and edited-since rows, and outdated bundles, and skips current ones", async () => {
    const [stale, outdated, current, legacy, keyless] = freshIds(5);
    const rows: Row[] = [
      { id: stale!, htmlSyncedAt: null, renderedView: { rendererVersion: RENDERER_VERSION } },
      {
        id: outdated!,
        htmlSyncedAt: SYNCED,
        renderedView: { rendererVersion: "2:oldfingerprint" },
      },
      { id: current!, htmlSyncedAt: SYNCED, renderedView: { rendererVersion: RENDERER_VERSION } },
      // never rendered by this pipeline, or a bundle with no version: left as before (NULL <> x is not true)
      { id: legacy!, htmlSyncedAt: SYNCED, renderedView: null },
      { id: keyless!, htmlSyncedAt: SYNCED, renderedView: {} },
    ];
    mockFindMany.mockImplementation(async ({ where }: { where: { OR: typeof STALE_OR } }) =>
      rows.filter((row) => matches(row, where)).map(({ id }) => ({ id }))
    );
    mockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      title: `Title of ${where.id}`,
      source: "ixwiki",
      wikitext: `text of ${where.id}`,
      contentHtml: null,
    }));

    await expect(renderStaleBatch()).resolves.toEqual({ rendered: 2, failed: 0 });

    expect(mockUpdateMany.mock.calls.map(([args]) => args.where.id).sort()).toEqual(
      [stale, outdated].sort()
    );
  });

  it("asks only for published articles with text, with the same order and backoff as before", async () => {
    const [broken] = freshIds(1);
    staleArticles([broken!]);
    mockRender.mockResolvedValue(null);
    await renderStaleBatch();

    await renderStaleBatch(7);

    expect(mockFindMany.mock.calls[1]?.[0]).toMatchObject({
      where: {
        status: "PUBLISHED",
        OR: STALE_OR,
        wikitext: { not: "" },
        id: { notIn: expect.arrayContaining([broken]) },
      },
      orderBy: { updatedAt: "asc" },
      take: 7,
    });
  });
});
