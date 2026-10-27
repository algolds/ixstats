/** @jest-environment jsdom */
/**
 * The sanitizer table: what reaches a reader's DOM from page HTML, template chips, placeholders, the editor's images, the
 * featured-article hero, search snippets, the diff viewer, image search and forum wikitext. Each row is a payload a
 * reviewer or an incident found (an attribute that ends early, a label that breaks out of its link, a marker written as
 * text, a closing heading tag in an attribute, a stripped switch that reassembles a subst) and what must come out:
 * escaped text, no handler, no script, nothing loaded while parsing.
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

import "~/tests/helpers/node-text-encoding";
import { JSDOM } from "jsdom";
import { getArticleView } from "~/lib/wiki-os/services/article-view-service";
import { buildViewBundle } from "~/lib/wiki-os/services/render-service";
import { registerTemplateProvider } from "~/lib/wiki-os/templates/template-resolver";
import { extractStatKeys, injectPlaceholderElements } from "~/components/wiki-os/reader/placeholder-dom";
import { appendSectionEditLinks } from "~/lib/wiki-os/transformers/html-transformer";
import { fixEditorImageUrls } from "~/lib/wiki-os/transformers/fix-editor-images";
import { extractFeaturedArticle } from "~/lib/wiki-os/main-page/featured-article";
import { render, screen } from "@testing-library/react";
import { HighlightedSnippet } from "~/components/wiki-os/shared/HighlightedSnippet";
import { DiffViewer } from "~/components/diff-viewer";
import { diffWikitext } from "~/lib/wiki-os/transformers/wikitext-diff";
import { guardWikitext, MAX_POST_WIKITEXT } from "~/lib/thinkpages-forum/wikitext-guards";

describe("template chips", () => {
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
});

describe("placeholders", () => {
  /** What a browser makes of `html` once it is put in the page. */
  function mount(html: string): HTMLElement {
    const container = document.createElement("div");
    container.innerHTML = html;
    return container;
  }

  function expectInert(container: HTMLElement) {
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll("[onerror]")).toHaveLength(0);
    expect(container.querySelectorAll("script")).toHaveLength(0);
  }

  describe("injectPlaceholderElements", () => {
    it("does not let a label break out of its link (the reviewer's payload)", () => {
      const html = injectPlaceholderElements(
        '<p><a href="/wiki/Coords:1,2"><span title="</a><img src=x onerror=alert(1)>">y</span></a> tail</p>'
      );
      const container = mount(html);

      expectInert(container);
      expect(container.querySelector(".wikios-coords-placeholder")?.textContent).toBe("y");
      expect(container.textContent).toBe("y tail");
    });

    it("does not let a map embed's options or a stat link break out either", () => {
      const payload = '<span title="</a><img src=x onerror=alert(1)>">y</span>';
      const container = mount(
        injectPlaceholderElements(
          `<p><a href="/wiki/MapEmbed:3,4,5">${payload}</a><a href="/wiki/Template:MyCountry:gdp">${payload}</a></p>`
        )
      );

      expectInert(container);
      expect(
        container.querySelector(".wikios-map-embed-placeholder")?.getAttribute("data-options")
      ).toBe("y");
      expect(container.querySelector(".wikios-stat-placeholder")?.getAttribute("data-key")).toBe(
        "MyCountry:gdp"
      );
    });

    it("does not let a quote in a link or a label add an attribute", () => {
      const container = mount(
        injectPlaceholderElements(
          '<a href="/wiki/Coords:1%22%20onmouseover%3D%22alert(1),2">say &quot;hi&quot; " x=y</a>'
        )
      );

      const placeholder = container.querySelector(".wikios-coords-placeholder")!;
      expect(
        Array.from(placeholder.attributes)
          .map((a) => a.name)
          .sort()
      ).toEqual(["class", "data-label", "data-lat", "data-lng", "data-zoom"]);
      expect(placeholder.getAttribute("data-label")).toBe('say "hi" " x=y');
    });
    it("leaves ordinary links and other templates alone, and removes iframes", () => {
      const html =
        '<p><a href="/wiki/Foo" class="x">Foo</a> <a href="/wiki/Template:Other:x">T</a></p><iframe src="https://evil.example"></iframe>';
      const out = injectPlaceholderElements(html);

      expect(out).toBe(
        '<p><a href="/wiki/Foo" class="x">Foo</a> <a href="/wiki/Template:Other:x">T</a></p>'
      );
    });
    it("does not load or run anything while it parses", () => {
      const loads = jest.fn();
      const probe = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
      Object.defineProperty(HTMLImageElement.prototype, "src", {
        configurable: true,
        set: loads,
        get: () => "",
      });

      injectPlaceholderElements(
        '<img src="https://tracker.example/x.png" onerror="alert(1)"><a href="/wiki/Coords:1,2">x</a>'
      );

      expect(loads).not.toHaveBeenCalled();
      if (probe) Object.defineProperty(HTMLImageElement.prototype, "src", probe);
    });
  });

  /**
   * The links added to a parsed fragment, as HTML. The reader adds them to its live article instead
   * (plan 413); the DOM-only way of doing it is what these cases are about.
   */
  function addSectionEditLinks(html: string, slug: string): string {
    const template = document.createElement("template");
    template.innerHTML = html;
    appendSectionEditLinks(template.content, slug);
    return template.innerHTML;
  }

  describe("parsing stays inert (plan 404 review)", () => {
    it("makes and serializes every node in the template's own document, never in the live page", () => {
      const createElement = jest.spyOn(document, "createElement");
      const createFragment = jest.spyOn(document, "createDocumentFragment");
      const createWalker = jest.spyOn(document, "createTreeWalker");
      const adopt = jest.spyOn(document, "adoptNode");
      const importNode = jest.spyOn(document, "importNode");

      try {
        const out = injectPlaceholderElements(
          '<img src="x" onerror="alert(1)"><a href="/wiki/Coords:1,2">x</a> {{MyCountry:gdp}} [[MapEmbed:1,2,3]]'
        );
        addSectionEditLinks("<h2>Head</h2>", "Foo");
        extractStatKeys("<p>{{MyCountry:gdp}}</p>");

        expect(out).toContain("wikios-coords-placeholder");
        // The only node the live document makes is the <template> that holds the parse.
        expect(createElement.mock.calls.map(([tag]) => tag)).toEqual([
          "template",
          "template",
          "template",
        ]);
        expect(createFragment).not.toHaveBeenCalled();
        expect(createWalker).not.toHaveBeenCalled();
        expect(adopt).not.toHaveBeenCalled();
        expect(importNode).not.toHaveBeenCalled();
      } finally {
        jest.restoreAllMocks();
      }
    });

    it("keeps an image in the fragment from ever being attached to the live page", () => {
      const before = document.querySelectorAll("img").length;

      injectPlaceholderElements('<img src="https://tracker.example/x.png" onerror="alert(1)">');

      expect(document.querySelectorAll("img")).toHaveLength(before);
    });
  });
  describe("addSectionEditLinks", () => {
    it("does not write the link into an attribute that holds a closing heading tag (the same class of bug)", () => {
      const html =
        '<h2 id="Geo"><span title="</h2><img src=x onerror=alert(1)>">Geography</span></h2><p>Body</p>';
      const container = mount(addSectionEditLinks(html, "Foo"));

      expectInert(container);
      const links = container.querySelectorAll(".wikios-section-edit-link");
      expect(links).toHaveLength(1);
      expect(links[0]?.closest("h2")).not.toBeNull();
      expect(container.querySelector("h2 span")?.getAttribute("title")).toBe(
        "</h2><img src=x onerror=alert(1)>"
      );
    });

    it("puts a heading's text in the link and its label, escaped by the DOM", () => {
      const container = mount(
        addSectionEditLinks('<h3 id="x">Rock &amp; "Roll" &lt;live&gt;</h3>', "Foo_Bar")
      );

      const link = container.querySelector<HTMLAnchorElement>(".wikios-section-edit-link")!;
      expect(link.getAttribute("aria-label")).toBe('Edit section: Rock & "Roll" <live>');
      expect(link.getAttribute("href")).toContain(
        `/wiki/Foo_Bar?action=edit&section=${encodeURIComponent('Rock & "Roll" <live>')}`
      );
      expect(link.textContent).toBe("Edit");
    });
  });
});

describe("the editor's images", () => {

  function mount(html: string): HTMLElement {
    const container = document.createElement("div");
    container.innerHTML = html;
    return container;
  }

  describe("fixEditorImageUrls", () => {
    it("adds no-referrer to every image that has no referrer policy, and leaves one that has", () => {
      const out = mount(
        fixEditorImageUrls('<img src="a.png"><img src="b.png" referrerpolicy="origin">')
      );

      expect(
        Array.from(out.querySelectorAll("img")).map((i) => i.getAttribute("referrerpolicy"))
      ).toEqual(["no-referrer", "origin"]);
    });
    it("does not turn text inside an attribute value into attributes (the same class of bug)", () => {
      const out = mount(
        fixEditorImageUrls(
          '<span title="<img src=x onerror=alert(1) x=">hover</span><img src="/images/a.png">'
        )
      );

      expect(out.querySelectorAll("[onerror]")).toHaveLength(0);
      expect(out.querySelectorAll("img")).toHaveLength(1);
      expect(out.querySelector("span")?.getAttribute("title")).toBe("<img src=x onerror=alert(1) x=");
      expect(out.querySelector("span")?.attributes).toHaveLength(1);
    });

    it("does not load or run anything while it parses", () => {
      const before = document.querySelectorAll("img").length;

      fixEditorImageUrls('<img src="/images/a.png" onerror="alert(1)">');

      expect(document.querySelectorAll("img")).toHaveLength(before);
    });
  });
});

describe("the featured-article hero", () => {
  function mount(html: string | null): HTMLElement {
    const container = document.createElement("div");
    container.innerHTML = html ?? "";
    return container;
  }

  function expectInert(container: HTMLElement) {
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll("[onerror]")).toHaveLength(0);
    expect(container.querySelectorAll("script")).toHaveLength(0);
  }

  const PAYLOAD = '<span title="</div><img src=x onerror=alert(1)>">y</span>';

  describe("extractFeaturedArticle", () => {
    it("does not let a byline's attribute end the cut early (the reviewer's payload)", () => {
      const html =
        '<div id="featured_article" class="card"><div class="byline">by ' +
        PAYLOAD +
        "</div><p>Body text</p></div>";

      const card = mount(extractFeaturedArticle(html));

      expectInert(card);
      expect(card.textContent).toContain("Body text");
      expect(card.textContent).not.toContain("by y");
    });

    it("does not let a payload in the card cut the card short when counting its end", () => {
      const html =
        '<div id="featured_article"><p>Lead ' +
        PAYLOAD +
        '</p></div><div id="rest"><img src=x onerror=alert(2)><script>alert(3)</script></div>';

      const card = mount(extractFeaturedArticle(html));

      expectInert(card);
      expect(card.textContent).toContain("Lead");
      expect(card.textContent).not.toContain("alert");
    });

    it("does not let a payload in a p byline or a card-byline either", () => {
      const html =
        '<div class="card"><p class="byline">' +
        PAYLOAD +
        '</p><div class="card-byline">' +
        PAYLOAD +
        "</div><p>Kept</p></div>";

      const card = mount(extractFeaturedArticle(html));

      expectInert(card);
      expect(card.textContent).toBe("Kept");
    });

    it("sanitizes what it returns: script, handlers and javascript: links never reach the hero", () => {
      const html =
        '<div id="mp-tfa"><p onclick="steal()">Hi <a href="javascript:alert(1)">link</a></p><script>alert(2)</script><img src=x onerror="alert(3)"></div>';

      const out = extractFeaturedArticle(html)!;

      expect(out).not.toMatch(/<script|onclick|onerror|javascript:/i);
      expect(out).toContain("Hi");
    });
  });
});

describe("search snippets", () => {
  describe("HighlightedSnippet", () => {
    it("is the plain text without ranges, and never turns the text into markup", () => {
      const hostile = "<img src=x onerror=alert(1)> <b>kingdom</b>";
      const { container, rerender } = render(<HighlightedSnippet text={hostile} />);
      expect(container.textContent).toBe(hostile);
      expect(container.querySelector("img, b, mark")).toBeNull();

      const start = hostile.indexOf("kingdom");
      rerender(<HighlightedSnippet text={hostile} ranges={[[start, start + 7]]} />);
      expect(container.querySelector("img, b")).toBeNull();
      expect(container.querySelector("mark")?.textContent).toBe("kingdom");
    });

    it("skips a range that overlaps the previous one or lies outside the text", () => {
      const { container } = render(
        <HighlightedSnippet
          text="abcdef"
          ranges={[
            [1, 3],
            [2, 4],
            [5, 99],
            [4, 4],
          ]}
        />
      );

      expect([...container.querySelectorAll("mark")].map((m) => m.textContent)).toEqual(["bc"]);
      expect(container.textContent).toBe("abcdef");
    });
  });
});

describe("the diff viewer", () => {
  describe("DiffViewer with server hunks", () => {
    it("marks changed words in a <mark>, from ranges, and never renders line text as HTML", () => {
      const { hunks } = diffWikitext("<b>hi</b> brown fox", "<b>hi</b> red fox");

      const { container } = render(<DiffViewer hunks={hunks} layout="unified" />);

      expect([...container.querySelectorAll("mark")].map((m) => m.textContent)).toEqual([
        "brown",
        "red",
      ]);
      expect(container.querySelector("b")).toBeNull();
      expect(container.textContent).toContain("<b>hi</b>");
    });
    it("refuses to diff a text over 2 MB in the browser", () => {
      render(<DiffViewer oldCode="" newCode={"x".repeat(2 * 1024 * 1024 + 1)} />);

      expect(screen.getByText(/too large to display/)).toBeInTheDocument();
    });
  });
});

describe("forum wikitext", () => {
  describe("guardWikitext", () => {
    it("refuses a subst or signature that a stripped switch would reassemble", () => {
      expect(() => guardWikitext("{{sub__NOTOC__st:X}}")).toThrow(/subst/i);
      expect(() => guardWikitext("~~__NOTOC__~~")).toThrow(/Signatures/);
    });
    it("strips a category that a stripped switch would reassemble", () => {
      const out = guardWikitext("Text [[Categ__A__ory:Foo]] end");
      expect(out).not.toMatch(/Category:|__A__/);
      expect(out).toContain("Text");
    });
    it("refuses posts over the cap", () => {
      expect(() => guardWikitext("a".repeat(MAX_POST_WIKITEXT + 1))).toThrow(/at most/);
    });
    it("keeps category links written as [[:Category:Foo]] (a link, not a categorisation)", () => {
      expect(guardWikitext("See [[:Category:Foo]]")).toContain("[[:Category:Foo]]");
    });
  });
});
