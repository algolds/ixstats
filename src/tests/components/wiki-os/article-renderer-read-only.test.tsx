import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { api } from "~/trpc/react";

const mockToggleMargin = jest.fn();
const mockMargin = jest.fn();
let mockMarginOpen = false;

jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({ useWikiAuth: () => ({ isSignedIn: true }) }));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({
    setWikiPage: jest.fn(),
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
jest.mock("~/lib/wiki-os/editor/wiki-embed-shared", () => ({ EMBED_CSS: "", EMBED_JS: "" }));
jest.mock("~/components/wiki-os/reader/AppleBooksTocDrawer", () => ({
  AppleBooksTocDrawer: () => null,
}));
jest.mock("~/components/wiki-os/reader/StickyToc", () => ({ StickyToc: () => null }));
jest.mock("~/components/wiki-os/reader/InfoboxWithMap", () => ({ InfoboxWithMap: () => null }));
jest.mock("~/components/wiki-os/reader/ArticleHeader", () => ({
  WikiOSHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
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

const content = '<h2 id="History">History</h2><p>Eurth is a world.</p>';

function renderArticle(wikiSource: "ixwiki" | "iiwiki") {
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
