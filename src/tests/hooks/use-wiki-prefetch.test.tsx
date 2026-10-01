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

  it("warms a subpage under its whole title (plan 412: /wiki/A/B is a page)", async () => {
    renderHook(() => useWikiPrefetch());
    await hover("/wiki/Prefetch_Template:Flag/doc");
    expect(mockArticlePrefetch).toHaveBeenCalledWith(
      { title: "Prefetch Template:Flag/doc" },
      expect.anything()
    );
    await hover("/wiki/Prefetch_Parent%2FChild");
    expect(mockArticlePrefetch).toHaveBeenCalledWith(
      { title: "Prefetch Parent/Child" },
      expect.anything()
    );
  });

  it("warms the canonical title, the key the reader asks for, and keeps a '%' in a title", async () => {
    renderHook(() => useWikiPrefetch());
    await hover("/wiki/prefetch_canonical");
    expect(mockArticlePrefetch).toHaveBeenCalledWith(
      { title: "Prefetch canonical" },
      expect.anything()
    );
    await hover("/wiki/100%25_Prefetch");
    expect(mockArticlePrefetch).toHaveBeenCalledWith({ title: "100% Prefetch" }, expect.anything());
  });

  it("warms nothing for a tool slug, a Special: page, another view of a page or a title that is none", async () => {
    renderHook(() => useWikiPrefetch());
    for (const href of [
      "/wiki/recent-changes",
      "/wiki/Special:Random",
      "/wiki/Prefetch_Edited?action=edit",
      "/wiki/Prefetch_Edited?action=history",
      "/wiki/Prefetch_Edited?oldid=5",
      "/wiki/a%5Bb",
      "/util/search",
    ]) {
      await hover(href);
    }
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
  });
});
