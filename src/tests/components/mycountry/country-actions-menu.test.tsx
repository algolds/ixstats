/** Dossier actions (WP-DE: P1-23 F16): a sanction or embargo takes effect at once, so it asks first. */
import { fireEvent, render, screen } from "@testing-library/react";
const mockPropose = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiLinkPreview: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});
jest.mock("~/hooks/useViewerPostingAccount", () => ({
  useViewerPostingAccount: () => "tp_account_gov",
}));
jest.mock("~/components/mycountry/dossier/useCountryDiplomacyActions", () => ({
  useCountryDiplomacyActions: () => ({
    isFollowing: false,
    isFollowPending: false,
    isEmbassyPending: false,
    isPending: false,
    toggleFollow: jest.fn(),
    establishEmbassy: jest.fn(),
    proposeForeignPolicy: mockPropose,
  }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    thinkpages: {
      createPost: {
        useMutation: () => ({ mutate: jest.fn(), isPending: false }),
      },
    },
    achievements: {
      getRecentByCountry: {
        useQuery: () => ({ data: [{ id: "a1", title: "First Port", description: "Opened a port" }] }),
      },
    },
  },
}));
import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
});
beforeEach(() => jest.clearAllMocks());

const renderMenu = () =>
  render(
    <CountryActionsMenu
      targetCountryId="target"
      targetCountryName="Beta"
      viewerCountryId="viewer_country"
      isOpen
      onClose={jest.fn()}
    />
  );

it("imposes an embargo only after the confirmation", () => {
  renderMenu();
  fireEvent.click(screen.getByRole("button", { name: "Declare embargo" }));
  expect(mockPropose).not.toHaveBeenCalled();
  const confirm = screen.getAllByRole("button", { name: "Declare embargo" }).at(-1)!;
  fireEvent.click(confirm);
  expect(mockPropose).toHaveBeenCalledWith("embargo");
});
