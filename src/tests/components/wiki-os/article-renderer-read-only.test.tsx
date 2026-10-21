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
jest.mock("~/components/wiki-os/reader/ArticlePlaceholders", () => ({
  injectPlaceholderElements: (html: string) => html,
  extractStatKeys: () => [],
  CoordsPill: () => null,
  DynamicStatSpan: () => null,
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
