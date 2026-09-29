import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import WikiOSArticlePage from "~/app/(wiki-os)/wiki/[slug]/page";

const mockUseQuery = jest.fn();
const mockPrefetch = jest.fn();
const mockRenderer = jest.fn();
const mockEditor = jest.fn();
let mockSearch = "";
let mockSlug = "Portal%3AEurth";

jest.mock("next/navigation", () => ({
  useParams: () => ({ slug: mockSlug }),
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getWikitext: { prefetch: mockPrefetch } } }),
    wikios: { getArticleHtml: { useQuery: (...args: unknown[]) => mockUseQuery(...args) } },
  },
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({ setActiveModal: jest.fn() }),
}));
jest.mock("~/components/wiki-os/reader/ArticleRenderer", () => ({
  ArticleRenderer: (props: { title: string }) => {
    mockRenderer(props);
    return <article>{props.title}</article>;
  },
}));
jest.mock("~/components/wiki-os/reader/WikiOSMainPage", () => ({
  WikiOSMainPage: () => <div>main page</div>,
}));
jest.mock("~/components/wiki-os/editor/WikiEditBridge", () => ({
  WikiEditBridge: () => {
    mockEditor();
    return <div>editor</div>;
  },
}));

const article = {
  title: "Portal:Eurth",
  contentHtml: "<p>Eurth</p>",
  infoboxHtml: null,
  noticesHtml: null,
  toc: [],
  categories: [],
  lastModified: null,
  authorInfo: null,
};

function found(title = article.title) {
  mockUseQuery.mockReturnValue({
    data: { ...article, title },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
}

describe("WikiOS reader ?source=", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSlug = "Portal%3AEurth";
    mockSearch = "";
    Object.assign(window, { requestIdleCallback: (cb: () => void) => cb() });
    document.head.querySelector('link[rel="canonical"]')?.remove();
  });

  it("reads an iiwiki page from iiwiki and renders it as one", () => {
    mockSearch = "source=iiwiki";
    found();
    render(<WikiOSArticlePage />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      { title: "Portal:Eurth", wikiSource: "iiwiki" },
      expect.anything()
    );
    expect(mockRenderer).toHaveBeenCalledWith(expect.objectContaining({ wikiSource: "iiwiki" }));
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://iiwiki.com/wiki/Portal%3AEurth"
    );
    expect(mockPrefetch).not.toHaveBeenCalled(); // ixwiki wikitext only warms the ixwiki editor
  });

  it.each(["", "source=eurth", "source=IIWIKI"])("%p reads from ixwiki", (search) => {
    mockSearch = search;
    mockSlug = "Aurelia";
    found("Aurelia");
    render(<WikiOSArticlePage />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      { title: "Aurelia", wikiSource: "ixwiki" },
      expect.anything()
    );
    expect(mockRenderer).toHaveBeenCalledWith(expect.objectContaining({ wikiSource: "ixwiki" }));
    expect(mockPrefetch).toHaveBeenCalledWith({ title: "Aurelia" }, expect.anything());
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://ixwiki.com/wiki/Aurelia"
    );
  });

  it("never opens the ixwiki editor for another wiki's page", () => {
    mockSearch = "source=iiwiki&action=edit";
    found();
    render(<WikiOSArticlePage />);
    expect(mockEditor).not.toHaveBeenCalled();
    expect(mockRenderer).toHaveBeenCalled();
  });

  it("a missing iiwiki page names iiwiki and offers no ixwiki page creation", () => {
    mockSearch = "source=iiwiki";
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("not found"),
      refetch: jest.fn(),
    });
    render(<WikiOSArticlePage />);
    expect(screen.getByText(/does not exist on IIWiki/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create this page/i })).not.toBeInTheDocument();
  });
});
