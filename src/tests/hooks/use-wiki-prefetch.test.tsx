import { renderHook, fireEvent, act } from "@testing-library/react";
import { useWikiPrefetch } from "~/hooks/useWikiPrefetch";

const mockArticlePrefetch = jest.fn().mockResolvedValue(undefined);
const mockWikitextPrefetch = jest.fn().mockResolvedValue(undefined);

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      wikios: {
        getArticleHtml: { prefetch: mockArticlePrefetch },
        getWikitext: { prefetch: mockWikitextPrefetch },
      },
    }),
  },
}));

async function hover(href: string) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = href;
  document.body.appendChild(link);
  fireEvent.mouseOver(link);
  await act(async () => {
    jest.advanceTimersByTime(60);
    await Promise.resolve();
  });
  link.remove();
}

describe("useWikiPrefetch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("warms an IxWiki article under the reader's key", async () => {
    renderHook(() => useWikiPrefetch());
    await hover("/wiki/Prefetch_Aurelia");
    expect(mockArticlePrefetch).toHaveBeenCalledWith(
      { title: "Prefetch Aurelia" },
      expect.anything()
    );
  });

  it("warms another wiki's article from that wiki, never the IxWiki page of the same title", async () => {
    renderHook(() => useWikiPrefetch());
    await hover("/wiki/Prefetch_Gallambria?source=iiwiki");
    expect(mockArticlePrefetch).toHaveBeenCalledTimes(1);
    expect(mockArticlePrefetch).toHaveBeenCalledWith(
      { title: "Prefetch Gallambria", wikiSource: "iiwiki" },
      expect.anything()
    );
  });

  it("keeps the two wikis' pages of one title apart", async () => {
    renderHook(() => useWikiPrefetch());
    await hover("/wiki/Prefetch_Borea?source=iiwiki");
    await hover("/wiki/Prefetch_Borea");
    expect(mockArticlePrefetch).toHaveBeenCalledWith(
      { title: "Prefetch Borea", wikiSource: "iiwiki" },
      expect.anything()
    );
    expect(mockArticlePrefetch).toHaveBeenCalledWith(
      { title: "Prefetch Borea" },
      expect.anything()
    );
  });
});
