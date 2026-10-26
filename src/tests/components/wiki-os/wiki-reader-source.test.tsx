import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ArticlePageClient, {
  type ArticlePageClientProps,
} from "~/app/(wiki-os)/wiki/[...slug]/ArticlePageClient";

const mockUseQuery = jest.fn();
const mockPrefetch = jest.fn();
const mockEditAccessPrefetch = jest.fn();
const mockRenderer = jest.fn();
const mockEditor = jest.fn();
const mockGate = jest.fn();
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
    useUtils: () => ({
      wikios: {
        getWikitext: { prefetch: mockPrefetch },
        getEditAccess: { prefetch: mockEditAccessPrefetch },
      },
    }),
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
// the gate that opens the editor only for someone who may edit has its own tests (wiki-edit-gate.test.tsx)
jest.mock("~/components/wiki-os/editor/WikiEditGate", () => ({
  WikiEditGate: ({ children, title }: { children: ReactNode; title: string }) => {
    mockGate({ title });
    return <>{children}</>;
  },
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
  describe("a lean page (plan 413, item 8c) carries markers for the article's HTML", () => {
    const token = "123e4567-e89b-42d3-a456-426614174000";
    const lean = (refetch: jest.Mock) =>
      mockUseQuery.mockReturnValue({
        data: { ...article, title: "Aurelia", contentHtml: `wikios-lean:${token}:body` },
        isLoading: false,
        error: null,
        refetch,
      });
    it("treats that marker as no data: a loading state, never an article with an empty body", () => {
      mockSignedIn = false;
      lean(jest.fn());

      render(<Reader title="Aurelia" />);

      expect(screen.getByText("Loading article...")).toBeInTheDocument();
      expect(mockRenderer).not.toHaveBeenCalled();
    });
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
  });
  it("never opens the ixwiki editor for another wiki's page", () => {
    mockSearch = "action=edit";
    found();
    render(<Reader wikiSource="iiwiki" initialEdit={{ mode: "source", section: null }} />);
    expect(mockEditor).not.toHaveBeenCalled();
    expect(mockRenderer).toHaveBeenCalled();
  });
  describe("?prefill= on the edit URL (native lore plan Task 3: CreatePageModal's template reaches the editor)", () => {
    const openEdit = (search: string) => {
      mockSearch = search;
      found();
      render(<Reader title="Venceia" initialEdit={{ mode: "visual", section: null }} />);
      return mockEditor.mock.calls.at(-1)![0] as { prefillWikitext?: string };
    };

    it("hands the editor the decoded prefill", () => {
      const query = new URLSearchParams({
        action: "edit",
        prefill: "{{Infobox settlement\n}}\r\n+&#",
      });

      expect(openEdit(query.toString()).prefillWikitext).toBe("{{Infobox settlement\n}}\n+&#");
    });

    it("hands it nothing without a prefill, or for one over the limit", () => {
      expect(openEdit("action=edit").prefillWikitext).toBeUndefined();
      const huge = new URLSearchParams({ action: "edit", prefill: "x".repeat(20_000) });
      expect(openEdit(huge.toString()).prefillWikitext).toBeUndefined();
    });
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
  });
  it("a wiki that fails to answer is not called a missing page: the reader offers to try again", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: Object.assign(new Error("iiwiki could not render the page"), {
        data: { code: "BAD_GATEWAY" },
      }),
      refetch: jest.fn(),
    });
    render(<Reader wikiSource="iiwiki" />);
    expect(screen.queryByText(/does not exist/)).not.toBeInTheDocument();
    expect(screen.getByText("IIWiki could not be reached")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open on iiwiki/i })).toHaveAttribute(
      "href",
      "https://iiwiki.com/wiki/Portal:Eurth"
    );
  });
  describe("an unreachable sister wiki (SERVICE_UNAVAILABLE, plan 2026-10-25 sister wikis C3c)", () => {
    const unavailable = Object.assign(new Error("IIWiki could not be reached just now."), {
      data: { code: "SERVICE_UNAVAILABLE" },
    });

    it("an unreachable sister wiki shows could not be reached and Open on IIWiki, never not found", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: unavailable,
        refetch: jest.fn(),
      });
      render(<Reader title="Bashan" wikiSource="iiwiki" />);

      expect(screen.getByText("IIWiki could not be reached")).toBeInTheDocument();
      expect(screen.getByText(/could not be loaded from IIWiki just now/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Open on IIWiki" })).toHaveAttribute(
        "href",
        "https://iiwiki.com/wiki/Bashan"
      );
      expect(screen.queryByText(/does not exist|not found/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /create this page/i })).not.toBeInTheDocument();
    });

    it("does not retry an unreachable wiki on its own: the guard already rests it", () => {
      found();
      render(<Reader title="Bashan" wikiSource="iiwiki" />);
      const options = mockUseQuery.mock.calls[0]![1] as {
        retry: (failures: number, error: typeof unavailable) => boolean;
      };

      expect(options.retry(0, unavailable)).toBe(false);
    });
  });
  it("says which redirect of another wiki the reader came from, linking to that redirect on its own wiki", () => {
    mockUseQuery.mockReturnValue({
      data: { ...article, title: "Bashan Protectorate", resolvedFrom: "Bashan" },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<Reader title="Bashan" wikiSource="iiwiki" />);

    expect(screen.getByRole("note")).toHaveTextContent("(Redirected from Bashan)");
    expect(screen.getByRole("link", { name: "Bashan" })).toHaveAttribute(
      "href",
      "https://iiwiki.com/wiki/Bashan?redirect=no"
    );
  });
});
