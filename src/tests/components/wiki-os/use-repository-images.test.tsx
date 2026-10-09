/**
 * useRepositoryImages: the one results accumulator behind the image repository page and the picker's repository tab.
 * Commons pages come from `commons.search` (categories are `deepcat:` terms of the same search); the wiki sources (IxWiki,
 * IIWiki, forum, own uploads) come from cursor pages of `wikios.repositoryFiles`.
 */
import { act, renderHook } from "@testing-library/react";
import {
  useRepositoryImages,
  type RepositoryImagesInput,
} from "~/components/wiki-os/media-search/useRepositoryImages";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";

interface Page {
  images: CommonsImage[];
  nextOffset: number | null;
  totalHits: number | null;
}
interface FakeResult {
  data?: Page;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: { data?: { code?: string } } | null;
  refetch: jest.Mock;
}
type CommonsInput = { query: string; limit: number; offset: number };
interface WikiFile {
  name: string;
  title: string;
  url: string;
  thumbUrl: string | null;
  size: number;
  width: number;
  height: number;
  mime: string;
  blurhash: string | null;
}
interface WikiPage {
  files: WikiFile[];
  nextCursor: string | null;
}
interface FakeWikiResult extends Omit<FakeResult, "data"> {
  data?: WikiPage;
}
interface WikiInput {
  source: string;
  query?: string;
  category?: string;
  fileType?: string;
  cursor: string | null;
  limit: number;
}

const mockUseQueries = jest.fn();
let commonsInputs: CommonsInput[] = [];
let commonsAnswer: (input: CommonsInput) => FakeResult;
let wikiInputs: WikiInput[] = [];
let wikiAnswer: (input: WikiInput) => FakeWikiResult;

jest.mock("~/trpc/react", () => ({
  api: {
    useQueries: (...args: unknown[]) => mockUseQueries(...args),
  },
}));

const wikiFile = (n: number, over: Partial<WikiFile> = {}): WikiFile => ({
  name: `F${n}.jpg`,
  title: `File:F${n}.jpg`,
  url: `https://iiwiki.com/images/${n}.jpg`,
  thumbUrl: null,
  size: 10,
  width: 10,
  height: 10,
  mime: "image/jpeg",
  blurhash: null,
  ...over,
});

const okWiki = (data: WikiPage): FakeWikiResult => ({
  data,
  isPending: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
});

const image = (n: number, over: Partial<CommonsImage> = {}): CommonsImage => ({
  pageid: n,
  title: `File:Castle ${n}.jpg`,
  thumbUrl: `https://upload.example/thumb/${n}.jpg`,
  url: `https://upload.example/${n}.jpg`,
  descriptionUrl: "",
  width: 1200,
  height: 800,
  mime: "image/jpeg",
  description: "",
  artist: "",
  license: "",
  ...over,
});

const ok = (data: Page): FakeResult => ({
  data,
  isPending: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
});

const input = (over: Partial<RepositoryImagesInput> = {}): RepositoryImagesInput => ({
  source: "commons",
  query: "",
  categories: [],
  browsingCategory: null,
  fileType: "all",
  enabled: true,
  signedIn: true,
  ...over,
});

beforeEach(() => {
  commonsInputs = [];
  wikiInputs = [];
  commonsAnswer = () => ok({ images: [], nextOffset: null, totalHits: 0 });
  wikiAnswer = () => okWiki({ files: [], nextCursor: null });
  mockUseQueries.mockReset().mockImplementation((build: (t: unknown) => unknown[]) => {
    const t = {
      commons: { search: (args: CommonsInput) => ({ kind: "commons", args }) },
      wikios: { repositoryFiles: (args: WikiInput) => ({ kind: "wiki", args }) },
    };
    return (build(t) as Array<{ kind: string; args: CommonsInput & WikiInput }>).map(
      ({ kind, args }) => {
        if (kind === "wiki") {
          wikiInputs.push(args);
          return wikiAnswer(args);
        }
        commonsInputs.push(args);
        return commonsAnswer(args);
      }
    );
  });
});

describe("useRepositoryImages", () => {
  it("issues no query with an empty query and no category, and reports idle", () => {
    const { result } = renderHook(() => useRepositoryImages(input()));
    expect(commonsInputs).toEqual([]);
    expect(result.current.mode).toBe("idle");
    expect(result.current.images).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("lists wiki files as soon as the source is enabled, with no query or category", () => {
    const { result } = renderHook(() => useRepositoryImages(input({ source: "ixwiki" })));
    expect(wikiInputs.at(-1)).toEqual({
      source: "ixwiki",
      query: undefined,
      category: undefined,
      cursor: null,
      limit: 40,
    });
    // Not the Commons cold start.
    expect(result.current.mode).toBe("list");
  });

  it("does not list wiki files while the picker tab is not enabled", () => {
    renderHook(() => useRepositoryImages(input({ source: "iiwiki", enabled: false })));
    expect(wikiInputs).toEqual([]);
  });

  it("searches the wiki for a one-letter query, but Commons still waits for two characters", () => {
    const { result } = renderHook(() =>
      useRepositoryImages(input({ source: "ixwiki", query: "m" }))
    );
    expect(wikiInputs.at(-1)).toMatchObject({ source: "ixwiki", query: "m" });
    expect(result.current.mode).toBe("search");

    const commons = renderHook(() => useRepositoryImages(input({ query: "m" })));
    expect(commonsInputs).toEqual([]);
    expect(commons.result.current.mode).toBe("idle");
  });

  it("searches the wiki for a settled query, and for a browsed category", () => {
    renderHook(() => useRepositoryImages(input({ source: "iiwiki", query: "map" })));
    expect(wikiInputs.at(-1)).toEqual({
      source: "iiwiki",
      query: "map",
      category: undefined,
      cursor: null,
      limit: 40,
    });

    renderHook(() => useRepositoryImages(input({ source: "ixwiki", browsingCategory: "Flags" })));
    expect(wikiInputs.at(-1)).toMatchObject({
      source: "ixwiki",
      query: undefined,
      category: "Flags",
      cursor: null,
    });
  });

  it("filters IIWiki files by type client-side, and still sends the type", () => {
    wikiAnswer = () =>
      okWiki({
        files: Array.from({ length: 5 }, (_, i) =>
          wikiFile(i, i === 0 ? { name: "F0.png", mime: "image/png" } : {})
        ),
        nextCursor: null,
      });
    const { result } = renderHook(() =>
      useRepositoryImages(input({ source: "iiwiki", query: "ab", fileType: "png" }))
    );
    expect(result.current.images).toHaveLength(1);
    expect(result.current.hasMore).toBe(false);
    expect(wikiInputs[0]).toMatchObject({ fileType: "png" });
  });

  it("leaves IxWiki's type filter to the server: sends it and keeps every returned file", () => {
    wikiAnswer = () =>
      okWiki({ files: [wikiFile(1), wikiFile(2, { mime: "image/png" })], nextCursor: null });
    const { result } = renderHook(() =>
      useRepositoryImages(input({ source: "ixwiki", fileType: "svg" }))
    );
    expect(wikiInputs[0]).toMatchObject({ source: "ixwiki", fileType: "svg" });
    expect(result.current.images).toHaveLength(2);
  });

  it("sends no type when it is all, and starts again from the first cursor when the type changes", () => {
    wikiAnswer = ({ cursor }) =>
      okWiki({
        files: [wikiFile(cursor === null ? 1 : 2)],
        nextCursor: cursor === null ? "c2" : null,
      });
    const { result, rerender } = renderHook(
      (props: RepositoryImagesInput) => useRepositoryImages(props),
      { initialProps: input({ source: "ixwiki" }) }
    );
    expect(wikiInputs[0]!.fileType).toBeUndefined();
    act(() => result.current.loadMore());
    expect(result.current.images).toHaveLength(2);

    wikiInputs = [];
    rerender(input({ source: "ixwiki", fileType: "png" }));
    expect(wikiInputs.map((i) => [i.cursor, i.fileType])).toEqual([[null, "png"]]);
    expect(result.current.images).toHaveLength(1);
  });

  it("appends the next cursor on loadMore for a wiki source, and drops repeated files", () => {
    wikiAnswer = ({ cursor }) =>
      cursor === null
        ? okWiki({ files: [wikiFile(1), wikiFile(2)], nextCursor: "c2" })
        : okWiki({ files: [wikiFile(2), wikiFile(3)], nextCursor: null });
    const { result } = renderHook(() =>
      useRepositoryImages(input({ source: "ixwiki", query: "map" }))
    );
    expect(result.current.hasMore).toBe(true);
    expect(result.current.images).toHaveLength(2);

    act(() => result.current.loadMore());

    expect(wikiInputs.some((i) => i.cursor === "c2")).toBe(true);
    expect(result.current.images.map((i) => i.title)).toEqual([
      "File:F1.jpg",
      "File:F2.jpg",
      "File:F3.jpg",
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it("starts a wiki source again from the first cursor when the query changes", () => {
    wikiAnswer = ({ cursor }) =>
      okWiki({
        files: [wikiFile(cursor === null ? 1 : 2)],
        nextCursor: cursor === null ? "c2" : null,
      });
    const { result, rerender } = renderHook(
      (props: RepositoryImagesInput) => useRepositoryImages(props),
      { initialProps: input({ source: "ixwiki", query: "map" }) }
    );
    act(() => result.current.loadMore());
    expect(result.current.images).toHaveLength(2);

    wikiInputs = [];
    rerender(input({ source: "ixwiki", query: "flag" }));
    expect(wikiInputs.every((i) => i.cursor === null)).toBe(true);
    expect(wikiInputs.map((i) => i.query)).toEqual(["flag"]);
    expect(result.current.images).toHaveLength(1);
  });

  it("lists the forum's images with an empty query, newest first, and sends no category", () => {
    wikiAnswer = () => okWiki({ files: [wikiFile(1)], nextCursor: null });
    const { result } = renderHook(() =>
      useRepositoryImages(input({ source: "forum", browsingCategory: "Flags" }))
    );
    expect(wikiInputs).toEqual([
      { source: "forum", query: undefined, category: undefined, cursor: null, limit: 40 },
    ]);
    expect(result.current.images).toHaveLength(1);
    expect(result.current.mode).toBe("list");
  });

  it("lists own uploads when signed in, and issues nothing when signed out", () => {
    wikiAnswer = () => okWiki({ files: [wikiFile(1)], nextCursor: null });
    const signedIn = renderHook(() => useRepositoryImages(input({ source: "mine" })));
    expect(wikiInputs).toHaveLength(1);
    expect(wikiInputs[0]).toMatchObject({ source: "mine", cursor: null });
    expect(signedIn.result.current.images).toHaveLength(1);

    wikiInputs = [];
    const signedOut = renderHook(() =>
      useRepositoryImages(input({ source: "mine", signedIn: false }))
    );
    expect(wikiInputs).toEqual([]);
    expect(signedOut.result.current.images).toEqual([]);
    expect(signedOut.result.current.isLoading).toBe(false);
  });

  it("carries the blurhash of a wiki file onto its image", () => {
    wikiAnswer = () =>
      okWiki({
        files: [wikiFile(1, { blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj" })],
        nextCursor: null,
      });
    const { result } = renderHook(() => useRepositoryImages(input({ source: "forum" })));
    expect(result.current.images[0]!.blurhash).toBe("LEHV6nWB2yk8pyo0adR*.7kCMdnj");
  });

  it("reports a failed wiki page and retries only that page", () => {
    const failed: FakeWikiResult = {
      isPending: false,
      isFetching: false,
      isError: true,
      error: { data: { code: "INTERNAL_SERVER_ERROR" } },
      refetch: jest.fn(),
    };
    wikiAnswer = () => failed;
    const { result } = renderHook(() => useRepositoryImages(input({ source: "forum" })));
    expect(result.current.error).toEqual({ rateLimited: false });
    act(() => result.current.retry());
    expect(failed.refetch).toHaveBeenCalledTimes(1);
  });

  it("starts again from the first page when the query changes", () => {
    commonsAnswer = ({ offset }) =>
      ok({ images: [image(offset + 1)], nextOffset: offset === 0 ? 40 : null, totalHits: 80 });
    const { result, rerender } = renderHook(
      (props: RepositoryImagesInput) => useRepositoryImages(props),
      {
        initialProps: input({ query: "castle" }),
      }
    );
    act(() => result.current.loadMore());
    expect(result.current.images).toHaveLength(2);

    commonsInputs = [];
    rerender(input({ query: "harbour" }));
    expect(commonsInputs.every((i) => i.offset === 0)).toBe(true);
    expect(commonsInputs.map((i) => i.query)).toEqual(["harbour"]);
    expect(result.current.images).toHaveLength(1);
  });

  it("appends the next offset on loadMore and drops repeated images", () => {
    commonsAnswer = ({ offset }) =>
      offset === 0
        ? ok({ images: [image(1), image(2)], nextOffset: 40, totalHits: 3 })
        : ok({ images: [image(2), image(3)], nextOffset: null, totalHits: 3 });
    const { result } = renderHook(() => useRepositoryImages(input({ query: "castle" })));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.totalHits).toBe(3);

    act(() => result.current.loadMore());

    expect(commonsInputs.some((i) => i.offset === 40)).toBe(true);
    expect(result.current.images.map((i) => i.pageid)).toEqual([1, 2, 3]);
    expect(result.current.hasMore).toBe(false);
  });

  it("reports a failed page, marks a spent search bucket, and retries only the failed page", () => {
    const failed: FakeResult = {
      isPending: false,
      isFetching: false,
      isError: true,
      error: { data: { code: "TOO_MANY_REQUESTS" } },
      refetch: jest.fn(),
    };
    commonsAnswer = () => failed;
    const { result } = renderHook(() => useRepositoryImages(input({ query: "castle" })));
    expect(result.current.error).toEqual({ rateLimited: true });
    act(() => result.current.retry());
    expect(failed.refetch).toHaveBeenCalledTimes(1);
  });

  it("adds the file type to the Commons term", () => {
    renderHook(() => useRepositoryImages(input({ query: "castle", fileType: "png" })));
    expect(commonsInputs[0]!.query).toBe("filemime:image/png castle");
  });

  it("keeps a browsed category as a deepcat filter while typing", () => {
    const { result } = renderHook(() =>
      useRepositoryImages(input({ query: "castle", browsingCategory: "X" }))
    );
    expect(commonsInputs[0]!.query).toBe('deepcat:"X" castle');
    expect(result.current.mode).toBe("search");
  });

  it("browses a category with no query", () => {
    const { result } = renderHook(() =>
      useRepositoryImages(input({ categories: ["A"], browsingCategory: "B" }))
    );
    expect(commonsInputs[0]!.query).toBe('deepcat:"A" deepcat:"B"');
    expect(result.current.mode).toBe("browse");
  });

  it("uses the page size it is given", () => {
    renderHook(() => useRepositoryImages(input({ query: "castle", pageSize: 30 })));
    expect(commonsInputs[0]!.limit).toBe(30);
  });
});
