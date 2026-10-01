import type { ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { api } from "~/trpc/react";

const mockToggleMargin = jest.fn();
const mockSetWikiPage = jest.fn();
const mockMargin = jest.fn();
const mockHeader = jest.fn();
let mockMarginOpen = false;

jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({ useWikiAuth: () => ({ isSignedIn: true }) }));
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
jest.mock("~/components/wiki-os/shared/useWikiSetting", () => ({ useWikiSetting: () => true }));
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
jest.mock("~/components/wiki-os/reader/AppleBooksTocDrawer", () => ({
  AppleBooksTocDrawer: () => null,
}));
jest.mock("~/components/wiki-os/reader/StickyToc", () => ({ StickyToc: () => null }));
jest.mock("~/components/wiki-os/reader/InfoboxWithMap", () => ({ InfoboxWithMap: () => null }));
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
jest.mock("~/components/wiki-os/margin", () => {
  const part =
    (name: string) =>
    ({ children }: { children?: ReactNode }) => {
      mockMargin(name);
      return <>{children}</>;
    };
  return {
    WikiMarginDrawer: part("drawer"),
    MarginGutterPins: part("pins"),
    SelectionCapsule: part("capsule"),
    MarginShareModal: part("share"),
  };
});

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
    expect(screen.queryByTitle("Revision History")).not.toBeInTheDocument();
    expect(screen.queryByTitle("What Links Here")).not.toBeInTheDocument();
    expect(screen.queryByText("Margin notes")).not.toBeInTheDocument();

    // The Halo's "This Page" actions read the page's wiki from the context (ruling E-l′)
    expect(mockSetWikiPage).toHaveBeenCalledWith("Portal:Eurth", [], expect.anything(), "iiwiki");

    expect(screen.getByText(/From IIWiki — read only/)).toBeInTheDocument();
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
    expect(mockMargin).toHaveBeenCalledWith("drawer");
    expect(mockMargin).toHaveBeenCalledWith("pins");
    expect(marginQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByTitle("Revision History")).toBeInTheDocument();
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
