/**
 * WK-6: the image picker's Commons tab searches Wikimedia Commons through `commons.search` (debounced, paged with
 * "Load more"), with loading, empty and error states, and each file's licence and author; picking a Commons file
 * hands it on like an IxWiki one. WK-17: an IxWiki file's BlurHash is shown behind its thumbnail while it loads.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  commonsImageToResult,
  mergeCommonsPages,
  type CommonsSearchImage,
} from "~/components/wiki-os/editor/hooks/useCommonsImageSearch";
import { attributionLine, ImageSearchGrid } from "~/components/wiki-os/editor/ImageSearchGrid";

type Page = { images: CommonsSearchImage[]; nextOffset: number | null; totalHits: number | null };
interface FakeResult {
  data?: Page;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: { data?: { code?: string } } | null;
  refetch: jest.Mock;
}

const mockSearchFiles = jest.fn();
const mockUseQueries = jest.fn();
/** Every `commons.search` input the picker asked for, in order. */
let commonsInputs: Array<{ query: string; limit: number; offset: number }> = [];
/** The answer for one `commons.search` input. */
let commonsAnswer: (input: { query: string; offset: number }) => FakeResult;

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: { searchFiles: { useQuery: (...args: unknown[]) => mockSearchFiles(...args) } },
    useQueries: (...args: unknown[]) => mockUseQueries(...args),
  },
}));

const image = (n: number, over: Partial<CommonsSearchImage> = {}): CommonsSearchImage => ({
  title: `File:Harbour ${n}.jpg`,
  url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/Harbour_${n}.jpg`,
  thumbUrl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Harbour_${n}.jpg/300px-Harbour_${n}.jpg`,
  descriptionUrl: `https://commons.wikimedia.org/wiki/File%3AHarbour_${n}.jpg`,
  width: 1200,
  height: 800,
  mime: "image/jpeg",
  artist: "Jane Doe",
  license: "CC BY-SA 4.0",
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

beforeEach(() => {
  jest.useFakeTimers();
  commonsInputs = [];
  commonsAnswer = () => ok({ images: [], nextOffset: null, totalHits: 0 });
  mockSearchFiles.mockReset().mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockUseQueries.mockReset().mockImplementation((build: (t: unknown) => unknown[]) => {
    const t = {
      commons: {
        search: (input: { query: string; limit: number; offset: number }) => ({ input }),
      },
    };
    return (build(t) as Array<{ input: { query: string; limit: number; offset: number } }>).map(
      ({ input }) => {
        commonsInputs.push(input);
        return commonsAnswer(input);
      }
    );
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function openCommonsAndSearch(text: string) {
  fireEvent.click(screen.getByRole("radio", { name: /Commons/ }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search images" }), {
    target: { value: text },
  });
  act(() => {
    jest.advanceTimersByTime(400);
  });
}

describe("the Commons tab (WK-6)", () => {
  it("searches commons.search once the query has settled, and lists the images with their licence", () => {
    commonsAnswer = () => ok({ images: [image(1), image(2)], nextOffset: null, totalHits: 2 });
    render(<ImageSearchGrid compact />);

    expect(mockUseQueries).toHaveBeenCalled();
    expect(commonsInputs).toEqual([]); // nothing searched before a query

    openCommonsAndSearch("harbour");

    expect(commonsInputs).toContainEqual({ query: "harbour", limit: 30, offset: 0 });
    expect(screen.getByRole("img", { name: "File:Harbour 1.jpg" })).toHaveAttribute(
      "src",
      image(1).thumbUrl
    );
    expect(screen.getAllByText("CC BY-SA 4.0")).toHaveLength(2);
    expect(screen.getByText(/2 images found on Wikimedia Commons/)).toBeInTheDocument();
  });

  it("does not search a one-letter query", () => {
    render(<ImageSearchGrid compact />);
    openCommonsAndSearch("h");
    expect(commonsInputs).toEqual([]);
    expect(screen.getByText("Search for images")).toBeInTheDocument();
  });

  it("loads the next page from the offset Commons gave, keeping the first", () => {
    commonsAnswer = ({ offset }) =>
      offset === 0
        ? ok({ images: [image(1)], nextOffset: 30, totalHits: 45 })
        : ok({ images: [image(2)], nextOffset: null, totalHits: 45 });
    render(<ImageSearchGrid compact />);
    openCommonsAndSearch("harbour");

    expect(screen.getByText(/1 of 45 images shown on Wikimedia Commons/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more images" }));

    expect(commonsInputs).toContainEqual({ query: "harbour", limit: 30, offset: 30 });
    expect(screen.getByRole("img", { name: "File:Harbour 1.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "File:Harbour 2.jpg" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more images" })).not.toBeInTheDocument();
  });

  it("shows the loading state, then the empty state", () => {
    commonsAnswer = () => ({
      isPending: true,
      isFetching: true,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    const view = render(<ImageSearchGrid compact />);
    openCommonsAndSearch("zzzz");
    expect(screen.getByText("Searching Wikimedia Commons...")).toBeInTheDocument();

    commonsAnswer = () => ok({ images: [], nextOffset: null, totalHits: 0 });
    view.rerender(<ImageSearchGrid compact />);
    expect(screen.getByText(/No images found for/)).toBeInTheDocument();
  });

  it("says when the search bucket is spent, and retries only on request", () => {
    const refetch = jest.fn();
    commonsAnswer = () => ({
      isPending: false,
      isFetching: false,
      isError: true,
      error: { data: { code: "TOO_MANY_REQUESTS" } },
      refetch,
    });
    render(<ImageSearchGrid compact />);
    openCommonsAndSearch("harbour");

    expect(screen.getByRole("alert")).toHaveTextContent(/Too many Commons searches/);
    expect(refetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("hands a picked Commons file on with its attribution", () => {
    commonsAnswer = () => ok({ images: [image(1)], nextOffset: null, totalHits: 1 });
    const onSelect = jest.fn();
    render(<ImageSearchGrid compact onSelect={onSelect} />);
    openCommonsAndSearch("harbour");

    fireEvent.click(screen.getByRole("img", { name: "File:Harbour 1.jpg" }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "File:Harbour 1.jpg",
        source: "commons",
        license: "CC BY-SA 4.0",
        artist: "Jane Doe",
        descriptionUrl: image(1).descriptionUrl,
      })
    );
  });
});

describe("Commons results", () => {
  it("lists images only, each title once, and never a non-https address", () => {
    const pages = [
      { images: [image(1), image(2, { mime: "video/webm" })] },
      { images: [image(1), image(3, { url: "http://example.org/x.jpg" }), image(4)] },
    ];
    expect(mergeCommonsPages(pages).map((r) => r.title)).toEqual([
      "File:Harbour 1.jpg",
      "File:Harbour 4.jpg",
    ]);
    expect(commonsImageToResult(image(5, { thumbUrl: "" }))?.thumbUrl).toBe(image(5).url);
  });

  it("credits the licence and the author, or neither when Commons gave none", () => {
    expect(attributionLine({ license: "CC0", artist: "Jane" })).toBe("CC0 · Jane");
    expect(attributionLine({ license: "CC0" })).toBe("CC0");
    expect(attributionLine({ artist: " " })).toBeNull();
  });
});

describe("the IxWiki tab's BlurHash placeholder (WK-17)", () => {
  it("is drawn behind the thumbnail until it loads", () => {
    mockSearchFiles.mockReturnValue({
      data: [
        {
          title: "File:Flag.png",
          url: "/api/wiki/file/Flag.png",
          width: 40,
          height: 30,
          mime: "image/png",
          blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    render(<ImageSearchGrid compact />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search images" }), {
      target: { value: "flag" },
    });
    act(() => {
      jest.advanceTimersByTime(400);
    });

    const thumbnail = screen.getByRole("img", { name: "File:Flag.png" });
    expect(thumbnail.style.backgroundImage).toContain("data:image/svg+xml");
    fireEvent.load(thumbnail);
    expect(thumbnail.style.backgroundImage).toBe("");
  });
});
