/**
 * The picker's repository tab offers the same wiki sources as the page: IxWiki, IIWiki, Forum, and My uploads only
 * for a signed-in user. Forum and own uploads are plain lists, so they have no category browser.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { WikiRepositoryTab } from "~/components/wiki-os/media-search/WikiRepositoryTab";
import type { RepositoryImagesInput } from "~/components/wiki-os/media-search/useRepositoryImages";

let mockUser: { id: string } | null = { id: "u1" };
let hookCalls: RepositoryImagesInput[] = [];

jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: mockUser }) }));
jest.mock("~/components/wiki-os/media-search/MyStashTab", () => ({ MyStashTab: () => null }));
jest.mock("~/components/wiki-os/commons/CommonsDetailPanel", () => ({
  CommonsDetailPanel: () => null,
}));
jest.mock("~/components/wiki-os/commons/CommonsCategoryBrowser", () => ({
  CommonsCategoryBrowser: () => <div data-testid="category-browser" />,
}));
jest.mock("~/components/wiki-os/media-search/useRepositoryImages", () => ({
  useRepositoryImages: (input: RepositoryImagesInput) => {
    hookCalls.push(input);
    return {
      images: [],
      mode: "browse",
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

const renderTab = () =>
  render(
    <WikiRepositoryTab
      selectedImageObj={null}
      onSelectImage={jest.fn()}
      onDoubleClickConfirm={jest.fn()}
      isCategoryExpanded
      setIsCategoryExpanded={jest.fn()}
    />
  );

beforeEach(() => {
  hookCalls = [];
  mockUser = { id: "u1" };
});

describe("WikiRepositoryTab wiki sources", () => {
  it("offers Forum and My uploads when signed in, and passes signedIn on", () => {
    renderTab();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Wiki" }));
    expect(screen.getByRole("radio", { name: "Forum" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "My uploads" })).toBeInTheDocument();
    expect(hookCalls.at(-1)).toMatchObject({ source: "ixwiki", signedIn: true });
  });

  it("offers no My uploads when signed out", () => {
    mockUser = null;
    renderTab();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Wiki" }));
    expect(screen.getByRole("radio", { name: "Forum" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "My uploads" })).not.toBeInTheDocument();
    expect(hookCalls.at(-1)!.signedIn).toBe(false);
  });

  it("hides the category browser for the forum, and shows it for the wikis", () => {
    renderTab();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Wiki" }));
    expect(screen.getByTestId("category-browser")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Forum" }));
    expect(hookCalls.at(-1)).toMatchObject({ source: "forum" });
    expect(screen.queryByTestId("category-browser")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "IIWiki" }));
    expect(screen.getByTestId("category-browser")).toBeInTheDocument();
  });
});
