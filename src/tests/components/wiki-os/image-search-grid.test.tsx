/**
 * WK-6: the image picker's Commons tab searches Wikimedia Commons through `commons.search` (debounced, paged with
 * "Load more"), with loading, empty and error states, and each file's licence and author; picking a Commons file
 * hands it on like an IxWiki one. WK-17: an IxWiki file's BlurHash is shown behind its thumbnail while it loads.
 */
import {
  commonsImageToResult,
  mergeCommonsPages,
  type CommonsSearchImage,
} from "~/components/wiki-os/editor/hooks/useCommonsImageSearch";
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
});
