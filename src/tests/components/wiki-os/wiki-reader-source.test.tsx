import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ArticlePageClient, {
  type ArticlePageClientProps,
} from "~/app/(wiki-os)/wiki/[...slug]/ArticlePageClient";
import type { useIiwikiFallback } from "~/hooks/useIiwikiFallback";

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
const inactiveFallback: ReturnType<typeof useIiwikiFallback> = {
  active: false,
  article: undefined,
  loading: false,
  missing: false,
  failed: false,
  retry: jest.fn(),
};
const mockFallback = jest.fn((..._args: unknown[]) => inactiveFallback);
jest.mock("~/hooks/useIiwikiFallback", () => ({
  useIiwikiFallback: (...args: unknown[]) => mockFallback(...args),
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
    mockFallback.mockReturnValue(inactiveFallback);
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
    expect(screen.getByText(/not the same as the page/)).toBeInTheDocument();
  });
});
