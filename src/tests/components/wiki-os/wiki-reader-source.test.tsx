import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import WikiOSArticlePage from "~/app/(wiki-os)/wiki/[slug]/page";

const mockUseQuery = jest.fn();
const mockPrefetch = jest.fn();
const mockRenderer = jest.fn();
const mockEditor = jest.fn();
const mockLayout = jest.fn();
const mockSetActiveModal = jest.fn();
const mockReplace = jest.fn();
let mockSearch = "";
let mockSlug = "Portal%3AEurth";
let mockSignedIn = true;

jest.mock("next/navigation", () => ({
  useParams: () => ({ slug: mockSlug }),
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getWikitext: { prefetch: mockPrefetch } } }),
    wikios: { getArticleHtml: { useQuery: (...args: unknown[]) => mockUseQuery(...args) } },
  },
}));
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isSignedIn: mockSignedIn }),
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children, readOnly }: { children: ReactNode; readOnly?: boolean }) => {
    mockLayout({ readOnly });
    return <div>{children}</div>;
  },
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({ setActiveModal: mockSetActiveModal }),
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
    mockSignedIn = true;
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
    expect(mockLayout).toHaveBeenCalledWith({ readOnly: true }); // no page tools (ruling E-l)
  });

  it.each(["", "source=eurth", "source=IIWIKI"])("%p reads from ixwiki", (search) => {
    mockSearch = search;
    mockSlug = "Aurelia";
    found("Aurelia");
    render(<WikiOSArticlePage />);

    // The same key hover prefetch warms for IxWiki links
    expect(mockUseQuery).toHaveBeenCalledWith({ title: "Aurelia" }, expect.anything());
    expect(mockLayout).toHaveBeenCalledWith({ readOnly: false });
    expect(mockRenderer).toHaveBeenCalledWith(expect.objectContaining({ wikiSource: "ixwiki" }));
    expect(mockPrefetch).toHaveBeenCalledWith({ title: "Aurelia" }, expect.anything());
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://ixwiki.com/wiki/Aurelia"
    );
  });

  it("warms the editor's wikitext only for a signed-in reader (plan 404)", () => {
    mockSlug = "Aurelia";
    found("Aurelia");

    mockSignedIn = false;
    render(<WikiOSArticlePage />);
    expect(mockPrefetch).not.toHaveBeenCalled();

    mockSignedIn = true;
    render(<WikiOSArticlePage />);
    expect(mockPrefetch).toHaveBeenCalledWith({ title: "Aurelia" }, expect.anything());
  });

  it("passes the page's own authorship through untouched: an IxWiki page gets none and loads it itself (plan 404)", () => {
    mockSlug = "Aurelia";
    found("Aurelia");
    render(<WikiOSArticlePage />);

    expect(mockRenderer).toHaveBeenCalledWith(expect.objectContaining({ authorInfo: null }));
  });

  it("?margin=1 opens the margin on an IxWiki page only (ruling E-l′)", () => {
    mockSearch = "source=iiwiki&margin=1";
    found();
    render(<WikiOSArticlePage />);
    expect(mockSetActiveModal).not.toHaveBeenCalled();

    mockSearch = "margin=1";
    mockSlug = "Aurelia";
    found("Aurelia");
    render(<WikiOSArticlePage />);
    expect(mockSetActiveModal).toHaveBeenCalledWith("margin");
  });

  it("never opens the ixwiki editor for another wiki's page", () => {
    mockSearch = "source=iiwiki&action=edit";
    found();
    render(<WikiOSArticlePage />);
    expect(mockEditor).not.toHaveBeenCalled();
    expect(mockRenderer).toHaveBeenCalled();
  });

  it("a missing IxWiki page offers to create it", () => {
    mockSlug = "Nowhere";
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("not found"),
      refetch: jest.fn(),
    });
    render(<WikiOSArticlePage />);
    expect(screen.getByText(/does not exist on IxWiki/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /create this page/i }));
    expect(mockEditor).toHaveBeenCalled();
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

describe("WikiOS reader canonical titles (plan 403)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = "";
    Object.assign(window, { requestIdleCallback: (cb: () => void) => cb() });
  });

  it("moves a non-canonical URL to the canonical one, keeping the query string", () => {
    mockSlug = "foo_bar";
    mockSearch = "margin=threads";
    found("Foo bar");
    render(<WikiOSArticlePage />);

    expect(mockUseQuery).toHaveBeenCalledWith({ title: "Foo bar" }, expect.anything());
    expect(mockReplace).toHaveBeenCalledWith("/wiki/Foo_bar?margin=threads");
  });

  it("never redirects another wiki's page (?source=), which is read under its own title rules", () => {
    mockSlug = "foo_bar";
    mockSearch = "source=iiwiki";
    found("Foo bar");
    render(<WikiOSArticlePage />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      { title: "Foo bar", wikiSource: "iiwiki" },
      expect.anything()
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("gives another wiki's title no IxWiki namespace (Project: is not IxWiki:)", () => {
    mockSlug = "project%3Afoo";
    mockSearch = "source=althistory";
    found("Project:foo");
    render(<WikiOSArticlePage />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      { title: "Project:foo", wikiSource: "althistory" },
      expect.anything()
    );
  });

  it("never redirects a subpage title: its canonical path needs the catch-all route (plan 412)", () => {
    for (const slug of ["foo%2Fbar", "talk%3Afoo%2Fbar", "Foo/bar"]) {
      mockSlug = slug;
      found("Foo/bar");
      render(<WikiOSArticlePage />);
    }

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockUseQuery).toHaveBeenCalledWith({ title: "Foo/bar" }, expect.anything());
    expect(mockUseQuery).toHaveBeenCalledWith({ title: "Talk:Foo/bar" }, expect.anything());
  });

  it("keeps a namespace colon literal and carries a fragment typed into the path", () => {
    mockSlug = "user%20talk%3Ajane%23Notes";
    found("User talk:Jane");
    render(<WikiOSArticlePage />);

    expect(mockReplace).toHaveBeenCalledWith("/wiki/User_talk:Jane#Notes");
  });

  it("does not redirect a URL that already is canonical, however it is percent-encoded", () => {
    for (const slug of ["Portal%3AEurth", "Portal:Eurth", "100%25_Pure"]) {
      mockSlug = slug;
      found();
      render(<WikiOSArticlePage />);
    }

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockUseQuery).toHaveBeenCalledWith({ title: "100% Pure" }, expect.anything());
  });

  it("decodes the segment once: a title with '%' reaches the query intact", () => {
    mockSlug = "100%25_Pure";
    found("100% Pure");
    render(<WikiOSArticlePage />);

    expect(mockUseQuery).toHaveBeenCalledWith({ title: "100% Pure" }, expect.anything());
  });

  it("renders the not-found state for a title MediaWiki would refuse, without querying", () => {
    mockSlug = "a%5Bb";
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
    render(<WikiOSArticlePage />);

    expect(screen.getByText(/does not exist on IxWiki/)).toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
