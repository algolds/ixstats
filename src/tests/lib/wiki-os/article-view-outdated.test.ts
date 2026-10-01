/** @jest-environment node */
/**
 * A bundle that an older renderer version built (a bumped transform, a changed sanitizer) is served at
 * once, re-sanitized and marked stale, while one background render replaces it: the reader never waits
 * for it. An article with no usable bundle still waits (bounded) for its render, then falls back. The
 * real render-service and sanitizer run; only the database, MediaWiki and the importer are faked.
 */
const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
const mockFindArticleForView = jest.fn();
const mockRenderViaMediaWiki = jest.fn();
const mockEnsureRendered = jest.fn();
const mockRenderInBackground = jest.fn();
const mockSanitizeHook = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  ArticleRepository: { findArticleForView: (...a: unknown[]) => mockFindArticleForView(...a) },
}));
// `mockRenderViaMediaWiki` answers with the HTML (or null); a render reports nothing else about the page.
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
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({ syncSinglePage: jest.fn() }));
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
// The real service, with the two calls the reader makes into the render queue observable.
jest.mock("~/lib/wiki-os/services/render-service", () => {
  const actual = jest.requireActual<typeof import("~/lib/wiki-os/services/render-service")>(
    "~/lib/wiki-os/services/render-service"
  );
  return {
    ...actual,
    ensureRendered: (...a: Parameters<typeof actual.ensureRendered>) => {
      mockEnsureRendered(...a);
      return actual.ensureRendered(...a);
    },
    renderInBackground: (...a: Parameters<typeof actual.renderInBackground>) => {
      mockRenderInBackground(...a);
      return actual.renderInBackground(...a);
    },
  };
});

import { getArticleView } from "~/lib/wiki-os/services/article-view-service";
import { buildViewBundle } from "~/lib/wiki-os/services/render-service";

const SYNCED = new Date("2026-09-30T10:00:00Z");
const RENDERED_LATER = new Date("2026-10-01T08:00:00Z");
const PARSED = '<div class="mw-parser-output"><p>Fresh body.</p></div>';
const HOSTILE_BUNDLE = {
  bodyHtml: '<p>Old body.</p><script>alert(1)</script><img src="x" onerror="alert(2)">',
  infoboxHtml: '<table class="infobox"><tr><td onclick="alert(3)">Box</td></tr></table>',
  noticesHtml: '<div class="hatnote"><script>alert(4)</script>Note</div>',
  toc: [{ id: "History", text: "History", level: 2 }],
  rendererVersion: "2:oldfingerprint",
};

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

let ids = 0;

/**
 * An article the reader opens: its head (what the title lookup reports, `htmlSyncedAt` included) and the
 * row that both the bundle read and the render's own read answer from. Both can change between calls.
 */
function article(htmlSyncedAt: Date | null, renderedView: object | null) {
  const id = `outdated-${++ids}`;
  const row = { renderedView, htmlSyncedAt };
  const head = {
    id,
    title: "Pelaxia",
    status: "PUBLISHED",
    htmlSyncedAt,
    lastModified: new Date("2026-09-29T00:00:00Z"),
    categories: [],
  };
  mockFindArticleForView.mockResolvedValue(head);
  mockFindUnique.mockImplementation(async () => ({
    ...row,
    title: "Pelaxia",
    source: "ixwiki",
    wikitext: "Pelaxia is a country.",
    contentHtml: null,
  }));
  return { id, row, head };
}

const read = () => getArticleView("Pelaxia", async () => null);

beforeEach(() => {
  jest.clearAllMocks();
  mockSanitizeHook.mockReset();
  mockUpdateMany.mockResolvedValue({ count: 1 });
});

describe("an outdated bundle", () => {
  it("is served at once, without waiting for any render, as a stale view", async () => {
    article(SYNCED, HOSTILE_BUNDLE);
    const mediaWiki = deferred<null>();
    mockRenderViaMediaWiki.mockReturnValue(mediaWiki.promise); // a render that never finishes in time

    const view = await read();

    expect(view).toMatchObject({ stale: true, renderQuality: "rendered" });
    expect(view?.contentHtml).toContain("Old body.");
    expect(view?.toc).toEqual(HOSTILE_BUNDLE.toc);
    expect(mockEnsureRendered).not.toHaveBeenCalled();
    mediaWiki.resolve(null);
    await flush();
  });

  it("is re-sanitized: no script and no event handler reaches the reader", async () => {
    article(SYNCED, HOSTILE_BUNDLE);
    mockRenderViaMediaWiki.mockResolvedValue(null);

    const view = await read();

    for (const html of [view?.contentHtml, view?.infoboxHtml, view?.noticesHtml]) {
      expect(html).not.toMatch(/<script|onerror|onclick|alert\(/i);
    }
    expect(view?.infoboxHtml).toContain("Box");
    expect(view?.noticesHtml).toContain("Note");
  });

  it("kicks exactly one background render, and not again while its stale view is kept", async () => {
    const { id } = article(SYNCED, HOSTILE_BUNDLE);
    const mediaWiki = deferred<string | null>();
    mockRenderViaMediaWiki.mockReturnValue(mediaWiki.promise);

    await read();
    await read();
    await read();
    await flush();

    expect(mockRenderInBackground).toHaveBeenCalledTimes(1);
    expect(mockRenderInBackground).toHaveBeenCalledWith(id);
    expect(mockRenderViaMediaWiki).toHaveBeenCalledTimes(1);
    // the re-sanitized view came from the cache twice: the row was read once for the bundle
    // and once by the render itself
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
    mediaWiki.resolve(PARSED);
    await flush();
  });

  it("is replaced by the fresh bundle as soon as the render has landed", async () => {
    const { row, head } = article(SYNCED, HOSTILE_BUNDLE);
    mockRenderViaMediaWiki.mockResolvedValue(null);
    await expect(read()).resolves.toMatchObject({ stale: true });

    // the render stored a current bundle and a new htmlSyncedAt, which the next lookup of the head sees
    row.renderedView = buildViewBundle(PARSED);
    row.htmlSyncedAt = RENDERED_LATER;
    head.htmlSyncedAt = RENDERED_LATER;

    const view = await read();

    expect(view).toMatchObject({ stale: false, renderQuality: "rendered" });
    expect(view?.contentHtml).toContain("Fresh body.");
    expect(mockRenderInBackground).toHaveBeenCalledTimes(1);
  });

  it("after a wait for an edited article's render that did not land, is served stale instead of the fallback", async () => {
    // htmlSyncedAt is null: the text changed since, so the reader still waits for the new render first
    article(null, HOSTILE_BUNDLE);
    mockRenderViaMediaWiki.mockResolvedValue(null);

    const view = await read();

    expect(mockEnsureRendered).toHaveBeenCalledWith(expect.any(String), { waitMs: 6_000 });
    expect(mockRenderInBackground).not.toHaveBeenCalled();
    expect(view).toMatchObject({ stale: true, renderQuality: "rendered" });
    expect(view?.contentHtml).toContain("Old body.");
    expect(view?.contentHtml).not.toMatch(/<script|onerror/i);
  });
});

describe("an outdated bundle the sanitizer throws on", () => {
  it("is treated as no bundle: the reader waits for the render, then gets the fallback, not an error", async () => {
    article(SYNCED, { ...HOSTILE_BUNDLE, bodyHtml: "<p>pathological</p>" });
    mockSanitizeHook.mockImplementation((html: string) => {
      if (html.includes("pathological")) throw new Error("pathological markup");
    });
    mockRenderViaMediaWiki.mockResolvedValue(null);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const view = await read();

    expect(mockEnsureRendered).toHaveBeenCalledWith(expect.any(String), { waitMs: 6_000 });
    expect(view).toMatchObject({ stale: true, renderQuality: "fallback" });
    warn.mockRestore();
  });
});

describe("a bundle of the current renderer version", () => {
  it("is served fresh and cached, with no wait and no render", async () => {
    article(SYNCED, buildViewBundle(PARSED));

    const view = await read();
    await read();

    expect(view).toMatchObject({ stale: false, renderQuality: "rendered" });
    expect(view?.contentHtml).toContain("Fresh body.");
    expect(mockEnsureRendered).not.toHaveBeenCalled();
    expect(mockRenderInBackground).not.toHaveBeenCalled();
    expect(mockRenderViaMediaWiki).not.toHaveBeenCalled();
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe("an article with no usable bundle", () => {
  it.each([
    ["a malformed bundle", { bodyHtml: 5 }],
    ["no bundle at all", null],
  ])("with %s waits for its render, then falls back", async (_name, renderedView) => {
    article(SYNCED, renderedView);
    const mediaWiki = deferred<string | null>();
    mockRenderViaMediaWiki.mockReturnValue(mediaWiki.promise);

    let settled = false;
    const reading = read().then((view) => {
      settled = true;
      return view;
    });
    await flush();
    expect(settled).toBe(false); // the reader is held while MediaWiki works
    expect(mockEnsureRendered).toHaveBeenCalledWith(expect.any(String), { waitMs: 6_000 });

    mediaWiki.resolve(null); // MediaWiki failed
    const view = await reading;

    expect(view).toMatchObject({ stale: true, renderQuality: "fallback" });
    expect(view?.contentHtml).toContain("Pelaxia");
    expect(mockRenderInBackground).not.toHaveBeenCalled();
  });
});
