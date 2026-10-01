/** @jest-environment node */
/**
 * Plan 406 E: a changed page marks every page that transcludes it stale (invalidateDependents), and the
 * `wiki-render-stale` job renders them in the background (renderStaleBatch): oldest first, two at a time,
 * and a page MediaWiki cannot render never keeps the rest of the queue waiting. A bundle another renderer
 * version built is also stale, but is found once per process (a scan), not by the per-minute query.
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

let ids = 0;
const freshIds = (count: number) => Array.from({ length: count }, () => `stale-${++ids}`);

interface FindManyArgs {
  where: { htmlSyncedAt?: null; id?: { notIn?: string[]; in?: string[] } };
  take?: number;
}

/** The articles the fake database holds as stale: never rendered or edited since, and outdated bundles. */
interface StaleArticles {
  unsynced: string[];
  outdated: string[];
}

/**
 * `findMany` answers the three queries the batch asks (the per-minute unsynced one, the one scan for
 * outdated bundles, and the check of a few ids before they are rendered); a stored render brings the
 * article up to date, so it is neither unsynced nor outdated any more. `findUnique` answers the render.
 */
function database(stale: StaleArticles) {
  mockFindMany.mockImplementation(async ({ where, take }: FindManyArgs) => {
    const list = (articleIds: string[]) => articleIds.slice(0, take).map((id) => ({ id }));
    if (where.htmlSyncedAt === null) {
      const leftOut = new Set(where.id?.notIn);
      return list(stale.unsynced.filter((id) => !leftOut.has(id)));
    }
    const asked = where.id?.in;
    return list(stale.outdated.filter((id) => !asked || asked.includes(id)));
  });
  mockUpdateMany.mockImplementation(async ({ where }: { where: { id: string } }) => {
    stale.unsynced = stale.unsynced.filter((id) => id !== where.id);
    stale.outdated = stale.outdated.filter((id) => id !== where.id);
    return { count: 1 };
  });
  mockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    title: `Title of ${where.id}`,
    source: "ixwiki",
    wikitext: `text of ${where.id}`,
    contentHtml: null,
  }));
}

/** `findUnique` answers for the given articles; `findMany` lists them as unsynced. */
const staleArticles = (articleIds: string[]) => database({ unsynced: articleIds, outdated: [] });

const queries = () => mockFindMany.mock.calls.map(([args]) => args as FindManyArgs);
const unsyncedQueries = () => queries().filter((query) => query.where.htmlSyncedAt === null);
const checkQueries = () => queries().filter((query) => query.where.id?.in !== undefined);
const scanQueries = () =>
  queries().filter((query) => query.where.htmlSyncedAt === undefined && !query.where.id);

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
      where: { status: "PUBLISHED", htmlSyncedAt: null, wikitext: { not: "" } },
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
    expect(unsyncedQueries()[1]?.where.id?.notIn).toContain(broken);
  });

  it("counts an article that saves keep overtaking as failed, and leaves it out for a while", async () => {
    const [moving] = freshIds(1);
    staleArticles([moving!]);
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(renderStaleBatch()).resolves.toEqual({ rendered: 0, failed: 1 });

    await renderStaleBatch();
    expect(unsyncedQueries()[1]?.where.id?.notIn).toContain(moving);
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

describe("renderStaleBatch: bundles an earlier renderer version built", () => {
  /** A fresh copy of the service: the backlog of outdated articles is per process and scanned once. */
  async function freshService() {
    let service!: typeof import("~/lib/wiki-os/services/render-service");
    await jest.isolateModulesAsync(async () => {
      service = await import("~/lib/wiki-os/services/render-service");
    });
    return service;
  }
  const renderedIds = () => mockUpdateMany.mock.calls.map(([args]) => args.where.id);

  it("finds them with one scan, never with the per-minute query, and renders them oldest first", async () => {
    const { renderStaleBatch: batch, RENDERER_VERSION: version } = await freshService();
    const [o1, o2, o3] = freshIds(3);
    database({ unsynced: [], outdated: [o1!, o2!, o3!] });

    // one article per batch: the backlog outlives three batches and is read from the scan only once
    for (let round = 0; round < 3; round++) {
      await expect(batch(1)).resolves.toEqual({ rendered: 1, failed: 0 });
    }

    expect(renderedIds()).toEqual([o1, o2, o3]);
    expect(scanQueries()).toEqual([
      {
        where: {
          status: "PUBLISHED",
          wikitext: { not: "" },
          renderedView: { path: ["rendererVersion"], not: version },
        },
        orderBy: { updatedAt: "asc" },
        take: 100_000,
        select: { id: true },
      },
    ]);
    expect(unsyncedQueries()).toHaveLength(3);
    for (const query of unsyncedQueries()) {
      expect(query.where).toEqual({
        status: "PUBLISHED",
        htmlSyncedAt: null,
        wikitext: { not: "" },
      });
    }
  });

  it("renders unsynced articles first, and the outdated ones in the room they leave", async () => {
    const { renderStaleBatch: batch } = await freshService();
    const [u1, u2, o1, o2, o3] = freshIds(5);
    database({ unsynced: [u1!, u2!], outdated: [o1!, o2!, o3!] });

    await expect(batch(4)).resolves.toEqual({ rendered: 4, failed: 0 });

    expect(renderedIds()).toEqual([u1, u2, o1, o2]);
  });

  it("does not even look at the backlog while unsynced articles fill the batch", async () => {
    const { renderStaleBatch: batch } = await freshService();
    const [u1, u2, o1] = freshIds(3);
    const stale = { unsynced: [u1!, u2!], outdated: [o1!] };
    database(stale);

    await batch(2);
    expect(scanQueries()).toHaveLength(0);
    expect(renderedIds()).toEqual([u1, u2]);

    await batch(2); // the unsynced are done: now there is room
    expect(scanQueries()).toHaveLength(1);
    expect(renderedIds()).toEqual([u1, u2, o1]);
  });

  it("renders an article that is both unsynced and outdated once", async () => {
    const { renderStaleBatch: batch } = await freshService();
    const [both, o1] = freshIds(2);
    database({ unsynced: [both!], outdated: [both!, o1!] });

    await expect(batch()).resolves.toEqual({ rendered: 2, failed: 0 });

    expect(renderedIds()).toEqual([both, o1]);
  });

  it("never scans again once the backlog is empty", async () => {
    const { renderStaleBatch: batch } = await freshService();
    const [o1] = freshIds(1);
    database({ unsynced: [], outdated: [o1!] });

    await batch();
    expect(scanQueries()).toHaveLength(1);
    expect(checkQueries()).toHaveLength(1);

    for (let round = 0; round < 3; round++) {
      await expect(batch()).resolves.toEqual({ rendered: 0, failed: 0 });
    }

    expect(scanQueries()).toHaveLength(1);
    expect(checkQueries()).toHaveLength(1);
    expect(unsyncedQueries()).toHaveLength(4);
  });

  it("scans once and never checks anything when nothing is outdated", async () => {
    const { renderStaleBatch: batch } = await freshService();
    database({ unsynced: [], outdated: [] });

    for (let round = 0; round < 3; round++) await batch();

    expect(scanQueries()).toHaveLength(1);
    expect(checkQueries()).toHaveLength(0);
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("drops an article that was brought up to date meanwhile, without rendering it", async () => {
    const { renderStaleBatch: batch } = await freshService();
    const [o1, o2, o3] = freshIds(3);
    const stale = { unsynced: [], outdated: [o1!, o2!, o3!] };
    database(stale);

    await batch(1); // scans, renders o1
    stale.outdated = stale.outdated.filter((id) => id !== o2); // a reader's render got o2
    await batch(1); // o2 is dropped, o3 takes its place
    await batch(1);

    expect(renderedIds()).toEqual([o1, o3]);
    expect(checkQueries().map((query) => query.where.id?.in)).toEqual([[o1], [o2], [o3]]);
  });

  it("keeps a failed article in the backlog, behind the usual backoff", async () => {
    const { renderStaleBatch: batch } = await freshService();
    const [broken, fine] = freshIds(2);
    database({ unsynced: [], outdated: [broken!, fine!] });
    mockRender.mockImplementation(async (_text: string, title: string) =>
      title === `Title of ${broken}` ? null : HTML
    );

    await expect(batch()).resolves.toEqual({ rendered: 1, failed: 1 });
    await expect(batch()).resolves.toEqual({ rendered: 0, failed: 0 }); // backing off: left alone
    expect(mockFindUnique.mock.calls.filter(([args]) => args.where.id === broken)).toHaveLength(1);
    expect(scanQueries()).toHaveLength(1);

    const later = jest.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * 60_000);
    try {
      await expect(batch()).resolves.toEqual({ rendered: 0, failed: 1 }); // its turn again, no rescan
    } finally {
      later.mockRestore();
    }
    expect(mockFindUnique.mock.calls.filter(([args]) => args.where.id === broken)).toHaveLength(2);
    expect(scanQueries()).toHaveLength(1);
  });

  it("logs a failed scan, still renders the unsynced articles, and scans again next time", async () => {
    const { renderStaleBatch: batch } = await freshService();
    const [u1, o1] = freshIds(2);
    const stale = { unsynced: [u1!], outdated: [o1!] };
    database(stale);
    const answer = mockFindMany.getMockImplementation()!;
    mockFindMany.mockImplementationOnce(answer); // the unsynced query
    mockFindMany.mockRejectedValueOnce(new Error("db down")); // the scan
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(batch()).resolves.toEqual({ rendered: 1, failed: 0 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("outdated"), expect.any(Error));
    expect(renderedIds()).toEqual([u1]);

    await expect(batch()).resolves.toEqual({ rendered: 1, failed: 0 });
    expect(renderedIds()).toEqual([u1, o1]);
    expect(scanQueries()).toHaveLength(2);
    warn.mockRestore();
  });
});
