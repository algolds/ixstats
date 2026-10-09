/**
 * useRepositoryImages: the one results accumulator behind the image repository page and the picker's repository tab.
 * Commons pages come from `commons.search` (categories are `deepcat:` terms of the same search); IxWiki and IIWiki files
 * come from `wikios.searchFiles`.
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

const mockSearchFiles = jest.fn();
const mockUseQueries = jest.fn();
let commonsInputs: CommonsInput[] = [];
let commonsAnswer: (input: CommonsInput) => FakeResult;

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: { searchFiles: { useQuery: (...args: unknown[]) => mockSearchFiles(...args) } },
    useQueries: (...args: unknown[]) => mockUseQueries(...args),
  },
}));

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
  ...over,
});

beforeEach(() => {
  commonsInputs = [];
  commonsAnswer = () => ok({ images: [], nextOffset: null, totalHits: 0 });
  mockSearchFiles.mockReset().mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  });
  mockUseQueries.mockReset().mockImplementation((build: (t: unknown) => unknown[]) => {
    const t = { commons: { search: (args: CommonsInput) => ({ args }) } };
    return (build(t) as Array<{ args: CommonsInput }>).map(({ args }) => {
      commonsInputs.push(args);
      return commonsAnswer(args);
    });
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

  it("does not search the wiki for a one-letter query", () => {
    renderHook(() => useRepositoryImages(input({ source: "ixwiki", query: "m" })));
    const options = mockSearchFiles.mock.calls.at(-1)![1] as { enabled: boolean };
    expect(options.enabled).toBe(false);
  });

  it("searches the wiki for a settled query, and for a browsed category", () => {
    renderHook(() => useRepositoryImages(input({ source: "iiwiki", query: "map" })));
    expect(mockSearchFiles.mock.calls.at(-1)![0]).toEqual({
      query: "map",
      category: undefined,
      limit: 50,
      wiki: "iiwiki",
    });
    expect((mockSearchFiles.mock.calls.at(-1)![1] as { enabled: boolean }).enabled).toBe(true);

    renderHook(() => useRepositoryImages(input({ source: "ixwiki", browsingCategory: "Flags" })));
    expect(mockSearchFiles.mock.calls.at(-1)![0]).toMatchObject({ category: "Flags" });
    expect((mockSearchFiles.mock.calls.at(-1)![1] as { enabled: boolean }).enabled).toBe(true);
  });

  it("filters wiki files by type and flags a result that hit the cap", () => {
    const files = Array.from({ length: 50 }, (_, i) => ({
      name: `F${i}.${i === 0 ? "png" : "jpg"}`,
      size: 10,
      width: 10,
      height: 10,
      mime: i === 0 ? "image/png" : "image/jpeg",
      url: `https://iiwiki.com/images/${i}`,
    }));
    mockSearchFiles.mockReturnValue({
      data: files,
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    const { result } = renderHook(() =>
      useRepositoryImages(input({ source: "iiwiki", query: "ab", fileType: "png" }))
    );
    expect(result.current.images).toHaveLength(1);
    expect(result.current.truncated).toBe(true);
    expect(result.current.hasMore).toBe(false);
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
