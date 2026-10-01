/** @jest-environment node */
/**
 * Plan 412 step 5: one old revision rendered for `?oldid=` without persisting, in an in-process LRU
 * of at most 100 entries keyed by revision reference.
 */
const mockGetRevision = jest.fn();
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getRevisionWikitext: (...a: unknown[]) => mockGetRevision(...a),
}));
const mockRender = jest.fn();
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  // `mockRender` answers with the HTML (or null): a render of an old revision reports nothing about the page.
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
jest.mock("~/lib/utils/sanitize-html", () => ({
  __esModule: true,
  sanitizeWikiArticleHtml: jest.fn((html: string) => html),
  wikiArticleSanitizerFingerprint: () => "test",
}));
// The render budget is a real limiter in production (see outbound-limiter.test.ts); here it is a spy.
const mockLimiterRun = jest.fn((task: () => Promise<unknown>) => task());
jest.mock("~/lib/wiki-os/services/outbound-limiter", () => ({
  ...jest.requireActual("~/lib/wiki-os/services/outbound-limiter"),
  OutboundLimiter: class {
    run(task: () => Promise<unknown>) {
      return mockLimiterRun(task);
    }
  },
}));
// The render service reads the database for stored bundles; only its pure transform is used here.
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));

import {
  getRevisionView,
  MAX_CACHED_REVISIONS,
} from "~/lib/wiki-os/services/revision-view-service";
import { ThrottledError } from "~/lib/wiki-os/services/outbound-limiter";

const everyone = async () => true;

const revision = (title = "Aurelia", wikitext: string | null = "'''Aurelia''' is a country.") => ({
  wikitext,
  title,
  source: "ixwiki",
  timestamp: "2026-01-01T00:00:00.000Z",
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLimiterRun.mockImplementation((task) => task());
  mockGetRevision.mockResolvedValue(revision());
  mockRender.mockResolvedValue("<p>Aurelia is a country.</p>");
});

describe("getRevisionView", () => {
  it("renders the revision's own wikitext through MediaWiki and builds the reader's view of it", async () => {
    const result = await getRevisionView("r-render", everyone);

    expect(mockGetRevision).toHaveBeenCalledWith("r-render");
    expect(mockRender).toHaveBeenCalledWith("'''Aurelia''' is a country.", "Aurelia");
    expect(result).toMatchObject({
      status: "ok",
      view: {
        title: "Aurelia",
        timestamp: "2026-01-01T00:00:00.000Z",
        contentHtml: "<p>Aurelia is a country.</p>",
        renderQuality: "rendered",
      },
    });
  });

  it("keeps the rendered revision: the second request does not touch the database or MediaWiki", async () => {
    await getRevisionView("r-cached", everyone);
    await getRevisionView("r-cached", everyone);

    expect(mockGetRevision).toHaveBeenCalledTimes(1);
    expect(mockRender).toHaveBeenCalledTimes(1);
  });

  it("shares one render between concurrent requests for the same revision", async () => {
    const [a, b] = await Promise.all([
      getRevisionView("r-flight", everyone),
      getRevisionView("r-flight", everyone),
    ]);

    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("keeps at most 100 revisions, least recently used out first", async () => {
    for (let i = 0; i < MAX_CACHED_REVISIONS; i++) await getRevisionView(`lru-${i}`, everyone);
    await getRevisionView("lru-0", everyone); // used again: now the newest
    await getRevisionView("lru-overflow", everyone); // 101st: the oldest unused (lru-1) goes
    mockGetRevision.mockClear();

    await getRevisionView("lru-0", everyone);
    expect(mockGetRevision).not.toHaveBeenCalled(); // still cached
    await getRevisionView("lru-1", everyone);
    expect(mockGetRevision).toHaveBeenCalledTimes(1); // was dropped
  });

  it("compiles the wikitext locally when MediaWiki cannot render it, and does not keep that", async () => {
    mockRender.mockResolvedValue(null);
    const first = await getRevisionView("r-fallback", everyone);

    expect(first).toMatchObject({ status: "ok", view: { renderQuality: "fallback" } });
    await getRevisionView("r-fallback", everyone);
    expect(mockGetRevision).toHaveBeenCalledTimes(2); // asked again: MediaWiki may be back
  });

  it("is missing, and never rendered, for a caller who may not see the revision's page; cached or not (plan 409)", async () => {
    const nobody = jest.fn(async () => false);

    await expect(getRevisionView("r-hidden-1", nobody)).resolves.toEqual({ status: "missing" });
    expect(nobody).toHaveBeenCalledWith("Aurelia");
    expect(mockRender).not.toHaveBeenCalled();

    // Once the page is deleted, a view kept from before is not served either.
    await getRevisionView("r-hidden-2", everyone);
    mockRender.mockClear();
    mockGetRevision.mockClear();
    await expect(getRevisionView("r-hidden-2", nobody)).resolves.toEqual({ status: "missing" });
    expect(mockGetRevision).not.toHaveBeenCalled();
    await expect(getRevisionView("r-hidden-2", everyone)).resolves.toMatchObject({ status: "ok" });
  });

  it("is missing for an unknown revision and unavailable for one whose text was never imported", async () => {
    mockGetRevision.mockResolvedValue(null);
    await expect(getRevisionView("r-missing", everyone)).resolves.toEqual({ status: "missing" });

    mockGetRevision.mockResolvedValue(revision("Aurelia", null));
    await expect(getRevisionView("r-hidden", everyone)).resolves.toEqual({
      status: "text-unavailable",
    });
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("turns a template chip into the stat placeholder the client resolves, never a viewer's value", async () => {
    mockRender.mockResolvedValue(
      '<p>GDP: <a href="/wiki/Template:CountryData:Aurelia:gdp" title="x">gdp</a></p>'
    );
    const result = await getRevisionView("r-chip", everyone);

    expect(result.status === "ok" && result.view.contentHtml).toBe(
      '<p>GDP: <span class="wikios-stat-placeholder" data-key="CountryData:Aurelia:gdp"></span></p>'
    );
  });

  it("refuses with ThrottledError past the render budget, and remembers nothing then", async () => {
    mockLimiterRun.mockRejectedValueOnce(new ThrottledError("Rendering old revisions"));
    await expect(getRevisionView("r-budget", everyone)).rejects.toBeInstanceOf(ThrottledError);
    expect(mockRender).not.toHaveBeenCalled();

    // The same revision is rendered once the budget allows, not answered from a failed attempt.
    await expect(getRevisionView("r-budget", everyone)).resolves.toMatchObject({ status: "ok" });
    expect(mockRender).toHaveBeenCalledTimes(1);
  });
});
