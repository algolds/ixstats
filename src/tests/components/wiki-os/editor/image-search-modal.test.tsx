/**
 * The wiki editor's "Insert image" dialog uses the site-wide repository picker, limited to what an
 * article can hold: files on the wiki and on Commons.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import type { CommonsImage } from "~/components/wiki-os/media-search/types";

jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "u1" } }) }));

const flag: CommonsImage = {
  pageid: 1,
  title: "File:Flag of Caphiria.svg",
  thumbUrl: "https://example.test/flag-thumb.png",
  url: "https://example.test/flag.svg",
  descriptionUrl: "https://example.test/File:Flag_of_Caphiria.svg",
  width: 600,
  height: 400,
  mime: "image/svg+xml",
  description: "",
  artist: "",
  license: "",
};

const mockUseRepositoryImages = jest.fn();
jest.mock("~/components/wiki-os/media-search/useRepositoryImages", () => ({
  useRepositoryImages: (input: { source: string }) => {
    mockUseRepositoryImages(input);
    return {
      images: [flag],
      mode: "search",
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      loadMore: jest.fn(),
      totalHits: 1,
      error: null,
      retry: jest.fn(),
    };
  },
}));
jest.mock("~/components/wiki-os/commons/CommonsCategoryBrowser", () => ({
  CommonsCategoryBrowser: () => <nav aria-label="Category browser" />,
}));
jest.mock("~/components/wiki-os/commons/CommonsDetailPanel", () => ({
  CommonsDetailPanel: () => null,
}));
jest.mock("~/components/wiki-os/media-search/MyStashTab", () => ({ MyStashTab: () => null }));

import { ImageSearchModal } from "~/components/wiki-os/editor/ImageSearchModal";

function screenWidth(desktop: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

const sourceTabs = () =>
  screen
    .getByRole("tablist", { name: "Repository image sources" })
    .querySelectorAll('[role="tab"]');

describe("the editor's image picker", () => {
  beforeEach(() => screenWidth(true));

  it("offers exactly Wiki and Commons, and says why", () => {
    render(<ImageSearchModal isOpen onClose={jest.fn()} onInsert={jest.fn()} />);

    expect(Array.from(sourceTabs(), (tab) => tab.textContent).sort()).toEqual(["Commons", "Wiki"]);
    expect(
      screen.getByText("Only wiki and Commons files can be placed in an article.")
    ).toBeTruthy();
  });

  it("keeps the Wiki tab on the wiki's own files: no IIWiki, Forum or My uploads", () => {
    mockUseRepositoryImages.mockClear();
    render(<ImageSearchModal isOpen onClose={jest.fn()} onInsert={jest.fn()} />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Wiki" }));

    expect(screen.queryByRole("radiogroup", { name: "Wiki source selection" })).toBeNull();
    for (const name of ["IIWiki", "Forum", "My uploads"]) {
      expect(screen.queryByRole("radio", { name })).toBeNull();
    }
    expect(mockUseRepositoryImages).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: "ixwiki" })
    );
  });

  it("opens with the filters and the category browser on a desktop width", () => {
    render(<ImageSearchModal isOpen onClose={jest.fn()} onInsert={jest.fn()} />);

    expect(screen.getByRole("navigation", { name: "Category browser" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filters" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("inserts the selected file with the chosen size and alignment", () => {
    const onInsert = jest.fn();
    render(<ImageSearchModal isOpen onClose={jest.fn()} onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("button", { name: "Flag of Caphiria.svg" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));

    expect(onInsert).toHaveBeenCalledWith("[[File:Flag of Caphiria.svg|thumb|right]]");
  });

  it("adds the caption to the wikitext", () => {
    const onInsert = jest.fn();
    render(<ImageSearchModal isOpen onClose={jest.fn()} onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("button", { name: "Flag of Caphiria.svg" }));
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "The flag" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));

    expect(onInsert).toHaveBeenCalledWith("[[File:Flag of Caphiria.svg|thumb|right|The flag]]");
  });

  it("inserts the selected file with the default size on a double click", () => {
    const onInsert = jest.fn();
    render(<ImageSearchModal isOpen onClose={jest.fn()} onInsert={onInsert} />);

    const tile = screen.getByRole("button", { name: "Flag of Caphiria.svg" });
    fireEvent.click(tile);
    fireEvent.doubleClick(tile);

    expect(onInsert).toHaveBeenCalledWith("[[File:Flag of Caphiria.svg|thumb|right]]");
  });
});
