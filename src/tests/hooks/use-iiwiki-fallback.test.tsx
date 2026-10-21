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
