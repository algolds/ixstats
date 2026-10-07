import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClaimNationButton } from "~/components/realms/ClaimNationButton";
import { CountryIdentityStrip } from "~/components/country-profile/CountryIdentityStrip";
import { claimableNation } from "~/lib/realms/claimable-nation";

const mockMutate = jest.fn();
let mockSignedIn = true;
let mockRules: { summary: string } | null = null;

global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("~/context/auth-context", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: mockSignedIn }),
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      region: { overview: { useQuery: () => ({ data: { rules: mockRules } }) } },
      claimCountry: { useMutation: () => ({ mutate: mockMutate, isPending: false }) },
    },
    useUtils: () => ({
      realms: {
        myClaims: { invalidate: jest.fn() },
        getBySlug: { invalidate: jest.fn() },
        myNations: { invalidate: jest.fn() },
      },
      users: { getProfile: { invalidate: jest.fn() } },
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSignedIn = true;
  mockRules = null;
});

describe("ClaimNationButton", () => {
  it("renders nothing for signed-out viewers", () => {
    mockSignedIn = false;
    const { container } = render(<ClaimNationButton realmSlug="eurth" countryId="c1" countryName="Tavok" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("claims the existing country through the claim flow after confirming", () => {
    render(<ClaimNationButton realmSlug="eurth" countryId="c1" countryName="Tavok" label="Claim this nation" />);
    fireEvent.click(screen.getByRole("button", { name: "Claim this nation" }));
    fireEvent.click(screen.getByRole("button", { name: "Claim Tavok" }));
    expect(mockMutate).toHaveBeenCalledWith({ countryId: "c1" });
  });

  it("waits for the realm's rules to be accepted when the realm has rules", () => {
    mockRules = { summary: "Be nice." };
    render(<ClaimNationButton realmSlug="eurth" countryId="c1" countryName="Tavok" />);
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));
    const confirm = screen.getByRole("button", { name: "Claim Tavok" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(confirm);
    expect(mockMutate).toHaveBeenCalledWith({ countryId: "c1", acceptedRules: true });
  });
});

describe("CountryIdentityStrip", () => {
  it("shows Unclaimed with Claim this nation for an unclaimed realm nation", () => {
    render(
      <CountryIdentityStrip
        realm={{ name: "Eurth", slug: "eurth" }}
        sovereign={null}
        claim={{ countryId: "c1", countryName: "Tavok" }}
      />
    );
    expect(screen.getByText("Unclaimed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim this nation" })).toBeInTheDocument();
  });

  it("offers no claim for a held nation or an IxWorld nation", () => {
    const { rerender } = render(
      <CountryIdentityStrip
        realm={{ name: "Eurth", slug: "eurth" }}
        sovereign={{ username: "player" }}
        claim={{ countryId: "c1", countryName: "Tavok" }}
      />
    );
    expect(screen.queryByRole("button", { name: "Claim this nation" })).toBeNull();
    rerender(
      <CountryIdentityStrip
        realm={{ name: "IxWorld", slug: "ixworld" }}
        sovereign={null}
        claim={{ countryId: "c1", countryName: "Tavok" }}
      />
    );
    expect(screen.queryByRole("button", { name: "Claim this nation" })).toBeNull();
  });
});

describe("claimableNation", () => {
  const base = { id: "c1", name: "Bainbridge_Islands", owner: null, realm: { slug: "eurth", status: "active" } };

  it("is claimable when unowned in an open realm other than IxWorld", () => {
    expect(claimableNation(base)).toEqual({ countryId: "c1", countryName: "Bainbridge Islands" });
  });

  it("is not claimable when owned, in IxWorld, or in a closed realm", () => {
    expect(claimableNation({ ...base, owner: { id: "u" } })).toBeNull();
    expect(claimableNation({ ...base, ownerUserId: "u" })).toBeNull();
    expect(claimableNation({ ...base, realm: { slug: "ixworld", status: "active" } })).toBeNull();
    expect(claimableNation({ ...base, realm: { slug: "eurth", status: "archived" } })).toBeNull();
    expect(claimableNation({ ...base, realm: null })).toBeNull();
  });
});
