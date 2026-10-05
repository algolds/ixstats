import { fireEvent, render, screen } from "@testing-library/react";
import { WikiPageActions } from "~/components/wiki-os/shared/WikiPageActions";

const mockSetActiveModal = jest.fn();
const mockToggleMargin = jest.fn();
const mockStash = jest.fn();
const mockUnstash = jest.fn();
let mockStashed = false;
let mockMarginOpen = false;

jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({
    setActiveModal: mockSetActiveModal,
    toggleMargin: mockToggleMargin,
    isMarginOpen: mockMarginOpen,
  }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      wikios: {
        isStashed: { invalidate: jest.fn() },
        getStashes: { invalidate: jest.fn() },
        getArticleMarginData: { invalidate: jest.fn() },
      },
    }),
    wikios: {
      isStashed: { useQuery: () => ({ data: { stashed: mockStashed } }) },
      stashPage: { useMutation: () => ({ mutate: mockStash, isPending: false }) },
      unstashPage: { useMutation: () => ({ mutate: mockUnstash, isPending: false }) },
    },
  },
}));
jest.mock("~/hooks/useUserCountry", () => ({
  useUserCountry: () => ({ country: { id: "own" }, userProfile: { countryId: "own" } }),
}));
jest.mock("~/components/mycountry/dossier/CountryActionsMenu", () => ({
  CountryActionsMenu: ({
    isOpen,
    targetCountryName,
  }: {
    isOpen: boolean;
    targetCountryName: string;
  }) => (isOpen ? <div role="dialog">{`Actions for ${targetCountryName}`}</div> : null),
}));

const pageTools = { title: "Aurelia", isSignedIn: true, country: null };

function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Page tools" }), { key: "Enter" });
}

describe("WikiPageActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStashed = false;
    mockMarginOpen = false;
  });

  it("New page opens the create dialog", () => {
    const onNewPage = jest.fn();
    render(<WikiPageActions onNewPage={onNewPage} />);
    fireEvent.click(screen.getByRole("button", { name: "New page" }));
    expect(onNewPage).toHaveBeenCalledTimes(1);
  });

  it("has no tools menu without page tools", () => {
    render(<WikiPageActions onNewPage={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Page tools" })).toBeNull();
  });

  it("lists every tool the old rail offered", () => {
    render(<WikiPageActions onNewPage={jest.fn()} pageTools={pageTools} />);
    openMenu();
    for (const name of [
      "Show margin",
      "Revision history",
      "What links here",
      "Save to Stash",
      "Print",
      "Utilities",
    ]) {
      expect(screen.getByRole("menuitem", { name: new RegExp(name) })).toBeTruthy();
    }
    expect(screen.getByRole("menuitem", { name: /Utilities/ }).getAttribute("href")).toBe("/util");
  });

  it("opens the quick sheets and toggles the margin", () => {
    render(<WikiPageActions onNewPage={jest.fn()} pageTools={pageTools} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /What links here/ }));
    expect(mockSetActiveModal).toHaveBeenCalledWith("backlinks");
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Revision history/ }));
    expect(mockSetActiveModal).toHaveBeenCalledWith("history");
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Show margin/ }));
    expect(mockToggleMargin).toHaveBeenCalledTimes(1);
  });

  it("says Hide margin while the margin is open", () => {
    mockMarginOpen = true;
    render(<WikiPageActions onNewPage={jest.fn()} pageTools={pageTools} />);
    openMenu();
    expect(screen.getByRole("menuitem", { name: /Hide margin/ })).toBeTruthy();
  });

  it("stashes and unstashes the page", () => {
    const { unmount } = render(<WikiPageActions onNewPage={jest.fn()} pageTools={pageTools} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Save to Stash/ }));
    expect(mockStash).toHaveBeenCalledWith({ pageTitle: "Aurelia" });
    unmount();

    mockStashed = true;
    render(<WikiPageActions onNewPage={jest.fn()} pageTools={pageTools} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Remove from Stash/ }));
    expect(mockUnstash).toHaveBeenCalledWith({ pageTitle: "Aurelia" });
  });

  it("offers no stash to a signed-out reader", () => {
    render(
      <WikiPageActions onNewPage={jest.fn()} pageTools={{ ...pageTools, isSignedIn: false }} />
    );
    openMenu();
    expect(screen.queryByRole("menuitem", { name: /Stash/ })).toBeNull();
  });

  it("reaches the country's actions from the menu when the page names a country", () => {
    render(
      <WikiPageActions
        onNewPage={jest.fn()}
        pageTools={{ ...pageTools, country: { id: "c1", name: "Aurelia" } }}
      />
    );
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Country actions/ }));
    expect(screen.getByRole("dialog").textContent).toBe("Actions for Aurelia");
  });
});
