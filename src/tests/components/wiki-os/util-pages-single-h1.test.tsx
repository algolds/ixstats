/**
 * WikiOSLayout renders the page title as the one <h1> (via PageHeader), so the pages' own
 * header cards must use a lower heading level.
 */
import { render } from "@testing-library/react";

jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  // Like the real layout: the title is the page's h1 unless the page opts out with hideTitleHeading.
  WikiOSLayout: ({
    title,
    hideTitleHeading,
    children,
  }: {
    title?: string;
    hideTitleHeading?: boolean;
    children: React.ReactNode;
  }) => (
    <main>
      {title && !hideTitleHeading ? <h1>{title}</h1> : null}
      {children}
    </main>
  ),
}));
jest.mock("~/app/(wiki-os)/util/categories/_components/DomainCategoriesGrid", () => ({
  DomainCategoriesGrid: () => null,
}));
jest.mock("~/app/(wiki-os)/util/categories/_components/AlphabetIndexBar", () => ({
  AlphabetIndexBar: () => null,
}));
jest.mock("~/app/(wiki-os)/util/categories/_components/SovereignNationsGrid", () => ({
  SovereignNationsGrid: () => null,
}));
jest.mock("~/components/diff-viewer", () => ({ DiffViewer: () => null }));
jest.mock("~/components/wiki-os/templates/VisualInfoboxPreviewCard", () => ({
  VisualInfoboxPreviewCard: () => null,
}));
jest.mock("~/trpc/react", () => {
  const query = () => ({ data: undefined, isLoading: false, refetch: jest.fn() });
  const mutation = () => ({ mutate: jest.fn(), isPending: false });
  return {
    api: {
      useUtils: () => ({ wikios: new Proxy({}, { get: () => ({ invalidate: jest.fn() }) }) }),
      wikios: {
        getWatchlistFeed: { useQuery: query },
        getWatchlist: { useQuery: query },
        markAllWatchedVisited: { useMutation: mutation },
        unwatchPage: { useMutation: mutation },
        searchTemplates: { useQuery: query },
        getTemplateData: { useQuery: query },
        searchCategories: { useQuery: query },
      },
      countries: { getSelectList: { useQuery: query } },
    },
  };
});

import WatchlistPage from "~/app/(wiki-os)/util/watchlist/page";
import WikiTemplatesPage from "~/app/(wiki-os)/util/templates/page";
import CategoriesIndexPage from "~/app/(wiki-os)/util/categories/page";

describe("WikiOS utility pages", () => {
  it.each([
    ["/util/watchlist", WatchlistPage],
    ["/util/templates", WikiTemplatesPage],
    // hideTitleHeading and no title: the page's own header card carries the one h1.
    ["/util/categories", CategoriesIndexPage],
  ])("%s renders exactly one h1", (_route, Page) => {
    const { container } = render(<Page />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });
});
