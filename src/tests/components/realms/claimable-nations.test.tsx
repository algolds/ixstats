import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClaimableNations } from "~/app/r/[realm]/_components/ClaimableNations";

type ClaimResult = { claimId: string; status: "pending" | "approved"; autoApproved: boolean };
type ClaimInput = { realmSlug: string; title: string };
interface MutationOptions {
  onSuccess?: (result: ClaimResult, input: ClaimInput) => void;
  onError?: (error: { message: string }) => void;
}

const mockMutate = jest.fn();
const mockInvalidate = jest.fn();
const mockNotify = { success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() };
let mockSignedIn = true;
let options: MutationOptions = {};

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
jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      myClaims: { useQuery: () => ({ data: [] }) },
      claimNationPage: {
        useMutation: (opts: MutationOptions) => {
          options = opts;
          return { mutate: mockMutate, isPending: false };
        },
      },
    },
    useUtils: () => ({
      realms: {
        getBySlug: { invalidate: mockInvalidate },
        region: { invalidate: jest.fn() },
        myClaims: { invalidate: jest.fn() },
      },
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

describe("ClaimableNations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignedIn = true;
    options = {};
  });

  it("links each nation page to the WikiOS reader for its wiki", () => {
    renderList();
    expect(screen.getByRole("link", { name: "Aurelia" })).toHaveAttribute(
      "href",
      "/wiki/Aurelia?source=iiwiki"
    );
    expect(screen.getByRole("link", { name: "Côte Rouge" })).toHaveAttribute(
      "href",
      `/wiki/${encodeURIComponent("Côte_Rouge")}?source=iiwiki`
    );
  });

  it("claims the page by realm slug and title", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Claim Aurelia" }));
    expect(mockMutate).toHaveBeenCalledWith({ realmSlug: "eurth", title: "Aurelia" });
  });

  it("a pending claim says a moderator will review it and how to be approved instantly", () => {
    mockMutate.mockImplementation((input: ClaimInput) =>
      options.onSuccess?.({ claimId: "cl1", status: "pending", autoApproved: false }, input)
    );
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Claim Aurelia" }));
    expect(mockNotify.info).toHaveBeenCalledWith(
      "Claim submitted",
      expect.stringMatching(
        /moderator will review it.*verify your wiki account in Settings to be approved instantly/i
      )
    );
    expect(screen.getByRole("button", { name: "Claim Aurelia" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Claim Aurelia" })).toHaveTextContent(/pending/i);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("an approved claim congratulates the player and refreshes the realm", () => {
    mockMutate.mockImplementation((input: ClaimInput) =>
      options.onSuccess?.({ claimId: "cl1", status: "approved", autoApproved: true }, input)
    );
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Claim Aurelia" }));
    expect(mockNotify.success).toHaveBeenCalledWith("Aurelia is yours", expect.any(String));
    expect(mockInvalidate).toHaveBeenCalledWith({ slug: "eurth" });
  });

  it("a refused claim shows the reason", () => {
    mockMutate.mockImplementation(() =>
      options.onError?.({ message: "This nation already belongs to another player" })
    );
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Claim Aurelia" }));
    expect(mockNotify.error).toHaveBeenCalledWith(
      "Claim failed",
      "This nation already belongs to another player"
    );
  });

  it("signed-out visitors get a sign-in link that returns to the realm instead of Claim buttons", () => {
    mockSignedIn = false;
    renderList();
    expect(screen.queryByRole("button", { name: /claim/i })).not.toBeInTheDocument();
    const signIn = screen.getByRole("link", { name: /sign in to claim/i });
    expect(signIn).toHaveAttribute(
      "href",
      `/sign-in?redirect_url=${encodeURIComponent("/r/eurth")}`
    );
  });
});
