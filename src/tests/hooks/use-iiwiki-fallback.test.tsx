/**
 * Other wikis' pages in the reader: when the server cannot render an iiwiki page the browser renders it, and hands
 * back the same article object on every render (a new one each time looped the reader); hovering a link warms that
 * wiki's page, never the IxWiki page of the same title. Folds use-wiki-prefetch.test.tsx.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, renderHook, waitFor } from "@testing-library/react";
import { useIiwikiFallback } from "~/hooks/useIiwikiFallback";
import { useWikiPrefetch } from "~/hooks/useWikiPrefetch";

const mockArticlePrefetch = jest.fn().mockResolvedValue(undefined);
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      wikios: {
        getArticleHtml: { prefetch: mockArticlePrefetch },
        getWikitext: { prefetch: jest.fn().mockResolvedValue(undefined) },
      },
    }),
  },
}));

const mockRender = jest.fn();
jest.mock("~/lib/wiki-os/iiwiki-browser-render", () => ({
  renderIiwikiInBrowser: (...args: unknown[]) => mockRender(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const page = {
  title: "Gylias",
  contentHtml: "<p>G</p>",
  infoboxHtml: null,
  noticesHtml: null,
  toc: [],
};

beforeEach(() => mockRender.mockReset());

describe("useIiwikiFallback", () => {
  it("renders the page in the browser once the server fails", async () => {
    mockRender.mockResolvedValue(page);
    const { result } = renderHook(() => useIiwikiFallback("Gylias", "iiwiki", true), { wrapper });
    await waitFor(() => expect(result.current.article?.contentHtml).toBe("<p>G</p>"));
    expect(result.current.article).toMatchObject({
      categories: [],
      lastModified: null,
      authorInfo: null,
    });
    expect(mockRender).toHaveBeenCalledWith("Gylias", expect.anything());
  });

  it("hands back the same article on every render (a new object each time loops the reader)", async () => {
    mockRender.mockResolvedValue(page);
    const { result, rerender } = renderHook(() => useIiwikiFallback("Gylias", "iiwiki", true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.article).toBeDefined());
    const first = result.current.article;
    rerender();
    expect(result.current.article).toBe(first);
    expect(result.current.article?.categories).toBe(first?.categories);
  });
});

describe("useWikiPrefetch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockArticlePrefetch.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it("warms each wiki's own page of a title, never the IxWiki page for another wiki's link", async () => {
    renderHook(() => useWikiPrefetch());
    for (const href of ["/wiki/Prefetch_Borea?source=iiwiki", "/wiki/Prefetch_Borea"]) {
      const link = document.body.appendChild(document.createElement("a"));
      link.href = href;
      fireEvent.mouseOver(link);
      await act(async () => {
        jest.advanceTimersByTime(60);
        await Promise.resolve();
      });
      link.remove();
    }
    expect(mockArticlePrefetch.mock.calls.map(([input]) => input)).toEqual([
      { title: "Prefetch Borea", wikiSource: "iiwiki" },
      { title: "Prefetch Borea" },
    ]);
  });
});
