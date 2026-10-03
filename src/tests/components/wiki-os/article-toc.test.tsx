import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";

const mockToggleMargin = jest.fn();
const mockSetWikiPage = jest.fn();
const mockMargin = jest.fn();
const mockUseWikiMediaTheme = { getImageStyle: () => ({}) };
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
      categories={[]}
      lastModified={null}
      wikiSource="ixwiki"
      authorInfo={null}
    />
  );
}

describe("ArticleRenderer table of contents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarginOpen = false;
    localStorage.clear();
    window.scrollTo = jest.fn();
  });

  it("shows a TOC button that opens a drawer listing the headings, and a click scrolls and closes it", () => {
    renderArticle();

    fireEvent.click(screen.getByRole("button", { name: "Table of contents" }));

    const nav = within(screen.getByRole("navigation", { name: "Table of contents" }));
    expect(nav.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "History",
      "Geography",
      "Rivers",
    ]);

    fireEvent.click(nav.getByRole("button", { name: "Rivers" }));
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    expect(window.location.hash).toBe("#Rivers");
    expect(screen.queryByRole("navigation", { name: "Table of contents" })).toBeNull();
  });

  it("has no TOC button for an article without headings", () => {
    renderArticle([]);
    expect(screen.queryByRole("button", { name: "Table of contents" })).toBeNull();
  });

  it("hides the button when the setting is off, and follows the setting live in the same tab", () => {
    localStorage.setItem("wikios:showWikiToc", "false");
    renderArticle();
    expect(screen.queryByRole("button", { name: "Table of contents" })).toBeNull();

    act(() => {
      localStorage.setItem("wikios:showWikiToc", "true");
      window.dispatchEvent(new Event("wikios-settings-changed"));
    });
    expect(screen.getByRole("button", { name: "Table of contents" })).toBeInTheDocument();
  });
});
