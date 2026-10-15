import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useIiwikiFallback } from "~/hooks/useIiwikiFallback";

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
  it("stays out of the way while the server answers, and for other wikis", () => {
    const { result: served } = renderHook(() => useIiwikiFallback("Gylias", "iiwiki", false), {
      wrapper,
    });
    const { result: other } = renderHook(() => useIiwikiFallback("X", "althistory", true), {
      wrapper,
    });
    expect(served.current.active).toBe(false);
    expect(other.current.active).toBe(false);
    expect(mockRender).not.toHaveBeenCalled();
  });

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

  it("reports a page IIWiki does not have as missing", async () => {
    mockRender.mockResolvedValue(null);
    const { result } = renderHook(() => useIiwikiFallback("Nowhere", "iiwiki", true), { wrapper });
    await waitFor(() => expect(result.current.missing).toBe(true));
    expect(result.current.failed).toBe(false);
  });

  it("reports a browser IIWiki refuses as failed", async () => {
    mockRender.mockRejectedValue(new Error("IIWiki answered 403"));
    const { result } = renderHook(() => useIiwikiFallback("Gylias", "iiwiki", true), { wrapper });
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.article).toBeUndefined();
  });
});
