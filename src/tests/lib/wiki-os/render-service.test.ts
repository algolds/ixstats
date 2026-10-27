/** @jest-environment node */
/**
 * The render service (plan 404, 406, 413): a page is rendered once per text, off the read path and single-flight, at
 * most two at a time, saves and waiting readers first; a failed render stores nothing (the previous bundle stays), a
 * save that lands mid-render restarts it, a hung render is abandoned; every part of the view is sanitized, and a
 * bundle a different sanitizer built is sanitized again; the stale pages that transclude a template are re-rendered
 * oldest first within their budget, failures kept out of the way.
 */
const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
const mockFindMany = jest.fn();
const mockExecuteRaw = jest.fn();
const mockRenderViaMediaWiki = jest.fn();
const mockSanitizeHook = jest.fn();
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

import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { buildViewBundle, enqueueRender, ensureRendered, invalidateDependents, loadViewBundle, renderArticle, RENDERER_VERSION, renderFallbackView, renderInBackground, renderStaleBatch } from "~/lib/wiki-os/services/render-service";
import { MEDIA_ERROR_BACKOFF_MS, MEDIA_ERROR_RERENDER_MS, mediaErrorRerenderDue, mediaErrorTextKey } from "~/lib/wiki-os/services/view-bundle";
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
    /** The bundle stored by the page's previous render. */
    renderedView?: unknown;
  } = {}
) {
  const article = { title: "Foo", wikitext: "the wikitext", contentHtml: null, revisions: [], renderedView: null, ...row };
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
  it("stores nothing when MediaWiki fails, so the previous bundle stays and the article stays stale", async () => {
    const id = freshId();
    stubArticle(id);
    mockRenderViaMediaWiki.mockResolvedValue(null);

    await expect(renderArticle(id)).resolves.toEqual({ ok: false });
    expect(mockUpdateMany).not.toHaveBeenCalled();
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
});

describe("loadViewBundle", () => {
  const syncedAt = new Date("2026-09-30T10:00:00Z");
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
  it("is tied to the sanitizer: another sanitizer fingerprint is another renderer version", async () => {
    expect(RENDERER_VERSION).toBe(`7:${wikiArticleSanitizerFingerprint()}`);
    const bundle = { ...buildViewBundle(PARSED), rendererVersion: "3:0123456789abc" };
    mockFindUnique.mockResolvedValue({ renderedView: bundle, htmlSyncedAt: syncedAt });

    await expect(loadViewBundle("a")).resolves.toMatchObject({ outdated: true });
  });

  describe("a render that could not show a file", () => {
    const missingFile =
      '<div class="mw-parser-output"><p>Intro.</p><span typeof="mw:Error mw:File/Frameless">' +
      '<a href="https://ixwiki.com/index.php?title=Special:Upload&amp;wpDestFile=Bing_Crosby_1942.jpg" class="new">' +
      "File:Bing Crosby 1942.jpg</a></span></div>";
    const thumbnailError =
      '<div class="mw-parser-output"><span typeof="mw:Error mw:File"><a href="/wiki/File:Kit_body.png">' +
      "<span>Error creating thumbnail: </span></a></span></div>";
    const now = new Date("2026-10-26T12:00:00Z").getTime();
    const ago = (ms: number) => new Date(now - ms);
    const HOUR = 60 * 60 * 1000;
    const DAY = MEDIA_ERROR_RERENDER_MS;
    const dayOld = ago(DAY);
    const hourOld = ago(HOUR);
    /** A bundle whose render could not show a file, first found broken at `since` (no record: a legacy bundle). */
    const broken = (since?: Date) => ({
      ...buildViewBundle(missingFile),
      ...(since ? { mediaErrorSince: since.toISOString() } : {}),
    });

    it("a first broken render is due once it is a day old: a missing file or a failed thumbnail", () => {
      expect(mediaErrorRerenderDue(broken(dayOld), dayOld, now)).toBe(true);
      expect(mediaErrorRerenderDue(buildViewBundle(thumbnailError), dayOld, now)).toBe(true);
    });

    it("a bundle without the record (stored before it) is a first broken render: due after a day", () => {
      expect(mediaErrorRerenderDue(broken(), hourOld, now)).toBe(false);
      expect(mediaErrorRerenderDue(broken(), dayOld, now)).toBe(true);
    });

    it("a re-render that still could not show the file (broken since an earlier render) waits a week", () => {
      expect(MEDIA_ERROR_BACKOFF_MS).toBe(7 * DAY);
      const since = ago(30 * DAY);
      expect(mediaErrorRerenderDue(broken(since), dayOld, now)).toBe(false);
      expect(mediaErrorRerenderDue(broken(since), ago(6 * DAY), now)).toBe(false);
      expect(mediaErrorRerenderDue(broken(since), ago(MEDIA_ERROR_BACKOFF_MS), now)).toBe(true);
    });

    it("is not due within a day of its render, nor when it is unsynced; a clean render never is", () => {
      expect(mediaErrorRerenderDue(broken(hourOld), hourOld, now)).toBe(false);
      expect(mediaErrorRerenderDue(broken(), null, now)).toBe(false);
      expect(mediaErrorRerenderDue(buildViewBundle(PARSED), new Date(0), now)).toBe(false);
    });

    it("reads markup only: page text that quotes wpDestFile= or mw:Error is not a media error", () => {
      const quoted =
        "<div class=\"mw-parser-output\"><p>Link to <code>Special:Upload&amp;wpDestFile=Foo.png</code> or " +
        "?wpDestFile=Bar.png, and the typeof=\"mw:Error\" and href=\"/x?wpDestFile=Baz.png\" attributes.</p>" +
        '<p><a href="/wiki/Upload" title="mw:Error ?wpDestFile=x">upload</a></p></div>';
      expect(mediaErrorRerenderDue(buildViewBundle(quoted), new Date(0), now)).toBe(false);
    });

    it("reads a 400 KB attribute full of raw < in linear time", () => {
      const hostile = `<p title="${"<a ".repeat(140_000)}">x</p>`;
      const bundle = { ...buildViewBundle(PARSED), bodyHtml: hostile };
      const started = performance.now();
      expect(mediaErrorRerenderDue(bundle, new Date(0), now)).toBe(false);
      expect(performance.now() - started).toBeLessThan(200 * TIMING_BUDGET_SCALE);
    });

    it("is loaded outdated, so the reader is served it stale while a background render replaces it", async () => {
      mockFindUnique.mockResolvedValue({ renderedView: broken(new Date(0)), htmlSyncedAt: new Date(0) });
      await expect(loadViewBundle("a")).resolves.toMatchObject({ outdated: true });
      mockFindUnique.mockResolvedValue({ renderedView: broken(new Date()), htmlSyncedAt: new Date() });
      await expect(loadViewBundle("a")).resolves.toMatchObject({ outdated: false });
    });

    describe("the render records since when the page could not show a file", () => {
      const storedView = () => mockUpdateMany.mock.calls[0]?.[0].data.renderedView;
      const storedAt = (): Date => mockUpdateMany.mock.calls[0]?.[0].data.htmlSyncedAt;

      it("a first broken render (no bundle before, or a clean one, or one without the record) records its own time", async () => {
        for (const renderedView of [null, buildViewBundle(PARSED), broken()]) {
          mockUpdateMany.mockClear();
          const id = freshId();
          stubArticle(id, { renderedView });
          mockRenderViaMediaWiki.mockResolvedValue(missingFile);
          await expect(renderArticle(id)).resolves.toEqual({ ok: true });
          expect(storedView().mediaErrorSince).toBe(storedAt().toISOString());
        }
      });

      it("a re-render of the same text still broken keeps the earlier time, so it waits a week", async () => {
        const id = freshId();
        const since = new Date("2026-10-01T00:00:00Z");
        stubArticle(id, {
          renderedView: { ...broken(since), mediaErrorText: mediaErrorTextKey("the wikitext") },
        });
        mockRenderViaMediaWiki.mockResolvedValue(missingFile);
        await renderArticle(id);
        expect(storedView().mediaErrorSince).toBe(since.toISOString());
        expect(mediaErrorRerenderDue(storedView(), storedAt(), storedAt().getTime() + 6 * DAY)).toBe(false);
        expect(mediaErrorRerenderDue(storedView(), storedAt(), storedAt().getTime() + 7 * DAY)).toBe(true);
      });

      it("a new revision's broken render starts its own record (a day, not the older file's week)", async () => {
        const id = freshId();
        stubArticle(id, {
          wikitext: "the new wikitext",
          renderedView: {
            ...broken(new Date("2026-10-01T00:00:00Z")),
            mediaErrorText: mediaErrorTextKey("the wikitext"),
          },
        });
        mockRenderViaMediaWiki.mockResolvedValue(missingFile);
        await renderArticle(id);
        expect(storedView().mediaErrorSince).toBe(storedAt().toISOString());
        expect(storedView().mediaErrorText).toBe(mediaErrorTextKey("the new wikitext"));
      });

      it("a clean render clears it", async () => {
        const id = freshId();
        stubArticle(id, { renderedView: broken(new Date("2026-10-01T00:00:00Z")) });
        await renderArticle(id);
        expect(storedView()).toEqual(buildViewBundle(PARSED));
        expect(storedView()).not.toHaveProperty("mediaErrorSince");
        expect(storedView()).not.toHaveProperty("mediaErrorText");
      });
    });
  });

  describe("a bundle of another renderer version", () => {
    const hostile = {
      bodyHtml: '<p>Body</p><script>alert(1)</script><img src="x" onerror="alert(2)">',
      infoboxHtml: '<table class="infobox"><tr><td onclick="alert(3)">Box</td></tr></table>',
      noticesHtml: '<div class="hatnote"><script>alert(4)</script>Note</div>',
      toc: [{ id: "History", text: "History", level: 2 }],
      rendererVersion: "2",
    };
    it("is re-sanitized by the current sanitizer: body, infobox and notices", async () => {
      mockFindUnique.mockResolvedValue({ renderedView: hostile, htmlSyncedAt: syncedAt });

      const { bundle } = (await loadViewBundle("a"))!;

      for (const html of [bundle.bodyHtml, bundle.infoboxHtml, bundle.noticesHtml]) {
        expect(html).not.toMatch(/<script|onerror|onclick|alert\(/i);
      }
      expect(bundle.infoboxHtml).toContain("Box");
      expect(bundle.noticesHtml).toContain("Note");
    });

    it("serves the current profile links in body, infobox and notices before the page is rendered again", async () => {
      const linkTo = (href: string) => `<p><a href="${href}">x</a></p>`;
      mockFindUnique.mockResolvedValue({
        renderedView: {
          ...hostile,
          bodyHtml: linkTo("/thinkpages/profile/x"),
          infoboxHtml: linkTo("/projects/ixstates/thinkpages/u/x"),
          noticesHtml: linkTo("/id/@x"),
        },
        htmlSyncedAt: syncedAt,
      });

      const { bundle } = (await loadViewBundle("a"))!;

      expect(bundle.bodyHtml).toBe(linkTo("/dashboard/profile/x"));
      expect(bundle.infoboxHtml).toBe(linkTo("/projects/ixstates/dashboard/profile/x"));
      expect(bundle.noticesHtml).toBe(linkTo("/@x"));
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

    it.each([
      ["a body nested too deep", { bodyHtml: `${"<s>".repeat(6_000)}x` }],
      ["an infobox nested too deep", { infoboxHtml: `${"<div>".repeat(500)}x` }],
      ["a body over the size ceiling", { bodyHtml: `<p>${"a".repeat(500_001)}</p>` }],
    ])("is null, without sanitizing, for %s: the page is rendered again", async (_name, part) => {
      mockFindUnique.mockResolvedValue({
        renderedView: { ...hostile, ...part },
        htmlSyncedAt: syncedAt,
      });
      const started = performance.now();

      await expect(loadViewBundle("a")).resolves.toBeNull();

      expect(performance.now() - started).toBeLessThan(1_000 * TIMING_BUDGET_SCALE);
    });
  });
});

describe("renderFallbackView", () => {
  it("compiles the wikitext in-process, without MediaWiki and without persisting", async () => {
    mockFindUnique.mockResolvedValue({ wikitext: "'''Bold''' text", contentHtml: null, revisions: [] });

    const bundle = await renderFallbackView("a");

    expect(bundle?.bodyHtml).toContain("Bold");
    expect(mockRenderViaMediaWiki).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("serves a page over the compiler's ceiling as its escaped source, and does not compile it", async () => {
    const wikitext = `<script>alert(1)</script> ${"[[ ".repeat(120_000)}`;
    mockFindUnique.mockResolvedValue({ wikitext, contentHtml: null });

    const started = performance.now();
    const bundle = await renderFallbackView("a");

    expect(performance.now() - started).toBeLessThan(5_000 * TIMING_BUDGET_SCALE);
    expect(bundle?.bodyHtml).toContain('class="wikios-fallback-plain"');
    expect(bundle?.bodyHtml).toContain("&lt;script&gt;alert(1)&lt;/script&gt; [[ [[ ");
    expect(bundle?.bodyHtml).not.toContain("<script");
    expect(bundle?.bodyHtml).toContain("too large to format");
  });
  it("is an empty bundle for a page an edit blanked, whatever HTML its earlier text left behind (m4)", async () => {
    mockFindUnique.mockResolvedValue({
      wikitext: "",
      contentHtml: "<p>Old content that must not come back.</p>",
      revisions: [{ byteSize: 0, textDeleted: false }],
    });

    const bundle = await renderFallbackView("a");

    expect(bundle).toEqual(buildViewBundle(""));
    expect(JSON.stringify(bundle)).not.toContain("Old content");
    expect(mockFindUnique.mock.calls[0]?.[0].select.revisions).toEqual({
      where: { parked: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1,
      select: { byteSize: true, textDeleted: true },
    });
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

describe("stale pages", () => {
  const HTML = '<div class="mw-parser-output"><p>Intro.</p></div>';

  let ids = 0;
  const freshIds = (count: number) => Array.from({ length: count }, () => `stale-${++ids}`);

  interface FindManyArgs {
    where: { htmlSyncedAt?: null; id?: { notIn?: string[]; in?: string[] } };
    take?: number;
  }

  /**
   * The articles the fake database holds as stale: never rendered or edited since, and outdated bundles.
   * `scanGate` holds the scan for outdated bundles until it resolves.
   */
  interface StaleArticles {
    unsynced: string[];
    outdated: string[];
    scanGate?: Promise<void>;
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
      if (!where.id) await stale.scanGate;
      const asked = where.id?.in && new Set(where.id.in);
      return list(stale.outdated.filter((id) => !asked || asked.has(id)));
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

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  /** A scan that stays pending until `open()`: a batch that runs meanwhile is known not to have its result. */
  function heldScan() {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return {
      gate,
      open: async () => {
        release();
        await flush();
      },
    };
  }

  const queries = () => mockFindMany.mock.calls.map(([args]) => args as FindManyArgs);
  const unsyncedQueries = () => queries().filter((query) => query.where.htmlSyncedAt === null);
  const checkQueries = () => queries().filter((query) => query.where.id?.in !== undefined);
  const scanQueries = () =>
    queries().filter((query) => query.where.htmlSyncedAt === undefined && !query.where.id);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockRenderViaMediaWiki.mockResolvedValue(HTML);
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
    it("renders nothing in production without the loopback: no query, no failure to back off from", async () => {
      staleArticles(freshIds(2));
      const env = jest.replaceProperty(process, "env", {
        ...process.env,
        NODE_ENV: "production",
        WIKIOS_MEDIAWIKI_INTERNAL_URL: "",
      });
      try {
        await expect(renderStaleBatch()).resolves.toEqual({ rendered: 0, failed: 0 });
      } finally {
        env.restore();
      }

      expect(mockFindMany).not.toHaveBeenCalled();
      expect(mockRenderViaMediaWiki).not.toHaveBeenCalled();
    });
    it("leaves out an article whose render failed, so the rest of the queue is not kept waiting", async () => {
      const [broken, fine] = freshIds(2);
      staleArticles([broken!, fine!]);
      mockRenderViaMediaWiki.mockImplementation(async (_text: string, title: string) =>
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
    /** A fresh copy of the service: the backlog of outdated articles is per process. */
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
      const scan = heldScan();
      database({ unsynced: [], outdated: [o1!, o2!, o3!], scanGate: scan.gate });

      await expect(batch()).resolves.toEqual({ rendered: 0, failed: 0 }); // the scan is still running
      await scan.open();
      await expect(batch()).resolves.toEqual({ rendered: 3, failed: 0 });
      await batch();
      await batch();

      expect(renderedIds()).toEqual([o1, o2, o3]);
      const outdatedBundle = {
        status: "PUBLISHED",
        wikitext: { not: "" },
        renderedView: { path: ["rendererVersion"], not: version },
      };
      expect(scanQueries()).toEqual([
        {
          where: outdatedBundle,
          orderBy: { updatedAt: "asc" },
          take: 100_000,
          select: { id: true },
        },
      ]);
      // the check keeps the outdated condition: a row that was brought up to date is not rendered again
      expect(checkQueries()).toEqual([
        { where: { ...outdatedBundle, id: { in: [o1, o2, o3] } }, select: { id: true } },
      ]);
      expect(unsyncedQueries()).toHaveLength(4);
      for (const query of unsyncedQueries()) {
        expect(query.where).toEqual({
          status: "PUBLISHED",
          htmlSyncedAt: null,
          wikitext: { not: "" },
        });
      }
    });

    it("renders unsynced articles at once, whatever the scan is doing", async () => {
      const { renderStaleBatch: batch } = await freshService();
      const [u1, u2, o1] = freshIds(3);
      const scan = heldScan();
      database({ unsynced: [u1!, u2!], outdated: [o1!], scanGate: scan.gate });

      await expect(batch()).resolves.toEqual({ rendered: 2, failed: 0 }); // returns with the scan pending
      expect(renderedIds()).toEqual([u1, u2]);
      expect(scanQueries()).toHaveLength(1);

      await scan.open();
      await expect(batch()).resolves.toEqual({ rendered: 1, failed: 0 });
      expect(renderedIds()).toEqual([u1, u2, o1]);
    });

    it("renders unsynced articles first, and the outdated ones in the room they leave", async () => {
      const { renderStaleBatch: batch } = await freshService();
      const [u1, u2, o1, o2, o3] = freshIds(5);
      database({ unsynced: [u1!, u2!], outdated: [o1!, o2!, o3!] });

      // the scan resolved while the unsynced articles rendered, so this batch already uses it
      await expect(batch(4)).resolves.toEqual({ rendered: 4, failed: 0 });

      expect(renderedIds()).toEqual([u1, u2, o1, o2]);
    });
    it("starts no render of the backlog once the time budget is spent", async () => {
      const { renderStaleBatch: batch } = await freshService();
      const scan = heldScan();
      database({ unsynced: [], outdated: freshIds(10), scanGate: scan.gate });
      await batch();
      await scan.open();
      const now = jest.spyOn(Date, "now");
      let tick = 0;
      // Every call to Date.now() moves the clock on by 20 s: the budget (45 s) is gone after two renders.
      now.mockImplementation(() => 1_000_000 + 20_000 * tick++);

      const result = await batch();

      expect(result.rendered).toBeGreaterThan(0);
      expect(result.rendered).toBeLessThan(10);
      now.mockRestore();
    });
    it("keeps a failed article in the backlog, behind the usual backoff", async () => {
      const { renderStaleBatch: batch } = await freshService();
      const [broken, fine] = freshIds(2);
      const scan = heldScan();
      database({ unsynced: [], outdated: [broken!, fine!], scanGate: scan.gate });
      mockRenderViaMediaWiki.mockImplementation(async (_text: string, title: string) =>
        title === `Title of ${broken}` ? null : HTML
      );
      await batch();
      await scan.open();
      const attempts = () => mockFindUnique.mock.calls.filter(([a]) => a.where.id === broken).length;

      await expect(batch()).resolves.toEqual({ rendered: 1, failed: 1 });
      await expect(batch()).resolves.toEqual({ rendered: 0, failed: 0 }); // backing off: left alone
      expect(attempts()).toBe(1);
      expect(scanQueries()).toHaveLength(1);

      const later = jest.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * 60_000);
      try {
        await expect(batch()).resolves.toEqual({ rendered: 0, failed: 1 }); // its turn again, no rescan
      } finally {
        later.mockRestore();
      }
      expect(attempts()).toBe(2);
      expect(scanQueries()).toHaveLength(1);
    });
  });
});
