/**
 * Image repository page: the source, search, browsed category, filters and open file live in the URL, so a link
 * shares them and Back closes the detail panel.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";
import type { RepositoryImagesInput } from "~/components/wiki-os/media-search/useRepositoryImages";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams = new URLSearchParams();
let mockUser: { id: string } | null = { id: "u1" };
let mockHookCalls: RepositoryImagesInput[] = [];

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useSearchParams: () => mockParams,
}));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: mockUser }) }));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: () => undefined }));
jest.mock("~/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
jest.mock("~/components/wiki-os/commons/CommonsCategoryBrowser", () => ({
  CommonsCategoryBrowser: () => null,
}));
jest.mock("~/components/wiki-os/commons/RepositoryWelcomeModal", () => ({
  RepositoryWelcomeModal: () => null,
}));
jest.mock("~/components/wiki-os/commons/CommonsDetailPanel", () => ({
  CommonsDetailPanel: ({ image, onClose }: { image: CommonsImage; onClose: () => void }) => (
    <aside aria-label="Detail">
      <span>{image.title}</span>
      <button type="button" onClick={onClose}>
        Close detail
      </button>
    </aside>
  ),
}));
jest.mock("~/components/wiki-os/media-search/useRepositoryImages", () => ({
  useRepositoryImages: (input: RepositoryImagesInput) => {
    mockHookCalls.push(input);
    return {
      images: mockImages,
      mode: "search",
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      loadMore: jest.fn(),
      totalHits: null,
      error: null,
      retry: jest.fn(),
    };
  },
}));

const image = (n: number): CommonsImage => ({
  pageid: n,
  title: `File:Flag ${n}.png`,
  thumbUrl: `/thumb/${n}.png`,
  url: `/api/mediawiki/iiwiki/images/${n}.png`,
  descriptionUrl: "",
  width: 40,
  height: 30,
  mime: "image/png",
  description: "",
  artist: "",
  license: "",
});
let mockImages: CommonsImage[] = [image(1), image(2)];

import RepositoryPage from "~/app/(wiki-os)/util/repository/page";

const lastHookCall = () => mockHookCalls.at(-1)!;
const hrefOf = (mock: jest.Mock) =>
  new URLSearchParams(String(mock.mock.calls.at(-1)![0]).slice(1));

beforeEach(() => {
  jest.clearAllMocks();
  mockHookCalls = [];
  mockUser = { id: "u1" };
  mockImages = [image(1), image(2)];
  mockParams = new URLSearchParams();
});

describe("repository page URL state", () => {
  it("starts from the URL: IIWiki is chosen and the search box holds the query", () => {
    mockParams = new URLSearchParams("src=iiwiki&q=flag");
    render(<RepositoryPage />);
    expect(lastHookCall()).toMatchObject({ source: "iiwiki", query: "flag", signedIn: true });
    expect(screen.getByRole("searchbox", { name: "Search files" })).toHaveValue("flag");
    expect(screen.getByRole("radio", { name: "IIWiki" })).toBeChecked();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("reads the type, orientation and browsed category from the URL", () => {
    mockParams = new URLSearchParams("src=ixwiki&cat=Flags&type=png&orient=portrait");
    render(<RepositoryPage />);
    expect(lastHookCall()).toMatchObject({
      source: "ixwiki",
      browsingCategory: "Flags",
      fileType: "png",
    });
    expect(screen.getByRole("radio", { name: "PNG" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Portrait" })).toBeChecked();
  });

  it("ignores a source or filter value it does not know", () => {
    mockParams = new URLSearchParams("src=nowhere&type=gif");
    render(<RepositoryPage />);
    expect(lastHookCall()).toMatchObject({ source: "commons", fileType: "all" });
  });

  it("pushes a history entry with file= when a tile is chosen", () => {
    mockParams = new URLSearchParams("src=iiwiki&q=flag");
    render(<RepositoryPage />);
    fireEvent.click(screen.getByRole("button", { name: "Flag 2.png" }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    const next = hrefOf(mockPush);
    expect(next.get("file")).toBe(image(2).url);
    expect(next.get("src")).toBe("iiwiki");
    expect(next.get("q")).toBe("flag");
    expect(screen.getByLabelText("Detail")).toHaveTextContent("Flag 2.png");
  });

  it("closes a panel it opened with Back, so no extra history entry is left", () => {
    render(<RepositoryPage />);
    fireEvent.click(screen.getByRole("button", { name: "Flag 1.png" }));
    fireEvent.click(screen.getByRole("button", { name: "Close detail" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Detail")).not.toBeInTheDocument();
  });

  it("opens the file named in the URL, and closes it by replacing the URL without file", () => {
    mockParams = new URLSearchParams(`src=iiwiki&file=${encodeURIComponent(image(2).url)}`);
    render(<RepositoryPage />);
    expect(screen.getByLabelText("Detail")).toHaveTextContent("Flag 2.png");

    fireEvent.click(screen.getByRole("button", { name: "Close detail" }));
    expect(mockBack).not.toHaveBeenCalled();
    const next = hrefOf(mockReplace);
    expect(next.has("file")).toBe(false);
    expect(next.get("src")).toBe("iiwiki");
  });

  it("changing the type replaces the URL and keeps the open file", () => {
    mockParams = new URLSearchParams(`src=iiwiki&file=${encodeURIComponent(image(1).url)}`);
    render(<RepositoryPage />);
    fireEvent.click(screen.getByRole("radio", { name: "PNG" }));
    expect(mockPush).not.toHaveBeenCalled();
    const next = hrefOf(mockReplace);
    expect(next.get("type")).toBe("png");
    expect(next.get("file")).toBe(image(1).url);
    expect(mockReplace.mock.calls.at(-1)![1]).toEqual({ scroll: false });
  });

  it("leaves defaults out of the URL", () => {
    mockParams = new URLSearchParams("type=png");
    render(<RepositoryPage />);
    const typeGroup = screen.getByRole("radiogroup", { name: "Filter by file type" });
    fireEvent.click(within(typeGroup).getByRole("radio", { name: "All" }));
    expect(hrefOf(mockReplace).toString()).toBe("");
  });

  it("switching source drops the search, category and open file", () => {
    mockParams = new URLSearchParams(
      `src=iiwiki&q=flag&cat=Flags&file=${encodeURIComponent(image(1).url)}`
    );
    render(<RepositoryPage />);
    fireEvent.click(screen.getByRole("radio", { name: "Forum" }));
    const next = hrefOf(mockReplace);
    expect(next.toString()).toBe("src=forum");
    expect(screen.queryByLabelText("Detail")).not.toBeInTheDocument();
  });

  it("offers My uploads only when signed in", () => {
    mockParams = new URLSearchParams("src=ixwiki");
    const { unmount } = render(<RepositoryPage />);
    expect(screen.getByRole("radio", { name: "My uploads" })).toBeInTheDocument();
    unmount();

    mockUser = null;
    render(<RepositoryPage />);
    expect(screen.queryByRole("radio", { name: "My uploads" })).not.toBeInTheDocument();
    expect(lastHookCall().signedIn).toBe(false);
  });
});
