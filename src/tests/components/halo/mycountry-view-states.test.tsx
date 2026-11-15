/** Halo AccountView: MyCountry | Passport switch, loading/signed-out/no-nation/error states, NationSide and PassportSide. */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AccountView } from "~/components/halo/views/account/AccountView";
import { setHaloMaterial } from "~/components/halo/halo-material";
import { saveDraft } from "~/lib/wiki-os/editor/draft-store";

const mockPush = jest.fn();
const mockUseUser = jest.fn();
const mockProfileQuery = jest.fn();
const mockPassportCardQuery = jest.fn();
const mockMyNationsQuery = jest.fn();
const mockCountryBasicQuery = jest.fn();
const mockSwitchNation = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      users: { getProfile: { invalidate: jest.fn() } },
      realms: { myNations: { invalidate: jest.fn() } },
    }),
    users: {
      getProfile: { useQuery: (...args: unknown[]) => mockProfileQuery(...args) },
      setActiveNation: { useMutation: () => ({ mutate: mockSwitchNation, isPending: false }) },
    },
    ixnayid: {
      getMyPassportCard: { useQuery: (...args: unknown[]) => mockPassportCardQuery(...args) },
    },
    realms: {
      myNations: { useQuery: (...args: unknown[]) => mockMyNationsQuery(...args) },
    },
    countries: {
      getByIdBasic: { useQuery: (...args: unknown[]) => mockCountryBasicQuery(...args) },
      getActivityRingsData: { useQuery: () => ({ data: undefined, isLoading: false }) },
    },
    vault: {
      getEquippedCosmeticsFor: { useQuery: () => ({ data: undefined }) },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => mockUseUser(),
  SignOutButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));
jest.mock("~/components/shared/country-hero/CountryHeroCard", () => ({
  HeroDetailModal: ({ modal }: { modal: string }) => <div role="dialog">{`detail:${modal}`}</div>,
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const signedIn = {
  user: {
    id: "u1",
    firstName: "Ada",
    fullName: "Ada Lovelace",
    username: "ada",
    imageUrl: "https://img.clerk.com/ada.png",
  },
  isLoaded: true,
};

const sampleCard = {
  preview: true as const,
  handle: "ada",
  displayName: "Persona Ada",
  avatarUrl: null,
  primaryNation: {
    name: "Caphiria",
    slug: "caphiria",
    flagUrl: null,
    realm: { name: "Ixnay", slug: "ixnay" },
    role: "founder" as const,
  },
  lorewards: { score: 420, rank: 3 },
  realmCount: 2,
  nationCount: 2,
  joinedAt: "2024-06-01T00:00:00Z",
  signature: "A. Lovelace",
  bio: null,
};

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
  localStorage.clear();
  setHaloMaterial("lens");
  mockPassportCardQuery.mockReturnValue({ data: sampleCard, isLoading: false });
  mockMyNationsQuery.mockReturnValue({ data: { activeCountryId: "c1", realms: [] } });
  mockCountryBasicQuery.mockReturnValue({
    data: {
      slug: "caphiria",
      realm: { slug: "ixnay", name: "Ixnay" },
      ownerHandle: "ada",
      currentPopulation: 20_000_000,
      currentTotalGdp: 800_000_000_000,
    },
  });
});

function renderView() {
  const onClose = jest.fn();
  const result = render(<AccountView onClose={onClose} />);
  return { onClose, ...result };
}

describe("AccountView states", () => {
  it("shows skeletons, not a sign-in prompt, while the profile loads", () => {
    mockUseUser.mockReturnValue(signedIn);
    mockProfileQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderView();
    expect(screen.queryByText("Sign in")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading your nation" })).toBeInTheDocument();
  });

  it("shows no sign-in prompt while the session itself loads", () => {
    mockUseUser.mockReturnValue({ user: null, isLoaded: false });
    mockProfileQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderView();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("opens on Passport when signed in without a nation, and offers to found one on the MyCountry side", async () => {
    mockUseUser.mockReturnValue(signedIn);
    mockProfileQuery.mockReturnValue({
      data: { countryId: null, country: null, role: { level: 100, displayName: "Member" } },
      isLoading: false,
      isError: false,
    });
    const { onClose } = renderView();

    expect(screen.getByRole("radio", { name: "Passport" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("link", { name: "Your Passport, @ada" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "MyCountry" }));
    expect(await screen.findByText("You don't have a nation yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Found a nation" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/builder");
  });

  it("offers a retry when the profile fails to load", () => {
    const refetch = jest.fn();
    mockUseUser.mockReturnValue(signedIn);
    mockProfileQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    renderView();
    expect(screen.getByText("Couldn't load your nation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("asks a signed-out visitor to sign in without rendering the MyCountry | Passport switch", () => {
    mockUseUser.mockReturnValue({ user: null, isLoaded: true });
    mockProfileQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderView();
    expect(screen.queryByRole("radiogroup", { name: "Account" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("remembers the last chosen side in localStorage across mounts", () => {
    mockUseUser.mockReturnValue(signedIn);
    mockProfileQuery.mockReturnValue({
      data: {
        countryId: "c1",
        membershipTier: "basic",
        country: { id: "c1", name: "Caphiria" },
      },
      isLoading: false,
      isError: false,
    });

    const { unmount } = renderView();
    expect(screen.getByRole("radio", { name: "MyCountry" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    fireEvent.click(screen.getByRole("radio", { name: "Passport" }));
    expect(localStorage.getItem("ixstats.halo-account-side")).toBe("passport");
    unmount();

    renderView();
    expect(screen.getByRole("radio", { name: "Passport" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("NationSide", () => {
  beforeEach(() => {
    mockUseUser.mockReturnValue(signedIn);
  });

  it("shows Premium with MyCountry logo beside the country name, omits Your nation, labels Manage MyCountry, and keeps Open in without Passport", () => {
    mockProfileQuery.mockReturnValue({
      data: {
        countryId: "c1",
        membershipTier: "mycountry_premium",
        country: { id: "c1", name: "Caphiria" },
      },
      isLoading: false,
      isError: false,
    });
    const { onClose } = renderView();

    const heading = screen.getByRole("heading", { level: 2, name: "Caphiria" });
    const premiumBadge = screen.getByText("Premium");
    expect(heading.parentElement).toContainElement(premiumBadge);
    expect(premiumBadge.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("Your nation")).toBeNull();
    expect(screen.queryByText("@ada")).toBeNull();

    const realmLink = screen.getByRole("link", { name: "Ixnay" });
    expect(realmLink.querySelector("img")).toHaveAttribute("src", "/images/ix-logo.svg");

    expect(screen.getByRole("button", { name: "Share Caphiria" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Manage MyCountry" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Manage" })).toBeNull();

    for (const tile of ["Dashboard", "Executive", "Diplomacy", "Politics"]) {
      expect(screen.getByRole("button", { name: tile })).toBeInTheDocument();
    }

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/countries/caphiria"
    );
    expect(screen.getByRole("link", { name: "Wiki" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Map" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exchange" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Passport" })).toBeNull();

    const editBtn = screen.getByRole("button", { name: "Edit" });
    fireEvent.keyDown(editBtn, { key: "Enter" });
    const mapEditorItem = screen.getByRole("menuitem", { name: /^Map editor/ });
    expect(screen.getByRole("menuitem", { name: /^Country editor/ })).toBeInTheDocument();
    fireEvent.click(mapEditorItem);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/mycountry/map-editor");
  });

  it("omits any membership badge for non-premium accounts and renders custom realm emblems or the Realms fallback mark", () => {
    mockProfileQuery.mockReturnValue({
      data: {
        countryId: "c1",
        membershipTier: "basic",
        country: { id: "c1", name: "Caphiria" },
      },
      isLoading: false,
      isError: false,
    });
    mockCountryBasicQuery.mockReturnValue({
      data: {
        slug: "caphiria",
        realm: { slug: "eurth", name: "Eurth", emblemUrl: "https://eurth.org/emblem.png" },
        ownerHandle: "ada",
        currentPopulation: 20_000_000,
        currentTotalGdp: 800_000_000_000,
      },
    });
    const { unmount } = renderView();
    expect(screen.queryByText("Basic")).toBeNull();
    expect(screen.queryByText("Premium")).toBeNull();

    const eurthImg = screen.getByRole("link", { name: "Eurth" }).querySelector("img");
    expect(eurthImg).toHaveAttribute("src", "https://eurth.org/emblem.png");
    expect(eurthImg).toHaveAttribute("referrerpolicy", "no-referrer");
    unmount();

    mockCountryBasicQuery.mockReturnValue({
      data: {
        slug: "caphiria",
        realm: { slug: "nova", name: "Nova", emblemUrl: null, thumbnail: null },
        ownerHandle: "ada",
        currentPopulation: 20_000_000,
        currentTotalGdp: 800_000_000_000,
      },
    });
    renderView();
    const novaLink = screen.getByRole("link", { name: "Nova" });
    expect(novaLink.querySelector("img")).toBeNull();
    expect(novaLink.querySelector("svg")).not.toBeNull();
  });
});

describe("PassportSide", () => {
  beforeEach(() => {
    localStorage.setItem("ixstats.halo-account-side", "passport");
    mockUseUser.mockReturnValue(signedIn);
  });

  it("renders the compact Passport link on a Facet Lens monogram & guilloché stage with Clerk name/avatar, role badge rules, shortcuts, and Sign out", () => {
    mockProfileQuery.mockReturnValue({
      data: {
        countryId: "c1",
        role: { level: 10, displayName: "Administrator" },
        country: { id: "c1", name: "Caphiria" },
      },
      isLoading: false,
      isError: false,
    });
    const { onClose, unmount } = renderView();

    const passportLink = screen.getByRole("link", { name: "Your Passport, @ada" });
    expect(passportLink).toHaveAttribute("href", "/id/ada");
    expect(passportLink.className).toContain("facet-press");
    const lensStage = passportLink.querySelector('[data-slot="passport-lens-stage"]');
    expect(lensStage).not.toBeNull();
    expect(lensStage?.querySelector(".facet-monogram")).not.toBeNull();
    expect(lensStage?.querySelectorAll("svg")).toHaveLength(2);
    const lensSurface = passportLink.querySelector(
      '[data-slot="facet-material"][data-layer="lens"]'
    );
    expect(lensSurface).not.toBeNull();
    expect(lensSurface?.className).toContain("facet-lens");

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.queryByText(/Founding member/i)).toBeNull();
    expect(screen.queryByText(/founder/i)).toBeNull();
    expect(screen.getByText("A. Lovelace")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Lorewards")).toBeInTheDocument();
    expect(screen.getByText("· 420 pts")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Wiki drafts" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Switch nation" })).toBeNull();
    expect(screen.queryByRole("button", { name: /View Passport/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Sign out/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vault" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/vault");
    unmount();

    // Base role ("Member", level 100) gets no role badge; Passport keeps its Lens surface across material modes.
    setHaloMaterial("chrome");
    mockProfileQuery.mockReturnValue({
      data: {
        countryId: "c1",
        role: { level: 100, displayName: "Member" },
        country: { id: "c1", name: "Caphiria" },
      },
      isLoading: false,
      isError: false,
    });
    renderView();
    expect(screen.queryByText("Member")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Your Passport, @ada" })
        .querySelector('[data-slot="facet-material"][data-layer="lens"]')
    ).not.toBeNull();
  });

  it("shows NationSwitcher when owning multiple nations and up to three Wiki drafts with Resume", () => {
    mockProfileQuery.mockReturnValue({
      data: {
        countryId: "c1",
        role: { level: 100, displayName: "Member" },
        country: { id: "c1", name: "Caphiria" },
      },
      isLoading: false,
      isError: false,
    });
    mockMyNationsQuery.mockReturnValue({
      data: {
        activeCountryId: "c1",
        realms: [
          {
            id: "r1",
            name: "Ixnay",
            nations: [
              { id: "c1", name: "Caphiria", flag: null },
              { id: "c2", name: "Vesperia", flag: null },
            ],
          },
        ],
      },
    });
    for (const [i, title] of ["Draft One", "Draft Two", "Draft Three", "Draft Four"].entries()) {
      saveDraft("u1", { title, source: "ixwiki", mode: "visual", wikitext: `body ${i}` });
      // Ensure distinct timestamps so newest three win deterministically
      const raw = localStorage.getItem(`wikios_draft:u1:ixwiki:${title.replace(/ /g, "_")}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        localStorage.setItem(
          `wikios_draft:u1:ixwiki:${title.replace(/ /g, "_")}`,
          JSON.stringify({ ...parsed, savedAt: 1_000_000 + i * 1000 })
        );
      }
    }

    const { onClose } = renderView();

    expect(screen.getByRole("navigation", { name: "Switch nation" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vesperia" }));
    expect(mockSwitchNation).toHaveBeenCalledWith({ countryId: "c2" });
    expect(onClose).not.toHaveBeenCalled();

    expect(screen.getByRole("heading", { name: "Wiki drafts" })).toBeInTheDocument();
    expect(screen.getByText("Draft Four")).toBeInTheDocument();
    expect(screen.getByText("Draft Three")).toBeInTheDocument();
    expect(screen.getByText("Draft Two")).toBeInTheDocument();
    expect(screen.queryByText("Draft One")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Draft Four/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/wiki/Draft_Four?action=edit");
  });
});
