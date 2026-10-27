import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { api } from "~/trpc/react";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { leanEnvironment, leanMarker, stashLeanArticle } from "~/lib/wiki-os/lean-article";

const mockToggleMargin = jest.fn();
const mockSetWikiPage = jest.fn();
const mockMargin = jest.fn();
const mockHeader = jest.fn();
let mockMarginOpen = false;

// A lazily loaded component renders nothing here, but a margin part reports that it was rendered
// (plan 413 made the margin suite dynamic: its loader names the module).
jest.mock("next/dynamic", () => (loader: () => Promise<unknown>) => {
  const part = /wiki-os\/margin\/(?:modals\/)?(\w+)/.exec(loader.toString())?.[1];
  return function Dynamic() {
    if (part) mockMargin(part);
    return null;
  };
});
let mockSignedIn = true;
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isSignedIn: mockSignedIn }),
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({
    setWikiPage: mockSetWikiPage,
    activeModal: null,
    setActiveModal: jest.fn(),
    setActiveSectionId: jest.fn(),
    isMarginOpen: mockMarginOpen,
    setIsMarginOpen: jest.fn(),
    marginTab: "threads",
    setMarginTab: jest.fn(),
    toggleMargin: mockToggleMargin,
  }),
}));
jest.mock("~/components/wiki-os/reader/ImageLightbox", () => ({ useImageLightbox: () => null }));
jest.mock("~/components/wiki-os/reader/AnnotationOverlay", () => ({
  useAnnotationOverlay: () => undefined,
}));
jest.mock("~/components/wiki-os/reader/useCiteTooltips", () => ({ useCiteTooltips: () => null }));
jest.mock("~/hooks/useWikiNarrator", () => ({
  useWikiNarrator: () => ({ isPlaying: false, play: jest.fn(), pause: jest.fn(), stop: jest.fn() }),
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/lib/flags/flag-color-extractor", () => ({ getFlagColors: () => null }));
jest.mock("~/lib/wiki-os/editor/wiki-embed-shared", () => ({
  EMBED_CSS: "",
  EMBED_JS: "",
  EMBED_PREFETCH: "/maps?embed=true",
}));
jest.mock("~/components/wiki-os/reader/StickyToc", () => ({ StickyToc: () => null }));
jest.mock("~/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }));
jest.mock("~/components/wiki-os/reader/InfoboxWithMap", () => ({ InfoboxWithMap: () => null }));
// the real one's contract for the infobox's HTML: a div with the given id and that HTML, its markup
// object stable between renders
jest.mock("~/components/wiki-os/reader/InfoboxWithMap", () => {
  const { useMemo } = jest.requireActual<typeof import("react")>("react");
  return {
    InfoboxWithMap: (props: { infoboxHtml: string; markupId?: string }) => {
      const markup = useMemo(() => ({ __html: props.infoboxHtml }), [props.infoboxHtml]);
      return (
        <aside className="wikios-infobox">
          <div id={props.markupId} dangerouslySetInnerHTML={markup} />
        </aside>
      );
    },
  };
});
jest.mock("~/components/wiki-os/reader/ArticleHeader", () => ({
  WikiOSHeader: (props: { title: string }) => {
    mockHeader(props);
    return <h1>{props.title}</h1>;
  },
}));
jest.mock("~/components/wiki-os/reader/ArticleModals", () => ({
  QuickHistoryModal: () => null,
  QuickBacklinksModal: () => null,
}));
const mockInject = jest.fn((html: string) => html);
const mockExtractStatKeys = jest.fn((_html: string): string[] => []);
jest.mock("~/components/wiki-os/reader/ArticlePlaceholders", () => ({
  injectPlaceholderElements: (html: string) => mockInject(html),
  extractStatKeys: (html: string) => mockExtractStatKeys(html),
  CoordsPill: () => <span data-testid="coords-pill" />,
  DynamicStatSpan: () => null,
}));
// a live embed reports the request it was mounted with
jest.mock("~/components/wiki-os/reader/SisterEmbed", () => ({
  SisterEmbed: (props: { request: { wiki: string; title: string } }) => (
    <span data-testid="sister-embed">{`${props.request.wiki}:${props.request.title}`}</span>
  ),
}));
jest.mock("~/components/wiki-os/reader/useStatValues", () => ({ useStatValues: () => ({}) }));
jest.mock("~/components/wiki-os/reader/ArticleCategories", () => ({ CategoriesBar: () => null }));
jest.mock("~/components/wiki-os/reader/ArticleFooter", () => ({ ArticleFooter: () => null }));
const content = '<h2 id="History">History</h2><p>Eurth is a world.</p>';

function renderArticle(
  wikiSource: "ixwiki" | "iiwiki",
  overrides: Partial<ComponentProps<typeof ArticleRenderer>> = {}
) {
  return render(
    <ArticleRenderer
      title="Portal:Eurth"
      contentHtml={content}
      infoboxHtml={null}
      noticesHtml={null}
      toc={[]}
      categories={[]}
      lastModified={null}
      wikiSource={wikiSource}
      authorInfo={null}
      {...overrides}
    />
  );
}

const marginQuery = api.wikios.getArticleMarginData.useQuery as jest.Mock;
const annotationsQuery = api.wikios.getAnnotations.useQuery as jest.Mock;

// Page info starts hidden in the aside; these tests read what it shows.
beforeEach(() => localStorage.setItem("wikios:railCollapsed", "false"));
describe("ArticleRenderer for another wiki's page is read-only (ruling E-l)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarginOpen = false;
  });

  it("has no section edit links, no margin and no history/backlinks, and says where the page lives", () => {
    mockMarginOpen = true; // a margin left open on an IxWiki page stays shut here
    const { container } = renderArticle("iiwiki");

    expect(container.querySelector(".wikios-section-edit-link")).toBeNull();
    expect(mockMargin).not.toHaveBeenCalled();
    expect(marginQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
    expect(annotationsQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
    expect(screen.queryByTitle("Revision history")).not.toBeInTheDocument();
    expect(screen.queryByTitle("What links here")).not.toBeInTheDocument();
    expect(screen.queryByText("Margin notes")).not.toBeInTheDocument();

    // The Halo's "This Page" actions read the page's wiki from the context (ruling E-l′)
    expect(mockSetWikiPage).toHaveBeenCalledWith("Portal:Eurth", [], expect.anything(), "iiwiki");

    expect(screen.getByText(/From IIWiki \(read only\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "open on iiwiki.com" })).toHaveAttribute(
      "href",
      "https://iiwiki.com/wiki/Portal%3AEurth"
    );
  });

  it("contains another wiki's notices and body in a box of their own; an IxWiki page has none", () => {
    const notices = '<div class="hatnote">Note</div>';
    const sister = renderArticle("iiwiki", { noticesHtml: notices }).container;
    expect(sister.querySelector(".wikios-notices")).toHaveClass("wikios-sister-article");
    expect(sister.querySelector(".wikios-article-body")).toHaveClass("wikios-sister-article");

    const own = renderArticle("ixwiki", { noticesHtml: notices }).container;
    expect(own.querySelector(".wikios-notices")).not.toBeNull();
    expect(own.querySelector(".wikios-sister-article")).toBeNull();

    // the box: layout and paint containment and isolation, as a forum post has
    const css = readFileSync(join(process.cwd(), "src/styles/wiki-os/content.css"), "utf8");
    const rule = /\.wikios-sister-article \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/contain: layout paint;/);
    expect(rule).toMatch(/isolation: isolate;/);
    // which clips: on a phone, a wide outer table (not an infobox, a notice or a navbox) scrolls inside its own box
    const table =
      /@media \(width < 48rem\) \{\s*\.wikios-sister-article\s+table:not\(([^)]*)\) \{([^}]*)\}/.exec(
        css
      );
    expect(table?.[1]).toBe(".infobox, .wikios-infobox table, .ambox, .navbox, table table");
    expect(table?.[2]).toMatch(/display: block;\s*max-width: 100%;\s*overflow-x: auto;/);
  });

  it("the margin hotkey does nothing", () => {
    renderArticle("iiwiki");
    fireEvent.keyDown(window, { key: "t" });
    expect(mockToggleMargin).not.toHaveBeenCalled();
  });

  it("an IxWiki page keeps section edit links, the margin and its page tools", () => {
    const { container } = renderArticle("ixwiki");

    expect(container.querySelector(".wikios-section-edit-link")).not.toBeNull();
    expect(mockMargin).toHaveBeenCalledWith("MarginGutterPins");
    expect(mockMargin).toHaveBeenCalledWith("SelectionCapsule");
    expect(marginQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByTitle("Revision history")).toBeInTheDocument();
    expect(screen.getByText("Margin notes")).toBeInTheDocument();
    expect(screen.queryByText(/read only/)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "t" });
    expect(mockToggleMargin).toHaveBeenCalledTimes(1);
  });
});
describe("lean first response (plan 413, item 8c)", () => {
  const BODY = '<h2 id="History">History</h2><p>Eurth is a world.</p>';
  const INFOBOX =
    '<table class="infobox"><tbody><tr><td>Capital: Aurelia</td></tr></tbody></table>';
  const detectServer = () => typeof window === "undefined";

  afterEach(() => {
    leanEnvironment.isServer = detectServer;
    document.body.innerHTML = "";
  });

  const article = (token: string) => (
    <ArticleRenderer
      title="Portal:Eurth"
      contentHtml={leanMarker(token, "body")}
      infoboxHtml={leanMarker(token, "infobox")}
      noticesHtml={null}
      toc={[]}
      categories={[]}
      lastModified={null}
      wikiSource="ixwiki"
      authorInfo={null}
    />
  );

  it("renders the real article on the server from markers and hydrates it in the browser by reading the DOM back", async () => {
    // The server render: markers in the props, the real HTML from the stash
    leanEnvironment.isServer = () => true;
    const token = stashLeanArticle({ body: BODY, infobox: INFOBOX, notices: null });
    const html = renderToString(article(token));
    expect(html).toContain("Eurth is a world.");
    expect(html).toContain("Capital: Aurelia");
    expect(html).toContain(`id="wikios-lean-${token}-body"`);
    expect(html).toContain(`id="wikios-lean-${token}-infobox"`);
    expect(html).not.toContain("wikios-lean:"); // a marker is never in the page

    // The browser: that DOM is all there is, and the props carry markers only
    leanEnvironment.isServer = () => false;
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const paragraph = container.querySelector("p");
    const infobox = container.querySelector(".infobox");
    const recoverable: unknown[] = [];

    await act(async () => {
      hydrateRoot(container, article(token), { onRecoverableError: (e) => recoverable.push(e) });
    });

    expect(recoverable).toEqual([]);
    // hydrated in place: the article's nodes are the server's, not rewritten
    expect(container.querySelector("p")).toBe(paragraph);
    expect(container.querySelector(".infobox")).toBe(infobox);
    expect(container.textContent).toContain("Eurth is a world.");
    // and the reader works off the real HTML it read back: the signed-in reader's edit link is on its heading
    expect(container.querySelector("h2 .wikios-section-edit-link")).not.toBeNull();
  });

  it("shows no article, rather than a marker, when the DOM it would read back is not there", async () => {
    leanEnvironment.isServer = () => false;
    const container = document.createElement("div");
    document.body.append(container);
    const token = "123e4567-e89b-42d3-a456-426614174000";

    await act(async () => {
      render(article(token), { container });
    });

    expect(container.textContent).not.toContain("wikios-lean");
    expect(container.querySelector(".wikios-article-body")?.textContent ?? "").toBe("");
  });
});

describe("Template:Sister boxes become live embeds (C4b)", () => {
  /** A box as classic's Template:Sister renders it. */
  const box = (title: string, wiki = "iiwiki") =>
    `<div class="sister-link" data-sister-wiki="${wiki}" data-sister-title="${title}" data-sister-mode="page" ` +
    `data-sister-section="">From IIWiki: <a href="https://iiwiki.com/wiki/${title}">${title}</a></div>`;
  const boxes = (container: HTMLElement) => Array.from(container.querySelectorAll(".sister-link"));
  const embeds = () => screen.queryAllByTestId("sister-embed");

  beforeEach(() => {
    jest.clearAllMocks();
    mockMarginOpen = false;
  });

  it("a Template:Sister box becomes a live embed", () => {
    const { container } = renderArticle("ixwiki", {
      contentHtml: `<p>Intro</p>${box("Caphiria")}`,
    });

    const [target] = boxes(container);
    expect(target?.querySelector("a")).toBeNull(); // the link box was emptied once, for the embed
    expect(target?.textContent).toBe("iiwiki:Caphiria");
    expect(embeds()).toHaveLength(1);
  });

  it("the eleventh box stays a link box", () => {
    const html = Array.from({ length: 11 }, (_, i) => box(`Page_${i + 1}`)).join("");
    const { container } = renderArticle("ixwiki", { contentHtml: html });

    expect(embeds()).toHaveLength(10);
    const all = boxes(container);
    expect(all[9]?.textContent).toBe("iiwiki:Page_10");
    expect(all[10]?.querySelector("a")).toHaveAttribute("href", "https://iiwiki.com/wiki/Page_11");
  });

  it("a box naming no wiki WikiOS reads stays a link box and does not count toward the ten", () => {
    const html =
      box("Elsewhere", "commons") + Array.from({ length: 10 }, (_, i) => box(`P${i}`)).join("");
    const { container } = renderArticle("ixwiki", { contentHtml: html });

    expect(embeds()).toHaveLength(10);
    expect(boxes(container)[0]?.querySelector("a")).not.toBeNull();
  });

  it("a box inside an embed is not hydrated", () => {
    const html = `<div class="wikios-sister-embed">${box("Inner")}</div>`;
    const { container } = renderArticle("ixwiki", { contentHtml: html });

    expect(embeds()).toHaveLength(0);
    expect(boxes(container)[0]?.querySelector("a")).not.toBeNull();
  });

  it("a sister page hydrates no embed and no IxStates widget, and skips the placeholder pass", () => {
    const html =
      box("Caphiria") +
      '<span class="wikios-coords-placeholder" data-lat="1" data-lng="2" data-zoom="4">Here</span>';
    const sister = renderArticle("iiwiki", { contentHtml: html });

    expect(embeds()).toHaveLength(0);
    expect(screen.queryByTestId("coords-pill")).toBeNull();
    expect(boxes(sister.container)[0]?.querySelector("a")).not.toBeNull();
    expect(mockInject).not.toHaveBeenCalled();
    expect(mockExtractStatKeys).not.toHaveBeenCalled();
    // the viewer's country is read only for an IxWiki page's coordinate pills
    expect(api.users.getCurrentUserWithRole.useQuery).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({ enabled: false })
    );
    sister.unmount();

    renderArticle("ixwiki", { contentHtml: html });
    expect(embeds()).toHaveLength(1);
    expect(screen.getByTestId("coords-pill")).toBeInTheDocument();
    expect(mockInject).toHaveBeenCalled();
    expect(mockExtractStatKeys).toHaveBeenCalled();
    expect(api.users.getCurrentUserWithRole.useQuery).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({ enabled: true })
    );
  });

  it("an embed survives a re-render that reads the targets again: its box is emptied only once", () => {
    const props = {
      title: "Portal:Eurth",
      contentHtml: box("Caphiria"),
      noticesHtml: null,
      toc: [],
      categories: [],
      lastModified: null,
      wikiSource: "ixwiki" as const,
      authorInfo: null,
    };
    const { container, rerender } = render(<ArticleRenderer {...props} infoboxHtml={null} />);
    expect(boxes(container)[0]?.textContent).toBe("iiwiki:Caphiria");

    rerender(<ArticleRenderer {...props} infoboxHtml="<p>Capital: Aurelia</p>" />);
    expect(boxes(container)[0]?.textContent).toBe("iiwiki:Caphiria");
    expect(embeds()).toHaveLength(1);
  });
});

describe("section links into a sister page (C4b, ids prefixed sister-)", () => {
  const sisterContent = '<h2 id="sister-History">History</h2><p>Long ago.</p>';
  const scrolled = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled(this.id);
    };
  });
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("an incoming #History lands on sister-History", () => {
    window.history.replaceState(null, "", "/wiki/Caphiria?source=iiwiki#History");
    renderArticle("iiwiki", { contentHtml: sisterContent });

    expect(window.location.hash).toBe("#sister-History");
    expect(window.location.search).toBe("?source=iiwiki");
    expect(scrolled).toHaveBeenCalledWith("sister-History");
  });

  it("a later hash change lands there too", () => {
    renderArticle("iiwiki", { contentHtml: sisterContent });
    expect(scrolled).not.toHaveBeenCalled();

    act(() => {
      window.history.replaceState(null, "", "#History");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(window.location.hash).toBe("#sister-History");
    expect(scrolled).toHaveBeenCalledWith("sister-History");
  });

  it("a hash that already names a prefixed id, or no section, is left alone", () => {
    window.history.replaceState(null, "", "/wiki/Caphiria?source=iiwiki#sister-History");
    renderArticle("iiwiki", { contentHtml: sisterContent });
    expect(window.location.hash).toBe("#sister-History");

    window.history.replaceState(null, "", "/wiki/Caphiria?source=iiwiki#Nowhere");
    renderArticle("iiwiki", { contentHtml: sisterContent });
    expect(window.location.hash).toBe("#Nowhere");
    expect(scrolled).not.toHaveBeenCalled();
  });

  it("an id outside the article is not a section of it", () => {
    const outside = document.createElement("div");
    outside.id = "sister-Elsewhere";
    document.body.append(outside);
    try {
      window.history.replaceState(null, "", "/wiki/Caphiria?source=iiwiki#Elsewhere");
      renderArticle("iiwiki", { contentHtml: sisterContent });
      expect(window.location.hash).toBe("#Elsewhere");
      expect(scrolled).not.toHaveBeenCalled();
    } finally {
      outside.remove();
    }
  });

  it("an IxWiki page's hash is not rewritten", () => {
    window.history.replaceState(null, "", "/wiki/Caphiria#History");
    renderArticle("ixwiki", { contentHtml: sisterContent });
    expect(window.location.hash).toBe("#History");
    expect(scrolled).not.toHaveBeenCalled();
  });
});
