import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ArticlePageClient, {
  type ArticlePageClientProps,
} from "~/app/(wiki-os)/wiki/[...slug]/ArticlePageClient";

const mockUseQuery = jest.fn();
const mockPrefetch = jest.fn();
const mockRenderer = jest.fn();
const mockEditor = jest.fn();
const mockLayout = jest.fn();
const mockSetActiveModal = jest.fn();
let mockSearch = "";
let mockSignedIn = true;
let mockAuthLoaded = true;

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getWikitext: { prefetch: mockPrefetch } } }),
    wikios: { getArticleHtml: { useQuery: (...args: unknown[]) => mockUseQuery(...args) } },
  },
}));
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isSignedIn: mockSignedIn, isLoaded: mockAuthLoaded }),
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
jest.mock("~/components/wiki-os/reader/ArticleTabs", () => ({
  ArticleTabs: ({ title }: { title: string }) => <nav data-testid="tabs">{title}</nav>,
}));
jest.mock("~/components/wiki-os/editor/WikiEditBridge", () => ({
  WikiEditBridge: (props: Record<string, unknown>) => {
    mockEditor(props);
    return <div>editor</div>;
  },
}));

/** The reader as the route renders it: the route has already resolved the title and the wiki. */
function Reader(props: Partial<ArticlePageClientProps>) {
  return <ArticlePageClient title="Portal:Eurth" wikiSource="ixwiki" {...props} />;
}

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

describe("WikiOS reader (plan 412: title and wiki come from the route)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = "";
    mockSignedIn = true;
    mockAuthLoaded = true;
    Object.assign(window, { requestIdleCallback: (cb: () => void) => cb() });
    document.head.querySelector('link[rel="canonical"]')?.remove();
  });

  it("reads an iiwiki page from iiwiki and renders it as one", () => {
    found();
    render(<Reader wikiSource="iiwiki" />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      { title: "Portal:Eurth", wikiSource: "iiwiki" },
      expect.anything()
    );
    expect(mockRenderer).toHaveBeenCalledWith(expect.objectContaining({ wikiSource: "iiwiki" }));
    // Another wiki's page is client-rendered: it sets its own canonical link.
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://iiwiki.com/wiki/Portal%3AEurth"
    );
    expect(mockPrefetch).not.toHaveBeenCalled(); // ixwiki wikitext only warms the ixwiki editor
    expect(mockLayout).toHaveBeenCalledWith({ readOnly: true }); // no page tools (ruling E-l)
    expect(screen.queryByTestId("tabs")).not.toBeInTheDocument(); // no talk page on another wiki
  });

  it("reads an IxWiki page with the query the route primed, and leaves its canonical link to the server", () => {
    found("Aurelia");
    render(<Reader title="Aurelia" />);

    // The same key hover prefetch warms for IxWiki links and the route's server render primes
    expect(mockUseQuery).toHaveBeenCalledWith({ title: "Aurelia" }, expect.anything());
    expect(mockLayout).toHaveBeenCalledWith({ readOnly: false });
    expect(mockRenderer).toHaveBeenCalledWith(expect.objectContaining({ wikiSource: "ixwiki" }));
    expect(mockPrefetch).toHaveBeenCalledWith({ title: "Aurelia" }, expect.anything());
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(screen.getByTestId("tabs")).toHaveTextContent("Aurelia");
  });

  it("?redirect=no asks for the redirect page itself, with the input the route primed", () => {
    found("Old name");
    render(<Reader title="Old name" followRedirect={false} />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      { title: "Old name", redirect: "no" },
      expect.anything()
    );
  });

  it("says where the reader was redirected from", () => {
    found("New name");
    render(<Reader title="New name" redirectedFrom="Old name" />);

    expect(screen.getByText(/Redirected from/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Old name" })).toHaveAttribute(
      "href",
      "/wiki/Old_name?redirect=no"
    );
  });

  it("warms the editor's wikitext only for a signed-in reader (plan 404)", () => {
    found("Aurelia");

    mockSignedIn = false;
    render(<Reader title="Aurelia" />);
    expect(mockPrefetch).not.toHaveBeenCalled();

    mockSignedIn = true;
    render(<Reader title="Aurelia" />);
    expect(mockPrefetch).toHaveBeenCalledWith({ title: "Aurelia" }, expect.anything());
  });

  it("passes the page's own authorship through untouched: an IxWiki page gets none and loads it itself (plan 404)", () => {
    found("Aurelia");
    render(<Reader title="Aurelia" />);

    expect(mockRenderer).toHaveBeenCalledWith(expect.objectContaining({ authorInfo: null }));
  });

  it("puts a page's aside above the article and its children below it", () => {
    found("Aurelia");
    render(
      <Reader title="Aurelia" aside={<p>profile card</p>}>
        <p>member list</p>
      </Reader>
    );

    const card = screen.getByText("profile card");
    const body = screen.getByRole("article");
    const members = screen.getByText("member list");
    expect(card.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(body.compareDocumentPosition(members) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe("viewer-specific chips (the route reads the article as an anonymous viewer)", () => {
    const chipHtml =
      '<p>Your GDP: <span class="wikios-stat-resolved" data-key="MyCountry:gdp">No Country Loaded</span></p>';
    const withChips = (refetch: jest.Mock, contentHtml = chipHtml) =>
      mockUseQuery.mockReturnValue({
        data: { ...article, title: "Aurelia", contentHtml },
        isLoading: false,
        error: null,
        refetch,
      });

    it("a signed-in reader asks once more, with their session, for their own chips", () => {
      const refetch = jest.fn();
      withChips(refetch);
      const { rerender } = render(<Reader title="Aurelia" />);
      rerender(<Reader title="Aurelia" />);

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("waits for the session to load", () => {
      const refetch = jest.fn();
      mockAuthLoaded = false;
      withChips(refetch);
      render(<Reader title="Aurelia" />);

      expect(refetch).not.toHaveBeenCalled();
    });

    it("an anonymous reader keeps what the server sent, and so does a page with no such chip", () => {
      const refetch = jest.fn();
      mockSignedIn = false;
      withChips(refetch);
      const { unmount } = render(<Reader title="Aurelia" />);
      unmount();

      mockSignedIn = true;
      withChips(refetch, "<p>Population: 12,000,000</p>");
      render(<Reader title="Aurelia" />);

      expect(refetch).not.toHaveBeenCalled();
    });
  });

  describe("a stale article (its render still pending) is asked for again soon (plan 404 review)", () => {
    interface ArticleQueryOptions {
      staleTime: (query: { state: { data?: { stale: boolean } } }) => number;
      refetchInterval: (query: { state: { data?: { stale: boolean } } }) => number | false;
      retry: (failureCount: number, error: { data?: { code: string } }) => boolean;
      retryDelay: number;
    }
    const options = () => mockUseQuery.mock.calls.at(-1)![1] as ArticleQueryOptions;
    const queryWith = (data?: { stale: boolean }) => ({ state: { data } });

    it("refetches after ~5 s while the article is stale, and stops once it is not", () => {
      found("Aurelia");
      render(<Reader title="Aurelia" />);

      expect(options().refetchInterval(queryWith({ stale: true }))).toBe(5_000);
      expect(options().refetchInterval(queryWith({ stale: false }))).toBe(false);
      expect(options().refetchInterval(queryWith(undefined))).toBe(false);
    });

    it("never treats a stale article as fresh for ten minutes", () => {
      found("Aurelia");
      render(<Reader title="Aurelia" />);

      expect(options().staleTime(queryWith({ stale: true }))).toBe(0);
      expect(options().staleTime(queryWith({ stale: false }))).toBe(10 * 60 * 1000);
    });

    it("retries a busy answer (TOO_MANY_REQUESTS) twice, and nothing else", () => {
      found("Aurelia");
      render(<Reader title="Aurelia" />);

      const busy = { data: { code: "TOO_MANY_REQUESTS" } };
      expect(options().retry(0, busy)).toBe(true);
      expect(options().retry(1, busy)).toBe(true);
      expect(options().retry(2, busy)).toBe(false);
      expect(options().retry(0, { data: { code: "NOT_FOUND" } })).toBe(false);
      expect(options().retry(0, {})).toBe(false);
      expect(options().retryDelay).toBe(3_000);
    });
  });

  it("?margin=1 opens the margin on an IxWiki page only (ruling E-l′)", () => {
    mockSearch = "margin=1";
    found();
    render(<Reader wikiSource="iiwiki" />);
    expect(mockSetActiveModal).not.toHaveBeenCalled();

    found("Aurelia");
    render(<Reader title="Aurelia" />);
    expect(mockSetActiveModal).toHaveBeenCalledWith("margin");
  });

  it("never opens the ixwiki editor for another wiki's page", () => {
    mockSearch = "action=edit";
    found();
    render(<Reader wikiSource="iiwiki" initialEdit={{ mode: "source", section: null }} />);
    expect(mockEditor).not.toHaveBeenCalled();
    expect(mockRenderer).toHaveBeenCalled();
  });

  describe("the editor (?action=edit, kept working with plan 414's bridge)", () => {
    it("opens on load for initialEdit, at the section the URL named", () => {
      found("Aurelia");
      render(<Reader title="Aurelia" initialEdit={{ mode: "source", section: "Geography" }} />);

      expect(mockEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Aurelia",
          initialMode: "source",
          initialSection: "Geography",
          newSection: false,
        })
      );
      expect(mockRenderer).not.toHaveBeenCalled();
    });

    it("opens the visual editor on request", () => {
      found("Aurelia");
      render(<Reader title="Aurelia" initialEdit={{ mode: "visual", section: null }} />);
      expect(mockEditor).toHaveBeenCalledWith(expect.objectContaining({ initialMode: "visual" }));
    });

    it("section=new (Add topic) opens the source editor on a new topic, not at a heading named 'new'", () => {
      found("Talk:Aurelia");
      render(<Reader title="Talk:Aurelia" initialEdit={{ mode: "source", section: "new" }} />);
      expect(mockEditor).toHaveBeenCalledWith(
        expect.objectContaining({ initialSection: undefined, newSection: true })
      );
    });

    it("?action=edit in the address bar opens it too, without a server hint", () => {
      mockSearch = "action=edit";
      found("Aurelia");
      render(<Reader title="Aurelia" />);
      expect(mockEditor).toHaveBeenCalledWith(expect.objectContaining({ initialMode: "source" }));
    });
  });

  it("a missing IxWiki page offers to create it to a signed-in reader", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("not found"),
      refetch: jest.fn(),
    });
    render(<Reader title="Nowhere" />);
    expect(screen.getByText(/does not exist on IxWiki/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /create this page/i }));
    expect(mockEditor).toHaveBeenCalled();
  });

  it("a missing IxWiki page offers no creation to a signed-out reader", () => {
    mockSignedIn = false;
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("not found"),
      refetch: jest.fn(),
    });
    render(<Reader title="Nowhere" />);
    expect(screen.getByText(/does not exist on IxWiki/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create this page/i })).not.toBeInTheDocument();
  });

  describe("a busy answer (TOO_MANY_REQUESTS) is not a missing page (plan 404 review)", () => {
    const busyError = Object.assign(new Error("Importing pages from MediaWiki is busy"), {
      data: { code: "TOO_MANY_REQUESTS" },
    });

    it("says WikiOS is busy and offers a retry, never 'does not exist' or 'create this page'", () => {
      const refetch = jest.fn();
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: busyError,
        refetch,
      });
      render(<Reader title="Nowhere" />);

      expect(screen.getByText("WikiOS is busy")).toBeInTheDocument();
      expect(screen.queryByText(/does not exist/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /create this page/i })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /try again/i }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("shows a retrying state while the automatic retries run", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
        failureCount: 1,
      });
      render(<Reader title="Nowhere" />);

      expect(screen.getByText(/WikiOS is busy — retrying/)).toBeInTheDocument();
    });

    it("shows plain loading before any failure, and still not-found for any other error", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
        failureCount: 0,
      });
      const { unmount } = render(<Reader title="Nowhere" />);
      expect(screen.getByText("Loading article...")).toBeInTheDocument();
      unmount();

      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: Object.assign(new Error("nope"), { data: { code: "NOT_FOUND" } }),
        refetch: jest.fn(),
      });
      render(<Reader title="Nowhere" />);
      expect(screen.getByText(/does not exist on IxWiki/)).toBeInTheDocument();
    });
  });

  it("a missing iiwiki page names iiwiki and offers no ixwiki page creation", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("not found"),
      refetch: jest.fn(),
    });
    render(<Reader wikiSource="iiwiki" />);
    expect(screen.getByText(/does not exist on IIWiki/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create this page/i })).not.toBeInTheDocument();
  });

  it("the Main Page is the Main Page component, with no article query", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
    render(<Reader title="Main Page" />);

    expect(screen.getByText("main page")).toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledWith(
      { title: "Main Page" },
      expect.objectContaining({ enabled: false })
    );
  });
});
