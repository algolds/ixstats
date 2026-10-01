/** @jest-environment node */
/**
 * Plan 404: each article is rendered once per revision, off the read path. renderArticle stores
 * the view bundle guarded by the wikitext it rendered; ensureRendered is single-flight and bounded
 * by waitMs; enqueueRender never runs more than two MediaWiki renders at once.
 */
const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
const mockRenderViaMediaWiki = jest.fn();
const mockSanitizeHook = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));
// `mockRenderViaMediaWiki` answers with the HTML (or null); MediaWiki's metadata is the subject of
// render-metadata.test.ts, so here a render reports nothing about the page.
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  renderArticleViaMediaWiki: async (...a: unknown[]) => {
    const html = (await mockRenderViaMediaWiki(...a)) as string | null;
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

// The real sanitizer; `mockSanitizeHook` sees each call first, so a test can make it throw.
jest.mock("~/lib/utils/sanitize-html", () => {
  const actual = jest.requireActual<typeof import("~/lib/utils/sanitize-html")>(
    "~/lib/utils/sanitize-html"
  );
  return {
    ...actual,
    sanitizeWikiArticleHtml: (html: string) => {
      mockSanitizeHook(html);
      return actual.sanitizeWikiArticleHtml(html);
    },
  };
});

import {
  buildViewBundle,
  enqueueRender,
  ensureRendered,
  loadViewBundle,
  renderArticle,
  renderFallbackView,
  renderInBackground,
  RENDERER_VERSION,
} from "~/lib/wiki-os/services/render-service";
import { wikiArticleSanitizerFingerprint } from "~/lib/utils/sanitize-html";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

const PARSED =
  '<div class="mw-parser-output"><p>Intro.</p><div class="mw-heading mw-heading2"><h2 id="History">History</h2></div><p>Body.</p></div>';

let ids = 0;
/** A fresh article id per test: the service keeps per-id state for the life of the module. */
const freshId = () => `art-${++ids}`;

/** The article rows `findUnique` answers with, by id. */
function stubArticle(
  id: string,
  row: {
    title?: string;
    wikitext?: string;
    contentHtml?: string | null;
    /** The page's current live revision, newest first (the render reads one): its size and whether its text is hidden. */
    revisions?: Array<{ byteSize: number; textDeleted: boolean }>;
  } = {}
) {
  const article = { title: "Foo", wikitext: "the wikitext", contentHtml: null, revisions: [], ...row };
  mockFindUnique.mockImplementation(async (args: { where: { id: string } }) =>
    args.where.id === id ? article : null
  );
  return article;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockRenderViaMediaWiki.mockResolvedValue(PARSED);
});

describe("renderArticle", () => {
  it("renders the Postgres wikitext and stores the bundle, the raw HTML and htmlSyncedAt, guarded by that wikitext", async () => {
    const id = freshId();
    stubArticle(id, { title: "Foo bar", wikitext: "'''Intro'''" });

    const result = await renderArticle(id);

    expect(result).toEqual({ ok: true });
    expect(mockRenderViaMediaWiki).toHaveBeenCalledWith("'''Intro'''", "Foo bar");
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const { where, data } = mockUpdateMany.mock.calls[0]?.[0];
    expect(where).toEqual({ id, wikitext: "'''Intro'''" });
    expect(data.contentHtml).toBe(PARSED);
    expect(data.htmlSyncedAt).toBeInstanceOf(Date);
    expect(data.renderedView).toEqual(buildViewBundle(PARSED));
    expect(data.renderedView).toMatchObject({
      rendererVersion: RENDERER_VERSION,
      toc: [{ id: "History", text: "History", level: 2 }],
    });
  });

  it("stores nothing when MediaWiki fails, so the previous bundle stays and the article stays stale", async () => {
    const id = freshId();
    stubArticle(id);
    mockRenderViaMediaWiki.mockResolvedValue(null);

    await expect(renderArticle(id)).resolves.toEqual({ ok: false });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("stores the page of a health-check failure anyway, with a warning, and renders it once", async () => {
    const id = freshId();
    stubArticle(id, { wikitext: "{{Infobox country|name=Foo}} text" });
    mockRenderViaMediaWiki.mockResolvedValue("<p>text without the box</p>");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("the infobox is missing"));
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("warns about leaked wikitext markup and still stores the page", async () => {
    const id = freshId();
    stubArticle(id);
    mockRenderViaMediaWiki.mockResolvedValue("<p>[[File:A.png|200px|thumb]] left</p>");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("leaked wikitext markup"));
    warn.mockRestore();
  });

  it("restarts on the new text when a save lands while it renders", async () => {
    const id = freshId();
    const rows = [
      { title: "Foo", wikitext: "old text", contentHtml: null },
      { title: "Foo", wikitext: "new text", contentHtml: null },
    ];
    mockFindUnique.mockImplementation(async () => rows.shift() ?? null);
    mockUpdateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(mockRenderViaMediaWiki.mock.calls.map((call) => call[0])).toEqual([
      "old text",
      "new text",
    ]);
    expect(mockUpdateMany.mock.calls.map((call) => call[0].where.wikitext)).toEqual([
      "old text",
      "new text",
    ]);
  });

  it("reports superseded, not failed, after a few attempts the saves overtook", async () => {
    const id = freshId();
    let n = 0;
    mockFindUnique.mockImplementation(async () => ({
      title: "Foo",
      wikitext: `text ${++n}`,
      contentHtml: null,
    }));
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(renderArticle(id)).resolves.toEqual({ ok: false, superseded: true });
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(3);
  });

  it("builds an HTML-only row from its stored HTML without calling MediaWiki", async () => {
    const id = freshId();
    stubArticle(id, { wikitext: "", contentHtml: PARSED });

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(mockRenderViaMediaWiki).not.toHaveBeenCalled();
    expect(mockUpdateMany.mock.calls[0]?.[0].data.renderedView.bodyHtml).toContain("Intro.");
  });

  it("stores nothing for a stub with neither wikitext nor HTML, and for a missing article", async () => {
    const stub = freshId();
    stubArticle(stub, { wikitext: "  ", contentHtml: null });
    await expect(renderArticle(stub)).resolves.toEqual({ ok: false });

    mockFindUnique.mockResolvedValue(null);
    await expect(renderArticle(freshId())).resolves.toEqual({ ok: false });

    expect(mockRenderViaMediaWiki).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

describe("renderArticle of a page its last edit blanked", () => {
  const OLD = "<p>Old content that must not come back.</p>";
  const BLANK_REVISION = [{ byteSize: 0, textDeleted: false }];

  it("renders nothing for it, whatever HTML was stored for its earlier text, without calling MediaWiki", async () => {
    const id = freshId();
    stubArticle(id, { wikitext: "", contentHtml: OLD, revisions: BLANK_REVISION });

    await expect(renderArticle(id)).resolves.toEqual({ ok: true });

    expect(mockRenderViaMediaWiki).not.toHaveBeenCalled();
    const { where, data } = mockUpdateMany.mock.calls[0]?.[0];
    expect(where).toEqual({ id, wikitext: "" });
    expect(data.contentHtml).toBe("");
    expect(data.renderedView).toEqual(buildViewBundle(""));
    expect(data.renderedView.bodyHtml).not.toContain("Old content");
    expect(data.htmlSyncedAt).toBeInstanceOf(Date);
  });

  it("does the same for a text that is only whitespace (the editor does not trim it)", async () => {
    const id = freshId();
    stubArticle(id, { wikitext: "  \n", contentHtml: OLD, revisions: [{ byteSize: 3, textDeleted: false }] });

    await renderArticle(id);

    expect(mockUpdateMany.mock.calls[0]?.[0].data.contentHtml).toBe("");
  });

  it("still builds an HTML-only row from the HTML it has (no revision), and a stub whose text was never imported (a revision with a size but no text, or a hidden one)", async () => {
    for (const revisions of [[], [{ byteSize: 480, textDeleted: false }], [{ byteSize: 0, textDeleted: true }]]) {
      mockUpdateMany.mockClear();
      const id = freshId();
      stubArticle(id, { wikitext: "", contentHtml: OLD, revisions });

      await expect(renderArticle(id)).resolves.toEqual({ ok: true });

      expect(mockUpdateMany.mock.calls[0]?.[0].data.contentHtml).toBe(OLD);
    }
  });

  it("stores nothing for a page with no revision and no HTML, as before", async () => {
    const id = freshId();
    stubArticle(id, { wikitext: "", contentHtml: null, revisions: [] });

    await expect(renderArticle(id)).resolves.toEqual({ ok: false });

    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("reads the newest live revision only (a parked MediaWiki edit is not the page)", async () => {
    const id = freshId();
    stubArticle(id, { wikitext: "", contentHtml: OLD, revisions: BLANK_REVISION });

    await renderArticle(id);

    expect(mockFindUnique.mock.calls[0]?.[0].select.revisions).toEqual({
      where: { parked: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1,
      select: { byteSize: true, textDeleted: true },
    });
  });
});

describe("ensureRendered", () => {
  it("shares one MediaWiki call between concurrent callers (single-flight)", async () => {
    const id = freshId();
    stubArticle(id);
    const mediaWiki = deferred<string | null>();
    mockRenderViaMediaWiki.mockReturnValue(mediaWiki.promise);

    const first = ensureRendered(id, { waitMs: 1000 });
    const second = ensureRendered(id, { waitMs: 1000 });
    mediaWiki.resolve(PARSED);

    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);

    // The flight is over: a later caller renders again.
    await ensureRendered(id, { waitMs: 1000 });
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(2);
  });

  it("resolves without the result when waitMs runs out, and the render carries on", async () => {
    const id = freshId();
    stubArticle(id);
    const mediaWiki = deferred<string | null>();
    mockRenderViaMediaWiki.mockReturnValue(mediaWiki.promise);

    await expect(ensureRendered(id, { waitMs: 20 })).resolves.toBeNull();
    expect(mockUpdateMany).not.toHaveBeenCalled();

    mediaWiki.resolve(PARSED);
    await flush();
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("does not wait at all for waitMs 0", async () => {
    const id = freshId();
    stubArticle(id);
    const mediaWiki = deferred<string | null>();
    mockRenderViaMediaWiki.mockReturnValue(mediaWiki.promise);

    await expect(ensureRendered(id, { waitMs: 0 })).resolves.toBeNull();
    mediaWiki.resolve(PARSED);
    await flush();
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failed article for the cool-down, but a new write (enqueueRender) does", async () => {
    const id = freshId();
    stubArticle(id);
    mockRenderViaMediaWiki.mockResolvedValue(null);

    await expect(ensureRendered(id, { waitMs: 1000 })).resolves.toEqual({ ok: false });
    await expect(ensureRendered(id, { waitMs: 1000 })).resolves.toEqual({ ok: false });
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(1);

    mockRenderViaMediaWiki.mockResolvedValue(PARSED);
    enqueueRender(id);
    await flush();
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(2);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("treats a database error as a failed render instead of rejecting", async () => {
    const id = freshId();
    mockFindUnique.mockRejectedValue(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(ensureRendered(id, { waitMs: 1000 })).resolves.toEqual({ ok: false });
    warn.mockRestore();
  });
});

describe("enqueueRender", () => {
  it("never runs more than two MediaWiki renders at once, and renders them all", async () => {
    const articles = Array.from({ length: 5 }, freshId);
    mockFindUnique.mockImplementation(async () => ({
      title: "Foo",
      wikitext: "text",
      contentHtml: null,
    }));
    let running = 0;
    let peak = 0;
    const gates: Array<Deferred<string>> = [];
    mockRenderViaMediaWiki.mockImplementation(async () => {
      running++;
      peak = Math.max(peak, running);
      const gate = deferred<string>();
      gates.push(gate);
      const html = await gate.promise;
      running--;
      return html;
    });

    for (const id of articles) enqueueRender(id);
    await flush();
    expect(running).toBe(2);

    while (mockUpdateMany.mock.calls.length < 5) {
      gates.shift()?.resolve(PARSED);
      await flush();
    }

    expect(peak).toBe(2);
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(5);
  });

  it("lets a reader who waits jump the queue", async () => {
    const [a, b, c, reader] = Array.from({ length: 4 }, freshId);
    mockFindUnique.mockImplementation(async (args: { where: { id: string } }) => ({
      title: args.where.id,
      wikitext: "text",
      contentHtml: null,
    }));
    const started: string[] = [];
    const gates: Array<Deferred<string>> = [];
    mockRenderViaMediaWiki.mockImplementation(async (_text: string, title: string) => {
      started.push(title);
      const gate = deferred<string>();
      gates.push(gate);
      return gate.promise;
    });

    enqueueRender(a);
    enqueueRender(b);
    enqueueRender(c);
    const read = ensureRendered(reader, { waitMs: 5000 });
    await flush();
    expect(started).toEqual([a, b]);

    gates.shift()?.resolve(PARSED);
    await flush();
    expect(started).toEqual([a, b, reader]);

    while (mockUpdateMany.mock.calls.length < 4) {
      gates.shift()?.resolve(PARSED);
      await flush();
    }
    await expect(read).resolves.toEqual({ ok: true });
  });
});

describe("renderInBackground", () => {
  it("starts one render without waiting, and joins one that is already running", async () => {
    const id = freshId();
    stubArticle(id);
    const mediaWiki = deferred<string | null>();
    mockRenderViaMediaWiki.mockReturnValue(mediaWiki.promise);

    expect(renderInBackground(id)).toBeUndefined();
    renderInBackground(id);
    await flush();
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).not.toHaveBeenCalled();

    mediaWiki.resolve(PARSED);
    await flush();
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("leaves an article alone while its last render's cool-down lasts; a write ends it", async () => {
    const id = freshId();
    stubArticle(id);
    mockRenderViaMediaWiki.mockResolvedValue(null);
    await ensureRendered(id, { waitMs: 1000 });
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(1);

    renderInBackground(id);
    await flush();
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(1);

    mockRenderViaMediaWiki.mockResolvedValue(PARSED);
    enqueueRender(id);
    await flush();
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(2);
  });

  it("queues behind a save and a waiting reader, as backlog work", async () => {
    const [a, b, outdated, save] = Array.from({ length: 4 }, freshId);
    mockFindUnique.mockImplementation(async (args: { where: { id: string } }) => ({
      title: args.where.id,
      wikitext: "text",
      contentHtml: null,
    }));
    const started: string[] = [];
    const gates = new Map<string, Deferred<string>>();
    mockRenderViaMediaWiki.mockImplementation(async (_text: string, title: string) => {
      started.push(title);
      const gate = deferred<string>();
      gates.set(title, gate);
      return gate.promise;
    });
    const open = async (id: string) => {
      gates.get(id)?.resolve(PARSED);
      await flush();
    };
    enqueueRender(a);
    enqueueRender(b);
    await flush();

    renderInBackground(outdated);
    enqueueRender(save);
    await open(a);

    expect(started).toEqual([a, b, save]);
    await open(b);
    expect(started).toEqual([a, b, save, outdated]);
    await open(save);
    await open(outdated);
  });
});

describe("buildViewBundle", () => {
  it("extracts the infobox, notices and TOC and sanitizes every part", () => {
    const html =
      '<div class="mw-parser-output"><div class="hatnote">See <a href="/wiki/Bar">Bar</a></div>' +
      '<table class="infobox"><tr><td>Capital<script>alert(1)</script></td></tr></table>' +
      '<div class="mw-heading mw-heading2"><h2 id="Geography">Geography</h2></div>' +
      '<p onclick="steal()">Text <a href="/wiki/Baz">Baz</a></p><script>alert(2)</script></div>';

    const bundle = buildViewBundle(html);

    expect(bundle.rendererVersion).toBe(RENDERER_VERSION);
    expect(bundle.toc).toEqual([{ id: "Geography", text: "Geography", level: 2 }]);
    expect(bundle.infoboxHtml).toContain("Capital");
    expect(bundle.noticesHtml).toContain("hatnote");
    expect(bundle.bodyHtml).toContain('href="/wiki/Baz"');
    for (const part of [bundle.bodyHtml, bundle.infoboxHtml, bundle.noticesHtml]) {
      expect(part).not.toMatch(/<script|onclick/i);
    }
  });

  it("stores each template chip as an inert marker, from the DOM", () => {
    const bundle = buildViewBundle(
      '<p>Pop <a href="/wiki/Template:CountryData:Aurelia:population" title="Template:CountryData:Aurelia:population">x</a> and {{MyCountry:gdp}} here.</p>'
    );

    expect(bundle.bodyHtml).toBe(
      '<p>Pop <span data-wikios-chip="CountryData:Aurelia:population"></span> and <span data-wikios-chip="MyCountry:gdp"></span> here.</p>'
    );
  });

  it("keeps a chip whose key is outside the marker alphabet as the ordinary link it was", () => {
    const bundle = buildViewBundle(
      '<p><a href="/wiki/Template:CountryData:A%3CB:population">x</a></p>'
    );

    expect(bundle.bodyHtml).not.toContain("data-wikios-chip");
    expect(bundle.bodyHtml).toContain("Template:CountryData");
  });

  it("has no infobox or notices when the page has none", () => {
    expect(buildViewBundle("<p>Plain.</p>")).toMatchObject({
      infoboxHtml: null,
      noticesHtml: null,
      toc: [],
    });
  });
});

describe("loadViewBundle", () => {
  const syncedAt = new Date("2026-09-30T10:00:00Z");

  it("returns a valid bundle with its freshness", async () => {
    const bundle = buildViewBundle(PARSED);
    mockFindUnique.mockResolvedValue({ renderedView: bundle, htmlSyncedAt: syncedAt });

    await expect(loadViewBundle("a")).resolves.toEqual({
      bundle,
      htmlSyncedAt: syncedAt,
      outdated: false,
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "a" },
      select: { renderedView: true, htmlSyncedAt: true },
    });
  });

  it("returns a stale bundle with a null htmlSyncedAt", async () => {
    const bundle = buildViewBundle(PARSED);
    mockFindUnique.mockResolvedValue({ renderedView: bundle, htmlSyncedAt: null });

    await expect(loadViewBundle("a")).resolves.toEqual({
      bundle,
      htmlSyncedAt: null,
      outdated: false,
    });
  });

  it.each([
    ["no bundle yet", null],
    ["a version that is not a string", { ...buildViewBundle(PARSED), rendererVersion: 0 }],
    ["no version at all", { ...buildViewBundle(PARSED), rendererVersion: undefined }],
    ["a malformed bundle", { bodyHtml: 5 }],
    ["a bundle whose shape changed", { ...buildViewBundle(PARSED), toc: "none" }],
  ])("is null for %s", async (_name, renderedView) => {
    mockFindUnique.mockResolvedValue({ renderedView, htmlSyncedAt: syncedAt });

    await expect(loadViewBundle("a")).resolves.toBeNull();
  });

  it("is null for a missing article", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(loadViewBundle("a")).resolves.toBeNull();
  });

  it("is tied to the sanitizer: another sanitizer fingerprint is another renderer version", async () => {
    expect(RENDERER_VERSION).toBe(`3:${wikiArticleSanitizerFingerprint()}`);
    const bundle = { ...buildViewBundle(PARSED), rendererVersion: "3:0123456789abc" };
    mockFindUnique.mockResolvedValue({ renderedView: bundle, htmlSyncedAt: syncedAt });

    await expect(loadViewBundle("a")).resolves.toMatchObject({ outdated: true });
  });

  describe("a bundle of another renderer version", () => {
    const hostile = {
      bodyHtml: '<p>Body</p><script>alert(1)</script><img src="x" onerror="alert(2)">',
      infoboxHtml: '<table class="infobox"><tr><td onclick="alert(3)">Box</td></tr></table>',
      noticesHtml: '<div class="hatnote"><script>alert(4)</script>Note</div>',
      toc: [{ id: "History", text: "History", level: 2 }],
      rendererVersion: "2",
    };

    it("is returned as outdated, with the freshness it had and its other fields as stored", async () => {
      mockFindUnique.mockResolvedValue({ renderedView: hostile, htmlSyncedAt: syncedAt });

      const loaded = await loadViewBundle("a");

      expect(loaded).toMatchObject({ htmlSyncedAt: syncedAt, outdated: true });
      expect(loaded?.bundle.rendererVersion).toBe("2");
      expect(loaded?.bundle.toc).toEqual(hostile.toc);
      expect(loaded?.bundle.bodyHtml).toContain("<p>Body</p>");
    });

    it("is re-sanitized by the current sanitizer: body, infobox and notices", async () => {
      mockFindUnique.mockResolvedValue({ renderedView: hostile, htmlSyncedAt: syncedAt });

      const { bundle } = (await loadViewBundle("a"))!;

      for (const html of [bundle.bodyHtml, bundle.infoboxHtml, bundle.noticesHtml]) {
        expect(html).not.toMatch(/<script|onerror|onclick|alert\(/i);
      }
      expect(bundle.infoboxHtml).toContain("Box");
      expect(bundle.noticesHtml).toContain("Note");
    });

    it("keeps an absent infobox and notices absent", async () => {
      mockFindUnique.mockResolvedValue({
        renderedView: { ...hostile, infoboxHtml: null, noticesHtml: null },
        htmlSyncedAt: null,
      });

      const loaded = await loadViewBundle("a");

      expect(loaded).toMatchObject({ htmlSyncedAt: null, outdated: true });
      expect(loaded?.bundle.infoboxHtml).toBeNull();
      expect(loaded?.bundle.noticesHtml).toBeNull();
    });

    it("is null, with a warning, when the sanitizer throws on it: one page cannot fail every read", async () => {
      mockSanitizeHook.mockImplementationOnce(() => {
        throw new Error("pathological markup");
      });
      mockFindUnique.mockResolvedValue({ renderedView: hostile, htmlSyncedAt: syncedAt });
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

      await expect(loadViewBundle("a")).resolves.toBeNull();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("a"), expect.any(Error));
      warn.mockRestore();
    });

    it("keeps the template chip markers the sanitizer lets through", async () => {
      const marked = buildViewBundle('<p><a href="/wiki/Template:MyCountry:x">y</a></p>');
      mockFindUnique.mockResolvedValue({
        renderedView: { ...marked, rendererVersion: "2" },
        htmlSyncedAt: syncedAt,
      });

      const loaded = await loadViewBundle("a");

      expect(marked.bodyHtml).toContain("data-wikios-chip");
      expect(loaded?.bundle.bodyHtml).toBe(marked.bodyHtml);
    });
  });
});

describe("renderFallbackView", () => {
  it("compiles the wikitext in-process, without MediaWiki and without persisting", async () => {
    mockFindUnique.mockResolvedValue({ wikitext: "'''Bold''' text", contentHtml: null });

    const bundle = await renderFallbackView("a");

    expect(bundle?.bodyHtml).toContain("Bold");
    expect(mockRenderViaMediaWiki).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("prefers the HTML MediaWiki produced for an earlier revision over compiling the wikitext", async () => {
    mockFindUnique.mockResolvedValue({
      wikitext: "Newer text",
      contentHtml: "<p>Earlier render.</p>",
    });

    const bundle = await renderFallbackView("a");

    expect(bundle?.bodyHtml).toContain("Earlier render.");
    expect(bundle?.bodyHtml).not.toContain("Newer");
  });

  it("uses the stored HTML of an HTML-only row", async () => {
    mockFindUnique.mockResolvedValue({ wikitext: "", contentHtml: "<p>Legacy.</p>" });

    await expect(renderFallbackView("a")).resolves.toMatchObject({
      bodyHtml: expect.stringContaining("Legacy."),
    });
  });

  it("is null for a stub and for a missing article", async () => {
    mockFindUnique.mockResolvedValueOnce({ wikitext: "", contentHtml: "" });
    await expect(renderFallbackView("a")).resolves.toBeNull();

    mockFindUnique.mockResolvedValueOnce(null);
    await expect(renderFallbackView("a")).resolves.toBeNull();
  });
});

describe("the render queue's priorities", () => {
  /** Two slots held by A and B; every later render waits in the queue until a gate is opened. */
  function holdBothSlots() {
    const [a, b] = Array.from({ length: 2 }, freshId);
    mockFindUnique.mockImplementation(async (args: { where: { id: string } }) => ({
      title: args.where.id,
      wikitext: "text",
      contentHtml: null,
    }));
    const started: string[] = [];
    const gates = new Map<string, Deferred<string>>();
    mockRenderViaMediaWiki.mockImplementation(async (_text: string, title: string) => {
      started.push(title);
      const gate = deferred<string>();
      gates.set(title, gate);
      return gate.promise;
    });
    enqueueRender(a);
    enqueueRender(b);
    const open = async (id: string) => {
      gates.get(id)?.resolve(PARSED);
      await flush();
    };
    return { a, b, started, open };
  }

  it("renders an editor's save before an inbound-sync backlog that queued earlier", async () => {
    const { a, b, started, open } = holdBothSlots();
    const [backlog1, backlog2, save] = Array.from({ length: 3 }, freshId);
    await flush();

    enqueueRender(backlog1, { background: true });
    enqueueRender(backlog2, { background: true });
    enqueueRender(save);
    await open(a);

    expect(started).toEqual([a, b, save]);
    await open(b);
    expect(started).toEqual([a, b, save, backlog1]);
    for (const id of [save, backlog1, backlog2]) await open(id);
    await open(backlog2);
  });

  it("moves a background render to the front when a waiting reader attaches to it", async () => {
    const { a, b, started, open } = holdBothSlots();
    const [first, second] = Array.from({ length: 2 }, freshId);
    await flush();

    enqueueRender(first, { background: true });
    enqueueRender(second, { background: true });
    const read = ensureRendered(second, { waitMs: 5000 });
    await open(a);

    expect(started).toEqual([a, b, second]);
    await open(second);
    await expect(read).resolves.toEqual({ ok: true });
    await open(b);
    await open(first);
  });

  it("moves a background render up to a save's place when the article is saved", async () => {
    const { a, b, started, open } = holdBothSlots();
    const [first, second] = Array.from({ length: 2 }, freshId);
    await flush();

    enqueueRender(first, { background: true });
    enqueueRender(second, { background: true });
    enqueueRender(second); // the editor saves the page the backlog also holds
    await open(a);

    expect(started).toEqual([a, b, second]);
    await open(b);
    await open(second);
    await open(first);
  });
});

describe("a render job's deadline", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("abandons a render that hangs: the waiter gets a failure, the flight and the slot are released", async () => {
    const [a, b, c] = Array.from({ length: 3 }, freshId);
    mockFindUnique.mockImplementation(async (args: { where: { id: string } }) => ({
      title: args.where.id,
      wikitext: "text",
      contentHtml: null,
    }));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockRenderViaMediaWiki.mockImplementation(async (_text: string, title: string) =>
      title === c ? PARSED : new Promise<string>(() => undefined)
    );

    const hung = ensureRendered(a, { waitMs: 120_000 });
    enqueueRender(b);
    const queued = ensureRendered(c, { waitMs: 120_000 }); // waits for a slot behind the two hung renders
    await flush();
    expect(mockUpdateMany).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(60_000);

    await expect(hung).resolves.toEqual({ ok: false });
    await expect(queued).resolves.toEqual({ ok: true }); // the slot came free
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("deadline"));

    // The flight is gone: a new write renders the article again.
    mockRenderViaMediaWiki.mockResolvedValue(PARSED);
    enqueueRender(a);
    await flush();
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe("saves that keep overtaking a render (plan 404 review)", () => {
  it("four rapid saves end with a rendered bundle, not a failure cool-down", async () => {
    const id = freshId();
    let current = "v1";
    let savesLanded = 0;
    mockFindUnique.mockImplementation(async () => ({
      title: "Foo",
      wikitext: current,
      contentHtml: null,
    }));
    // A save lands during each of the first four renders.
    mockRenderViaMediaWiki.mockImplementation(async () => {
      if (savesLanded < 4) current = `v${2 + savesLanded++}`;
      return PARSED;
    });
    mockUpdateMany.mockImplementation(async (args: { where: { wikitext: string } }) => ({
      count: args.where.wikitext === current ? 1 : 0,
    }));

    await expect(ensureRendered(id, { waitMs: 5000 })).resolves.toEqual({ ok: true });

    expect(mockUpdateMany.mock.calls.at(-1)?.[0].where.wikitext).toBe("v5");
    expect(
      mockUpdateMany.mock.calls.filter((call) => call[0].where.wikitext === current)
    ).toHaveLength(1);

    // No failure was recorded: the next reader renders again instead of being turned away.
    const callsBefore = mockRenderViaMediaWiki.mock.calls.length;
    await expect(ensureRendered(id, { waitMs: 5000 })).resolves.toEqual({ ok: true });
    expect(mockRenderViaMediaWiki.mock.calls.length).toBe(callsBefore + 1);
  });

  it("calls a text that never settles a failure after a few rounds, and cools down", async () => {
    const id = freshId();
    let n = 0;
    mockFindUnique.mockImplementation(async () => ({
      title: "Foo",
      wikitext: `text ${++n}`,
      contentHtml: null,
    }));
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(ensureRendered(id, { waitMs: 5000 })).resolves.toEqual({ ok: false });
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(9); // 3 rounds of 3 attempts

    await expect(ensureRendered(id, { waitMs: 5000 })).resolves.toEqual({ ok: false });
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(9);
  });
});
