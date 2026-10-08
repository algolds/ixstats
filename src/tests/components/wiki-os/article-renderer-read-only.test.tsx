import type { ComponentProps, ReactNode } from "react";
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

describe("ArticleRenderer loads the margin drawer only once it is opened (plan 413)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarginOpen = false;
  });

  it("mounts the pins and the capsule, but not the drawer, while the margin is closed", () => {
    renderArticle("ixwiki");

    expect(mockMargin).toHaveBeenCalledWith("MarginGutterPins");
    expect(mockMargin).toHaveBeenCalledWith("SelectionCapsule");
    expect(mockMargin).not.toHaveBeenCalledWith("WikiMarginDrawer");
  });

  it("mounts the drawer when it opens, and keeps it mounted after it closes (its exit animation)", () => {
    mockMarginOpen = true;
    const { rerender } = renderArticle("ixwiki");
    expect(mockMargin).toHaveBeenCalledWith("WikiMarginDrawer");

    mockMarginOpen = false;
    mockMargin.mockClear();
    rerender(
      <ArticleRenderer
        title="Portal:Eurth"
        contentHtml={content}
        infoboxHtml={null}
        noticesHtml={null}
        toc={[]}
        categories={[]}
        lastModified={null}
        wikiSource="ixwiki"
        authorInfo={null}
      />
    );
    expect(mockMargin).toHaveBeenCalledWith("WikiMarginDrawer");
  });
});

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

describe("ArticleRenderer shows how many Margin threads the page has, not how many came in one page (plan 416)", () => {
  const defaultMarginQuery = marginQuery.getMockImplementation();
  afterEach(() => marginQuery.mockImplementation(defaultMarginQuery));

  it("adds the server's open and resolved totals, whatever page of threads it was sent", () => {
    marginQuery.mockReturnValue({
      data: {
        threads: Array.from({ length: 50 }, (_, i) => ({ id: `t${i}` })),
        totalOpenCount: 70,
        totalResolvedCount: 12,
      },
      refetch: jest.fn(),
    });

    renderArticle("ixwiki");

    expect(screen.getByText(/· 82 threads/)).toBeInTheDocument();
  });

  it("shows no count before the totals arrive", () => {
    marginQuery.mockReturnValue({ data: undefined, refetch: jest.fn() });

    renderArticle("ixwiki");

    expect(screen.getByText("Margin notes")).toBeInTheDocument();
    expect(screen.queryByText(/threads?$/)).not.toBeInTheDocument();
  });
});

const authorsQuery = api.wikios.getArticleAuthors.useQuery as jest.Mock;
const awardsQuery = api.lorewards.getArticleAwardsAndAchievements.useQuery as jest.Mock;

describe("ArticleRenderer asks for Lorewards and awards only on an IxWiki page (plan 416)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("asks once for an IxWiki page", () => {
    renderArticle("ixwiki");

    expect(awardsQuery).toHaveBeenCalledWith(
      { title: "Portal:Eurth" },
      expect.objectContaining({ enabled: true })
    );
    expect(awardsQuery.mock.calls.every(([, options]) => options.enabled === true)).toBe(true);
  });

  it("does not ask for another wiki's page", () => {
    renderArticle("iiwiki");

    expect(awardsQuery).toHaveBeenCalledWith(
      { title: "Portal:Eurth" },
      expect.objectContaining({ enabled: false })
    );
    expect(awardsQuery.mock.calls.every(([, options]) => options.enabled === false)).toBe(true);
  });
});

const EMBED_IDS = ["ixstats-embed-css", "ixstats-embed-js", "ixstats-embed-prefetch"];
const embedAssets = () => EMBED_IDS.map((id) => document.getElementById(id));

describe("ArticleRenderer embed assets load only for a page that embeds a map (plan 404)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const id of EMBED_IDS) document.getElementById(id)?.remove();
  });

  it("adds no embed CSS, script or /maps prefetch to an ordinary page", () => {
    renderArticle("ixwiki");

    expect(embedAssets()).toEqual([null, null, null]);
    expect(document.head.querySelector('link[rel="prefetch"]')).toBeNull();
  });

  it("adds them for a page whose body holds an embed", () => {
    renderArticle("ixwiki", {
      contentHtml: `${content}<div class="ix-embed-wrap" data-ix-lat="1" data-ix-lng="2" data-ix-zoom="4"></div>`,
    });

    expect(embedAssets().every(Boolean)).toBe(true);
    expect(document.getElementById("ixstats-embed-prefetch")).toHaveAttribute(
      "href",
      "/maps?embed=true"
    );
  });

  it("adds them for a page whose infobox holds an embed", () => {
    renderArticle("ixwiki", {
      infoboxHtml: '<table><tr><td><div class="ix-embed-wrap"></div></td></tr></table>',
    });

    expect(embedAssets().every(Boolean)).toBe(true);
  });
});

describe("ArticleRenderer loads authorship beside the article (plan 404)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authorsQuery.mockImplementation(() => ({ data: undefined, isLoading: true }));
  });

  it("asks for an IxWiki page's authors itself, without holding the article back", () => {
    renderArticle("ixwiki");

    expect(authorsQuery).toHaveBeenCalledWith(
      { title: "Portal:Eurth", wikiSource: "ixwiki" },
      expect.objectContaining({ enabled: true })
    );
    expect(mockHeader).toHaveBeenLastCalledWith(expect.objectContaining({ authorInfo: null }));
    expect(screen.getByRole("heading", { name: "Portal:Eurth" })).toBeInTheDocument();
  });

  it("hands the header the authors, flattened, once they arrive", () => {
    authorsQuery.mockImplementation(() => ({
      data: {
        creator: { username: "Alice", timestamp: "2026-01-01T00:00:00Z", avatar: "a.png" },
        lastEditor: { username: "Bob", timestamp: "2026-09-01T00:00:00Z", avatar: null },
        topContributors: [{ username: "Alice", editCount: 3 }],
        totalContributors: 2,
      },
    }));
    renderArticle("ixwiki");

    expect(mockHeader).toHaveBeenLastCalledWith(
      expect.objectContaining({
        authorInfo: {
          creator: "Alice",
          creatorAvatar: "a.png",
          createdAt: "2026-01-01T00:00:00Z",
          lastEditor: "Bob",
          lastEditorAvatar: null,
          lastEditedAt: "2026-09-01T00:00:00Z",
          contributors: [{ username: "Alice", editCount: 3 }],
          totalContributors: 2,
        },
      })
    );
    // the mobile byline and the companion read the same authors
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(1);
  });

  it("does not ask when the page came with its authorship (another wiki's page)", () => {
    renderArticle("iiwiki", {
      authorInfo: { creator: { username: "Carol" }, totalContributors: 1 },
    });

    expect(authorsQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
    expect(mockHeader).toHaveBeenLastCalledWith(
      expect.objectContaining({ authorInfo: expect.objectContaining({ creator: "Carol" }) })
    );
  });
});

describe("ArticleRenderer first paint and signing in (plan 413)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarginOpen = false;
    mockSignedIn = true;
    localStorage.clear();
  });

  it("signing in adds the section edit links to the article that is already there, never rewriting its HTML", () => {
    mockSignedIn = false;
    const view = renderArticle("ixwiki");
    const paragraph = view.container.querySelector("p");
    expect(view.container.querySelector(".wikios-section-edit-link")).toBeNull();

    mockSignedIn = true;
    view.rerender(
      <ArticleRenderer
        title="Portal:Eurth"
        contentHtml={content}
        infoboxHtml={null}
        noticesHtml={null}
        toc={[]}
        categories={[]}
        lastModified={null}
        wikiSource="ixwiki"
        authorInfo={null}
      />
    );

    expect(view.container.querySelector(".wikios-section-edit-link")).not.toBeNull();
    expect(view.container.querySelector("p")).toBe(paragraph); // the same node: nothing was re-injected
  });

  it("signing out takes the section edit links back out, in place", () => {
    const view = renderArticle("ixwiki");
    const paragraph = view.container.querySelector("p");
    expect(view.container.querySelector(".wikios-section-edit-link")).not.toBeNull();

    mockSignedIn = false;
    view.rerender(
      <ArticleRenderer
        title="Portal:Eurth"
        contentHtml={content}
        infoboxHtml={null}
        noticesHtml={null}
        toc={[]}
        categories={[]}
        lastModified={null}
        wikiSource="ixwiki"
        authorInfo={null}
      />
    );

    expect(view.container.querySelector(".wikios-section-edit-link")).toBeNull();
    expect(view.container.querySelector("p")).toBe(paragraph);
  });

  it("a re-render does not write the article's HTML again: React 19 does that for a new {__html} object", () => {
    const view = renderArticle("ixwiki");
    const paragraph = view.container.querySelector("p");
    const link = view.container.querySelector(".wikios-section-edit-link");

    // the parent renders again with equal props (a new categories array): the article's DOM stays
    view.rerender(
      <ArticleRenderer
        title="Portal:Eurth"
        contentHtml={content}
        infoboxHtml={null}
        noticesHtml={null}
        toc={[]}
        categories={[]}
        lastModified={null}
        wikiSource="ixwiki"
        authorInfo={null}
      />
    );

    expect(view.container.querySelector("p")).toBe(paragraph);
    expect(view.container.querySelector(".wikios-section-edit-link")).toBe(link);
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

describe("ArticleRenderer's parts carry the class TemplateStyles are scoped to (plan 415 review, m4)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("gives the notices and the body that class, and nothing around them", () => {
    const { container } = renderArticle("ixwiki", {
      noticesHtml: '<table class="ambox"><tr><td>n</td></tr></table>',
    });

    const roots = Array.from(container.querySelectorAll(".mw-parser-output"));
    expect(roots).toHaveLength(2);
    expect(container.querySelector(".wikios-notices")).toBe(roots[0]);
    expect(roots[1]?.innerHTML).toContain("Eurth is a world.");
    // the page's own chrome (the header, the article container) is outside every root
    expect(container.querySelector("h1")?.closest(".mw-parser-output")).toBeNull();
    expect(container.querySelector(".wikios-article")?.classList.contains("mw-parser-output")).toBe(
      false
    );
  });

  it("makes the body a root whose children are the article's own elements, so `.mw-parser-output > p` matches", () => {
    const { container } = renderArticle("ixwiki");
    const body = container.querySelector(".wikios-article-content > .mw-parser-output");

    expect(body?.querySelector(":scope > p")?.textContent).toBe("Eurth is a world.");
  });
});
