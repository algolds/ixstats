/** @jest-environment node */
/**
 * Plan 404 review, blocker: template chips were filled in by regex surgery on already-sanitized
 * HTML. The sanitizer's serializer leaves `<` and `>` unescaped inside attribute values, so
 * `[[Template:MyCountry:x|<span title="</a><img src=x onerror=alert(1)>">y</span>]]` let the regex
 * end a link inside an attribute and publish the rest of that attribute as live markup. These tests
 * run the REAL sanitizer and the real render/serve code: a payload must never come out as markup.
 */
const mockFindUnique = jest.fn();
const mockFindArticleForView = jest.fn();

jest.mock("~/server/db", () => ({
  db: { wikiArticle: { findUnique: (...a: unknown[]) => mockFindUnique(...a) } },
}));
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  ArticleRepository: { findArticleForView: (...a: unknown[]) => mockFindArticleForView(...a) },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  renderArticleViaMediaWiki: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({ syncSinglePage: jest.fn() }));

import { JSDOM } from "jsdom";
import { getArticleView } from "~/lib/wiki-os/services/article-view-service";
import { buildViewBundle } from "~/lib/wiki-os/services/render-service";
import { registerTemplateProvider } from "~/lib/wiki-os/templates/template-resolver";

const SYNCED = new Date("2026-09-30T10:00:00Z");
let ids = 0;

/** Serve `mwHtml` (what MediaWiki rendered) through the real pipeline, for a viewer the provider answers. */
async function serve(mwHtml: string, resolved: Record<string, string> = { "MyCountry:x": "123" }) {
  const id = `chip-${++ids}`;
  mockFindArticleForView.mockResolvedValue({
    id,
    title: "Payload",
    htmlSyncedAt: SYNCED,
    lastModified: null,
    categories: [],
  });
  mockFindUnique.mockResolvedValue({ renderedView: buildViewBundle(mwHtml), htmlSyncedAt: SYNCED });
  const unregister = registerTemplateProvider({
    name: "test",
    canHandle: () => true,
    resolve: async (keys) =>
      new Map(
        keys.flatMap((k) =>
          resolved[k.key] === undefined ? [] : [[k.key, { key: k.key, value: resolved[k.key]! }]]
        )
      ),
  });
  try {
    const view = await getArticleView("Payload", async () => null);
    return view!;
  } finally {
    unregister();
  }
}

/** Every element of the served HTML, as a browser would parse it. */
function elementsOf(html: string): Element[] {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  return Array.from(document.body.querySelectorAll("*"));
}

function expectNoInjectedMarkup(html: string) {
  const elements = elementsOf(html);
  expect(elements.filter((el) => el.tagName === "IMG")).toHaveLength(0);
  expect(elements.filter((el) => el.hasAttribute("onerror"))).toHaveLength(0);
  // (Text that merely looks like markup inside an attribute value is inert: what counts is the parsed DOM.)
}

describe("template chips cannot be used to inject markup (plan 404 review)", () => {
  it("survives the reviewer's payload as MediaWiki renders it (entity-escaped attribute)", async () => {
    const view = await serve(
      '<p>Pop <a href="/wiki/Template:MyCountry:x" title="Template:MyCountry:x"><span title="&lt;/a&gt;&lt;img src=x onerror=alert(1)&gt;">y</span></a> end</p>'
    );

    expectNoInjectedMarkup(view.contentHtml);
    expect(view.contentHtml).toContain("wikios-stat-resolved");
    expect(view.contentHtml).toContain("123");
    expect(view.contentHtml).toContain("end");
  });

  it("survives the payload with raw angle brackets in the attribute", async () => {
    const view = await serve(
      '<p><a href="/wiki/Template:MyCountry:x"><span title="</a><img src=x onerror=alert(1)>">y</span></a></p>'
    );

    expectNoInjectedMarkup(view.contentHtml);
    expect(view.contentHtml).toContain("123");
  });

  it("survives the payload in the infobox and the notices too", async () => {
    const payload =
      '<a href="/wiki/Template:MyCountry:x"><span title="</a><img src=x onerror=alert(1)>">y</span></a>';
    const view = await serve(
      `<div class="hatnote">${payload}</div><table class="infobox"><tr><td>${payload}</td></tr></table><p>Body ${payload}</p>`
    );

    for (const part of [view.contentHtml, view.infoboxHtml, view.noticesHtml]) {
      expect(part).not.toBeNull();
      expectNoInjectedMarkup(part!);
    }
  });

  it("survives the payload when the key is not resolved (the client placeholder, never the link text)", async () => {
    const view = await serve(
      '<p><a href="/wiki/Template:MyCountry:x"><span title="</a><img src=x onerror=alert(1)>">y</span></a></p>',
      {}
    );

    expectNoInjectedMarkup(view.contentHtml);
    expect(view.contentHtml).toContain('class="wikios-stat-placeholder"');
    expect(view.contentHtml).toContain('data-key="MyCountry:x"');
  });

  it("does not treat a marker written inside an attribute or as text as a marker", async () => {
    const view = await serve(
      '<p><span title=\'<span data-wikios-chip="MyCountry:x"></span><img src=x onerror=alert(1)>\'>z</span> &lt;span data-wikios-chip="MyCountry:x"&gt;&lt;/span&gt;</p>'
    );

    expectNoInjectedMarkup(view.contentHtml);
    expect(view.contentHtml).not.toContain("wikios-stat-resolved");
    expect(view.contentHtml).not.toContain("123");
  });

  it("fills a marker that really is an element", async () => {
    const view = await serve('<p><span data-wikios-chip="MyCountry:x"></span></p>');

    expect(view.contentHtml).toContain("wikios-stat-resolved");
    expect(view.contentHtml).toContain("123");
  });

  it("escapes a value the provider hands back", async () => {
    const view = await serve('<p><a href="/wiki/Template:MyCountry:x">y</a></p>', {
      "MyCountry:x": '<img src=x onerror=alert(1)>"',
    });

    expectNoInjectedMarkup(view.contentHtml);
    expect(view.contentHtml).toContain("&lt;img");
  });
});
