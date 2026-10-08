import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";

const mockToggleMargin = jest.fn();
const mockSetWikiPage = jest.fn();
const mockMargin = jest.fn();
const mockUseWikiMediaTheme = { getImageAttributes: () => ({}) };
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
jest.mock("~/components/wiki-os/reader/ImageLightbox", () => ({ useImageLightbox: () => null }));
jest.mock("~/components/wiki-os/reader/AnnotationOverlay", () => ({
  useAnnotationOverlay: () => undefined,
}));
jest.mock("~/components/wiki-os/reader/useCiteTooltips", () => ({ useCiteTooltips: () => null }));
jest.mock("~/components/wiki-os/reader/useStatValues", () => ({ useStatValues: () => ({}) }));
jest.mock("~/components/wiki-os/reader/useScrollSpy", () => ({ useScrollSpy: () => undefined }));
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
jest.mock("~/components/wiki-os/reader/StickyToc", () => ({
  StickyToc: ({
    entries,
    onNavigate,
  }: {
    entries: { id: string; text: string }[];
    onNavigate?: () => void;
  }) => (
    <nav aria-label="Table of contents">
      {entries.map((e) => (
        <a key={e.id} href={`#${e.id}`} onClick={() => onNavigate?.()}>
          {e.text}
        </a>
      ))}
    </nav>
  ),
}));
let mockWide = true;
jest.mock("~/hooks/useMediaQuery", () => ({ useMediaQuery: () => mockWide }));
jest.mock("~/components/wiki-os/reader/InfoboxWithMap", () => ({ InfoboxWithMap: () => null }));
jest.mock("~/components/wiki-os/shared/MediaThemeContext", () => ({
  useWikiMediaTheme: () => mockUseWikiMediaTheme,
}));
jest.mock("~/components/wiki-os/reader/WatchButton", () => ({ WatchButton: () => null }));
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

const toc = [
  { id: "History", text: "History", level: 2 },
  { id: "Geography", text: "Geography", level: 2 },
  { id: "Rivers", text: "Rivers", level: 3 },
];
const content = toc
  .map((e) => `<h${e.level} id="${e.id}">${e.text}</h${e.level}><p>Text.</p>`)
  .join("");

function renderArticle(headings = toc) {
  return render(
    <ArticleRenderer
      title="Eurth"
      contentHtml={content}
      infoboxHtml={null}
      noticesHtml={null}
      toc={headings}
      categories={["Realms"]}
      lastModified="2026-09-01T00:00:00.000Z"
      wikiSource="ixwiki"
      authorInfo={null}
    />
  );
}

const tocNav = () => screen.queryByRole("navigation", { name: "Table of contents" });

describe("ArticleRenderer contents aside", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarginOpen = false;
    mockWide = true;
    localStorage.clear();
    // Page info starts hidden; most of these tests are about what it holds.
    localStorage.setItem("wikios:railCollapsed", "false");
    window.scrollTo = jest.fn();
  });

  it("hides the page info by default and keeps the contents inline", () => {
    localStorage.removeItem("wikios:railCollapsed");
    renderArticle();
    const aside = within(screen.getByRole("complementary", { name: "Contents" }));
    expect(aside.getByRole("navigation", { name: "Table of contents" })).toBeInTheDocument();
    expect(aside.queryByText("Last updated")).toBeNull();
    expect(aside.getByRole("button", { name: "Page info" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("puts the contents and a page-info block in the aside at desktop width", () => {
    renderArticle();

    const inspector = screen.getByRole("complementary", { name: "Contents" });
    const nav = within(inspector).getByRole("navigation", { name: "Table of contents" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual(["History", "Geography", "Rivers"]);
    expect(within(inspector).getByText("Last updated")).toBeInTheDocument();
    expect(within(inspector).getByRole("link", { name: "Realms" })).toBeInTheDocument();
  });

  it("marks the header Contents button and the aside, so layout.css hides the button beside it", () => {
    renderArticle();
    expect(screen.getByRole("button", { name: "Table of contents" })).toHaveClass(
      "wikios-toc-button"
    );
    expect(screen.getByRole("complementary", { name: "Contents" })).toHaveAttribute(
      "data-slot",
      "wiki-contents-aside"
    );
  });

  it("below desktop the Contents button opens the contents sheet, and picking a heading closes it", () => {
    mockWide = false;
    renderArticle();
    expect(tocNav()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Table of contents" }));
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByRole("navigation", { name: "Table of contents" })).toBeInTheDocument();
    expect(sheet.getByText("Last updated")).toBeInTheDocument();

    fireEvent.click(sheet.getByRole("link", { name: "Rivers" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("an article without headings keeps its page info in the aside, no contents list", () => {
    renderArticle([]);
    const inspector = screen.getByRole("complementary", { name: "Contents" });
    expect(within(inspector).queryByRole("navigation")).toBeNull();
    expect(within(inspector).getByText("Last updated")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Table of contents" })).toBeNull();
  });

  it("below desktop a headingless article still gets a Page info button that opens the sheet", () => {
    mockWide = false;
    renderArticle([]);

    fireEvent.click(screen.getByRole("button", { name: "Page info" }));
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("Last updated")).toBeInTheDocument();
    expect(sheet.queryByRole("navigation", { name: "Table of contents" })).toBeNull();
  });

  it("renders no aside and no contents when the setting is off, and follows it live in the same tab", () => {
    localStorage.setItem("wikios:showWikiToc", "false");
    renderArticle();
    expect(screen.queryByRole("complementary", { name: "Contents" })).toBeNull();
    expect(tocNav()).toBeNull();
    expect(screen.queryByRole("button", { name: "Table of contents" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Page info" })).toBeNull();

    act(() => {
      localStorage.setItem("wikios:showWikiToc", "true");
      window.dispatchEvent(new Event("wikios-settings-changed"));
    });
    expect(screen.getByRole("complementary", { name: "Contents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Table of contents" })).toBeInTheDocument();
  });

  it("hiding the sidebar folds the page info away, keeps the contents inline, and remembers it", () => {
    renderArticle();
    const aside = () => screen.getByRole("complementary", { name: "Contents" });
    fireEvent.click(within(aside()).getByRole("button", { name: "Hide" }));
    expect(within(aside()).queryByText("Last updated")).toBeNull();
    expect(
      within(aside()).getByRole("navigation", { name: "Table of contents" })
    ).toBeInTheDocument();
    expect(localStorage.getItem("wikios:railCollapsed")).toBe("true");

    fireEvent.click(within(aside()).getByRole("button", { name: "Page info" }));
    expect(within(aside()).getByText("Last updated")).toBeInTheDocument();
  });

  it("steps the aside aside while the margin drawer is open", () => {
    mockMarginOpen = true;
    renderArticle();
    expect(screen.queryByRole("complementary", { name: "Contents" })).toBeNull();
  });
});
