/** Dossier actions (WP-DE: P1-23 F16): a sanction or embargo takes effect at once, so it asks first. */
import { fireEvent, render, screen } from "@testing-library/react";
const mockPropose = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));
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
    countries: {
      getByIdBasic: {
        useQuery: () => ({
          data: { slug: "beta", realm: { slug: "ixnay", name: "Ixnay" }, ownerHandle: "beta_lead" },
        }),
      },
      getActivityRingsData: { useQuery: () => ({ data: undefined }) },
    },
    thinkpages: {
      createPost: {
        useMutation: () => ({ mutate: jest.fn(), isPending: false }),
      },
    },
    achievements: {
      getRecentByCountry: {
        useQuery: () => ({
          data: [{ id: "a1", title: "First Port", description: "Opened a port" }],
        }),
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

it("imposes an embargo only after opening Pressure and confirming", () => {
  renderMenu();
  expect(screen.queryByRole("button", { name: "Declare embargo" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pressure" }));
  fireEvent.click(screen.getByRole("button", { name: "Declare embargo" }));
  expect(mockPropose).not.toHaveBeenCalled();
  const confirm = screen.getAllByRole("button", { name: "Declare embargo" }).at(-1)!;
  fireEvent.click(confirm);
  expect(mockPropose).toHaveBeenCalledWith("embargo");
});

it("opens the nation in every app it lives in, with its leader's passport and realm", () => {
  renderMenu();
  const href = (name: string) => screen.getByRole("link", { name }).getAttribute("href");
  expect(href("Profile")).toBe("/countries/beta");
  expect(href("Map")).toBe("/maps?country=target&name=Beta");
  expect(href("Passport")).toBe("/id/beta_lead");
  expect(href("Exchange")).toBe("/exchange/n/target");
  expect(href("Realm")).toBe("/r/ixnay");
  expect(href("Cards")).toBe("/vault/cards/explore?country=target");
});

it("shows your own nation's management instead of diplomacy", () => {
  render(
    <CountryActionsMenu
      targetCountryId="target"
      targetCountryName="Beta"
      viewerCountryId="target"
      isOpen
      isOwnCountry
      onClose={jest.fn()}
    />
  );
  expect(screen.getByRole("button", { name: "Editor" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Construct embassy" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Wiki" })).toBeInTheDocument();
});
