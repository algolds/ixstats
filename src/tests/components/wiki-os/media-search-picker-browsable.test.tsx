/**
 * The image picker (MediaSearchModal) opens browsable: on a desktop width the category browser and
 * the filters are already open, and a cold start offers the starter categories. On a narrow screen
 * the browser waits behind the Filters button.
 */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: null }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock("~/lib/media", () => ({
  processImageSelection: jest.fn(),
  isExternalImageUrl: () => false,
}));
jest.mock("~/components/wiki-os/media-search/useRepositoryImages", () => ({
  useRepositoryImages: () => ({
    images: [],
    mode: "idle",
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    loadMore: jest.fn(),
    totalHits: null,
    error: null,
    retry: jest.fn(),
  }),
}));
jest.mock("~/components/wiki-os/commons/CommonsCategoryBrowser", () => ({
  CommonsCategoryBrowser: () => <nav aria-label="Category browser" />,
}));
jest.mock("~/components/wiki-os/commons/CommonsResultsGrid", () => ({
  CommonsResultsGrid: () => null,
}));
jest.mock("~/components/wiki-os/commons/CommonsDetailPanel", () => ({
  CommonsDetailPanel: () => null,
}));
jest.mock("~/components/wiki-os/media-search/MyStashTab", () => ({ MyStashTab: () => null }));
jest.mock("~/components/wiki-os/media-search/UploadTab", () => ({ UploadTab: () => null }));

import { MediaSearchModal } from "~/components/wiki-os/media-search/MediaSearchModal";

function screenWidth(desktop: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

const openPicker = () =>
  render(<MediaSearchModal isOpen onClose={jest.fn()} onImageSelect={jest.fn()} />);
const browser = () => screen.queryByRole("navigation", { name: "Category browser" });

describe("the image picker opens browsable", () => {
  it("on a desktop width, shows the category browser, the filters and the starter categories", () => {
    screenWidth(true);
    openPicker();

    expect(browser()).not.toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Filter by file type" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Historical maps" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filters" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("on a narrow screen, keeps the browser behind the Filters button but still offers the starter categories", () => {
    screenWidth(false);
    openPicker();

    expect(browser()).toBeNull();
    expect(screen.getByRole("button", { name: "Castles" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(browser()).not.toBeNull();
  });

  it("offers every source, the stash included, outside the editor", () => {
    screenWidth(true);
    openPicker();

    const tabs = screen.getByRole("tablist", { name: "Repository image sources" });
    expect(Array.from(tabs.querySelectorAll('[role="tab"]'), (tab) => tab.textContent)).toEqual([
      "Commons",
      "Wiki",
      "My stash",
    ]);
    expect(
      screen.queryByText("Only wiki and Commons files can be placed in an article.")
    ).toBeNull();
  });
});
