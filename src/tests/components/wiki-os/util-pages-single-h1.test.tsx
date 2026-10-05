/**
 * WikiOSLayout renders the page title as the one <h1> (via PageHeader), so the pages' own
 * header cards must use a lower heading level.
 */
import { render } from "@testing-library/react";

jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <main>
      {title ? <h1>{title}</h1> : null}
      {children}
    </main>
  ),
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
      },
    },
  };
});

import WatchlistPage from "~/app/(wiki-os)/util/watchlist/page";
import WikiTemplatesPage from "~/app/(wiki-os)/util/templates/page";

describe("WikiOS utility pages", () => {
  it.each([
    ["/util/watchlist", WatchlistPage],
    ["/util/templates", WikiTemplatesPage],
  ])("%s renders exactly one h1", (_route, Page) => {
    const { container } = render(<Page />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });
});
