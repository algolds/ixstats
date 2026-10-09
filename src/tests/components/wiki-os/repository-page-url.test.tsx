/**
 * Image repository page: the source, search, browsed category, filters and open file live in the URL, so a link
 * shares them and Back closes the detail panel.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";
import type { RepositoryImagesInput } from "~/components/wiki-os/media-search/useRepositoryImages";

const PATH = "/util/repository";
let replaceState: jest.SpyInstance;
let pushState: jest.SpyInstance;
let back: jest.SpyInstance;
let mockUser: { id: string } | null = { id: "u1" };
let mockHookCalls: RepositoryImagesInput[] = [];

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
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
/** The query string of the last URL written by `spy`. */
const writtenParams = (spy: jest.SpyInstance) =>
  new URLSearchParams(String(spy.mock.calls.at(-1)![2]).split("?")[1] ?? "");
/** Opens the page on `search`, as a shared link would. */
const openAt = (search: string) => {
  window.history.replaceState(null, "", search ? `${PATH}?${search}` : PATH);
  replaceState.mockClear();
};

beforeEach(() => {
  jest.restoreAllMocks();
  replaceState = jest.spyOn(window.history, "replaceState");
  pushState = jest.spyOn(window.history, "pushState");
  back = jest.spyOn(window.history, "back").mockImplementation(() => undefined);
  mockHookCalls = [];
  mockUser = { id: "u1" };
  mockImages = [image(1), image(2)];
  openAt("");
});

describe("repository page URL state", () => {
  it("starts from the URL: IIWiki is chosen and the search box holds the query", () => {
    openAt("src=iiwiki&q=flag");
    render(<RepositoryPage />);
    expect(lastHookCall()).toMatchObject({ source: "iiwiki", query: "flag", signedIn: true });
    expect(screen.getByRole("searchbox", { name: "Search files" })).toHaveValue("flag");
    expect(screen.getByRole("radio", { name: "IIWiki" })).toBeChecked();
    expect(replaceState).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("reads the type, orientation and browsed category from the URL", () => {
    openAt("src=ixwiki&cat=Flags&type=png&orient=portrait");
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
    openAt("src=nowhere&type=gif");
    render(<RepositoryPage />);
    expect(lastHookCall()).toMatchObject({ source: "commons", fileType: "all" });
  });

  it("pushes a history entry with file= when a tile is chosen", () => {
    openAt("src=iiwiki&q=flag");
    render(<RepositoryPage />);
    fireEvent.click(screen.getByRole("button", { name: "Flag 2.png" }));
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(replaceState).not.toHaveBeenCalled();
    expect(String(pushState.mock.calls[0]![2]).startsWith(`${PATH}?`)).toBe(true);
    const next = writtenParams(pushState);
    expect(next.get("file")).toBe(image(2).url);
    expect(next.get("src")).toBe("iiwiki");
    expect(next.get("q")).toBe("flag");
    expect(screen.getByLabelText("Detail")).toHaveTextContent("Flag 2.png");
  });

  it("closes a panel it opened with Back, so no extra history entry is left", () => {
    render(<RepositoryPage />);
    fireEvent.click(screen.getByRole("button", { name: "Flag 1.png" }));
    fireEvent.click(screen.getByRole("button", { name: "Close detail" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(replaceState).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Detail")).not.toBeInTheDocument();
  });

  it("opens the file named in the URL, and closes it by replacing the URL without file", () => {
    openAt(`src=iiwiki&file=${encodeURIComponent(image(2).url)}`);
    render(<RepositoryPage />);
    expect(screen.getByLabelText("Detail")).toHaveTextContent("Flag 2.png");

    fireEvent.click(screen.getByRole("button", { name: "Close detail" }));
    expect(back).not.toHaveBeenCalled();
    const next = writtenParams(replaceState);
    expect(next.has("file")).toBe(false);
    expect(next.get("src")).toBe("iiwiki");
  });

  it("changing the type replaces the URL and keeps the open file", () => {
    openAt(`src=iiwiki&file=${encodeURIComponent(image(1).url)}`);
    render(<RepositoryPage />);
    fireEvent.click(screen.getByRole("radio", { name: "PNG" }));
    expect(pushState).not.toHaveBeenCalled();
    const next = writtenParams(replaceState);
    expect(next.get("type")).toBe("png");
    expect(next.get("file")).toBe(image(1).url);
  });

  it("leaves defaults out of the URL", () => {
    openAt("type=png");
    render(<RepositoryPage />);
    const typeGroup = screen.getByRole("radiogroup", { name: "Filter by file type" });
    fireEvent.click(within(typeGroup).getByRole("radio", { name: "All" }));
    expect(replaceState.mock.calls.at(-1)![2]).toBe(PATH);
  });

  it("switching source drops the search, category and open file", () => {
    openAt(`src=iiwiki&q=flag&cat=Flags&file=${encodeURIComponent(image(1).url)}`);
    render(<RepositoryPage />);
    fireEvent.click(screen.getByRole("radio", { name: "Forum" }));
    const next = writtenParams(replaceState);
    expect(next.toString()).toBe("src=forum");
    expect(screen.queryByLabelText("Detail")).not.toBeInTheDocument();
  });

  it("follows Back and forward: popstate re-reads the URL into the page", () => {
    render(<RepositoryPage />);
    expect(lastHookCall()).toMatchObject({ source: "commons", fileType: "all" });

    act(() => {
      window.history.replaceState(null, "", `${PATH}?src=forum&type=svg`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(lastHookCall()).toMatchObject({ source: "forum", fileType: "svg" });
    expect(screen.getByRole("radio", { name: "Forum" })).toBeChecked();
  });

  it("closes the panel when Back removes file from the URL", () => {
    render(<RepositoryPage />);
    fireEvent.click(screen.getByRole("button", { name: "Flag 1.png" }));
    expect(screen.getByLabelText("Detail")).toBeInTheDocument();

    act(() => {
      window.history.replaceState(null, "", PATH);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByLabelText("Detail")).not.toBeInTheDocument();
  });

  it("offers My uploads only when signed in", () => {
    openAt("src=ixwiki");
    const { unmount } = render(<RepositoryPage />);
    expect(screen.getByRole("radio", { name: "My uploads" })).toBeInTheDocument();
    unmount();

    mockUser = null;
    render(<RepositoryPage />);
    expect(screen.queryByRole("radio", { name: "My uploads" })).not.toBeInTheDocument();
    expect(lastHookCall().signedIn).toBe(false);
  });
});
