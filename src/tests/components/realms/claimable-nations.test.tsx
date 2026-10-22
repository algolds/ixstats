import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClaimableNations } from "~/app/r/[realm]/_components/ClaimableNations";

const mockMutate = jest.fn();
const mockInvalidate = jest.fn();
const mockNotify = { success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() };
let mockSignedIn = true;
let mockSearch = "";

// Radix checkboxes measure themselves; jsdom has no ResizeObserver.
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
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mockSearch) }));
jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      myClaims: { useQuery: () => ({ data: [] }) },
      claimNationPage: {
        useMutation: () => {
          return { mutate: mockMutate, isPending: false };
        },
      },
    },
    useUtils: () => ({
      realms: {
        getBySlug: { invalidate: mockInvalidate },
        region: { invalidate: jest.fn() },
        myClaims: { invalidate: jest.fn() },
        myNations: { invalidate: jest.fn() },
      },
      users: { getProfile: { invalidate: jest.fn() } },
    }),
  },
}));

const pages = [
  { title: "Aurelia", wikiSource: "iiwiki" },
  { title: "Côte Rouge", wikiSource: "iiwiki" },
];

function renderList() {
  return render(<ClaimableNations realmSlug="eurth" pages={pages} />);
}

/** Tick the realm content consent (ToS §2.6) every claim needs. */
const agree = () => fireEvent.click(screen.getByRole("checkbox", { name: /my own work/ }));

describe("ClaimableNations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignedIn = true;
    mockSearch = "";
  });
  it("waits for the realm content consent and sends who gave permission", () => {
    renderList();
    const claim = screen.getByRole("button", { name: "Claim Aurelia" });
    expect(claim).toBeDisabled();
    agree();
    fireEvent.change(screen.getByRole("textbox", { name: "Who gave permission" }), {
      target: { value: " Kir " },
    });
    fireEvent.click(claim);
    expect(mockMutate).toHaveBeenCalledWith({
      realmSlug: "eurth",
      title: "Aurelia",
      consent: { accepted: true, permissionNote: "Kir" },
    });
  });
  it("an invite link's via survives sign-in through the redirect URL", () => {
    mockSignedIn = false;
    mockSearch = "via=ambassador";
    renderList();
    expect(screen.getByRole("link", { name: /sign in to claim/i })).toHaveAttribute(
      "href",
      `/sign-in?redirect_url=${encodeURIComponent("/r/eurth?via=ambassador")}`
    );
  });
});
