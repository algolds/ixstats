/** @jest-environment node */
/**
 * Plan 404: each article is rendered once per revision, off the read path. renderArticle stores
 * the view bundle guarded by the wikitext it rendered; ensureRendered is single-flight and bounded
 * by waitMs; enqueueRender never runs more than two MediaWiki renders at once.
 */
const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
const mockRenderViaMediaWiki = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  renderArticleViaMediaWiki: (...a: unknown[]) => mockRenderViaMediaWiki(...a),
}));

import {
  buildViewBundle,
  enqueueRender,
  ensureRendered,
  loadViewBundle,
  renderArticle,
  renderFallbackView,
  RENDERER_VERSION,
} from "~/lib/wiki-os/services/render-service";

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
  row: { title?: string; wikitext?: string; contentHtml?: string | null } = {}
) {
  const article = { title: "Foo", wikitext: "the wikitext", contentHtml: null, ...row };
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

    expect(mockRenderViaMediaWiki.mock.calls.map((call) => call[0])).toEqual(["old text", "new text"]);
    expect(mockUpdateMany.mock.calls.map((call) => call[0].where.wikitext)).toEqual([
      "old text",
      "new text",
    ]);
  });

  it("gives up after a few superseded attempts", async () => {
    const id = freshId();
    let n = 0;
    mockFindUnique.mockImplementation(async () => ({
      title: "Foo",
      wikitext: `text ${++n}`,
      contentHtml: null,
    }));
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(renderArticle(id)).resolves.toEqual({ ok: false });
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

describe("buildViewBundle", () => {
  it("extracts the infobox, notices and TOC and sanitizes every part", () => {
    const html =
      '<div class="mw-parser-output"><div class="hatnote">See <a href="/wiki/Bar">Bar</a></div>' +
      '<table class="infobox"><tr><td>Capital<script>alert(1)</script></td></tr></table>' +
      '<div class="mw-heading mw-heading2"><h2 id="Geography">Geography</h2></div>' +
      '<p onclick="steal()">Text <a href="/wiki/Baz">Baz</a></p><script>alert(2)</script></div>';

    const bundle = buildViewBundle(html);

    expect(bundle.rendererVersion).toBe(1);
    expect(bundle.toc).toEqual([{ id: "Geography", text: "Geography", level: 2 }]);
    expect(bundle.infoboxHtml).toContain("Capital");
    expect(bundle.noticesHtml).toContain("hatnote");
    expect(bundle.bodyHtml).toContain('href="/wiki/Baz"');
    for (const part of [bundle.bodyHtml, bundle.infoboxHtml, bundle.noticesHtml]) {
      expect(part).not.toMatch(/<script|onclick/i);
    }
  });

  it("keeps the template chip placeholders the viewer-specific step needs", () => {
    const bundle = buildViewBundle(
      '<p><a href="/wiki/Template:CountryData:Aurelia:population" title="Template:CountryData:Aurelia:population">x</a> {{MyCountry:gdp}}</p>'
    );

    expect(bundle.bodyHtml).toContain("Template:CountryData:Aurelia:population");
    expect(bundle.bodyHtml).toContain("{{MyCountry:gdp}}");
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

    await expect(loadViewBundle("a")).resolves.toEqual({ bundle, htmlSyncedAt: syncedAt });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "a" },
      select: { renderedView: true, htmlSyncedAt: true },
    });
  });

  it("returns a stale bundle with a null htmlSyncedAt", async () => {
    const bundle = buildViewBundle(PARSED);
    mockFindUnique.mockResolvedValue({ renderedView: bundle, htmlSyncedAt: null });

    await expect(loadViewBundle("a")).resolves.toEqual({ bundle, htmlSyncedAt: null });
  });

  it.each([
    ["no bundle yet", null],
    ["another renderer version", { ...buildViewBundle(PARSED), rendererVersion: 0 }],
    ["a malformed bundle", { bodyHtml: 5 }],
  ])("is null for %s", async (_name, renderedView) => {
    mockFindUnique.mockResolvedValue({ renderedView, htmlSyncedAt: syncedAt });

    await expect(loadViewBundle("a")).resolves.toBeNull();
  });

  it("is null for a missing article", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(loadViewBundle("a")).resolves.toBeNull();
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
