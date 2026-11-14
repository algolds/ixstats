/** Dossier actions (WP-DE: P1-23 F16): a sanction or embargo takes effect at once, so it asks first. */
import { fireEvent, render, screen } from "@testing-library/react";
const mockPropose = jest.fn();
const mockEmbassy = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
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
jest.mock("~/components/shared/country-hero/CountryHeroCard", () => ({
  HeroDetailModal: ({ modal }: { modal: string }) => <div role="dialog">{`detail:${modal}`}</div>,
}));
const mockPush = jest.fn();
let mockStanding: { hasEmbassy: boolean; policy: (p: string) => string } = {
  hasEmbassy: false,
  policy: () => "open",
};
jest.mock("~/components/mycountry/dossier/useCountryDiplomacyActions", () => ({
  useCountryDiplomacyActions: () => ({
    isFollowing: false,
    isFollowPending: false,
    isEmbassyPending: false,
    isPending: false,
    crossRealm: false,
    get standing() {
      return mockStanding;
    },
    toggleFollow: jest.fn(),
    establishEmbassy: mockEmbassy,
    proposeForeignPolicy: mockPropose,
  }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      getByIdBasic: {
        useQuery: () => ({
          data: {
            slug: "beta",
            realm: { slug: "ixnay", name: "Ixnay" },
            ownerHandle: "beta_lead",
            currentPopulation: 12_000_000,
            currentTotalGdp: 450_000_000_000,
          },
        }),
      },
      getActivityRingsData: { useQuery: () => ({ data: undefined }) },
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
beforeEach(() => {
  jest.clearAllMocks();
  mockStanding = { hasEmbassy: false, policy: () => "open" };
});

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
  expect(screen.queryByRole("button", { name: /^Declare embargo/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Pressure/ }));
  fireEvent.click(screen.getByRole("button", { name: "Declare embargo Economy" }));
  expect(mockPropose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Declare embargo" }));
  expect(mockPropose).toHaveBeenCalledWith("embargo");
});

it("opens the nation in every app it lives in, with its leader's passport; its realm is the header pill", () => {
  renderMenu();
  const href = (name: string) => screen.getByRole("link", { name }).getAttribute("href");
  expect(href("Profile")).toBe("/countries/beta");
  expect(href("Map")).toBe("/maps?country=target&name=Beta");
  expect(href("Passport")).toBe("/id/beta_lead");
  expect(href("Exchange")).toBe("/exchange/n/target");
  expect(href("Ixnay")).toBe("/r/ixnay");
  expect(screen.queryByRole("link", { name: "Realm" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Cards" })).not.toBeInTheDocument();
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
  expect(screen.queryByRole("button", { name: /^Construct embassy/ })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Wiki" })).toBeInTheDocument();
});

it("shows the realm as a pill, and population and GDP under the quick actions", () => {
  renderMenu();
  expect(screen.getByRole("link", { name: "Ixnay" })).toHaveAttribute("href", "/r/ixnay");
  expect(screen.getByText(/^12(\.0)?M$/)).toBeInTheDocument();
  expect(screen.getByText(/^\$450/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Share Beta" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
});

it("groups the nation-to-nation acts under MyCountry, each naming the area it lands in", () => {
  renderMenu();
  expect(screen.getByRole("heading", { name: "MyCountry" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Diplomacy" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Construct embassy Diplomacy" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Propose free trade Economy" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Propose military alliance Diplomacy" })
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pressure Economy" })).toBeInTheDocument();
});

it("asks before proposing or building, and only acts on confirm", () => {
  renderMenu();
  fireEvent.click(screen.getByRole("button", { name: "Propose free trade Economy" }));
  expect(screen.getByText("Propose free trade to Beta?")).toBeInTheDocument();
  expect(mockPropose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Propose" }));
  expect(mockPropose).toHaveBeenCalledWith("free_trade");

  fireEvent.click(screen.getByRole("button", { name: "Construct embassy Diplomacy" }));
  expect(mockEmbassy).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Construct embassy" }));
  expect(mockEmbassy).toHaveBeenCalled();
});

it("shows what already stands, each opening MyCountry Diplomacy", () => {
  const states: Record<string, string> = {
    free_trade: "active",
    military_alliance: "incoming",
    sanction: "proposed",
  };
  mockStanding = { hasEmbassy: true, policy: (p) => states[p] ?? "open" };
  renderMenu();
  expect(screen.queryByRole("button", { name: /^Construct embassy/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Free trade in force/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Answer Beta's military alliance offer/ }));
  expect(mockPush).toHaveBeenCalledWith("/mycountry/diplomacy");
  fireEvent.click(screen.getByRole("button", { name: /^Embassy open/ }));
  expect(mockPush).toHaveBeenCalledTimes(2);
});

it("opens the detail sheet behind each figure in the strip", () => {
  renderMenu();
  fireEvent.click(screen.getByRole("button", { name: /^Population/ }));
  expect(screen.getByText("detail:population")).toBeInTheDocument();
});
