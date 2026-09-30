import { render, screen, fireEvent } from "@testing-library/react";
import { PlayAsNation } from "~/app/r/[realm]/_components/PlayAsNation";

interface MutationOptions {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}

const mockMutate = jest.fn();
const mockInvalidateProfile = jest.fn();
const mockNotify = { success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() };
let options: MutationOptions = {};

jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("~/trpc/react", () => ({
  api: {
    users: {
      setActiveNation: {
        useMutation: (opts: MutationOptions) => {
          options = opts;
          return { mutate: mockMutate, isPending: false };
        },
      },
    },
    useUtils: () => ({ users: { getProfile: { invalidate: mockInvalidateProfile } } }),
  },
}));

describe("PlayAsNation (ruling F-1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    options = {};
  });

  it("offers Play as for an owned nation that is not active, and switches to it", () => {
    render(<PlayAsNation countryId="e1" countryName="Gallambria" active={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Play as Gallambria" }));
    expect(mockMutate).toHaveBeenCalledWith({ countryId: "e1" });

    options.onSuccess?.();
    expect(mockInvalidateProfile).toHaveBeenCalledTimes(1);
    expect(mockNotify.success).toHaveBeenCalledWith("Playing as Gallambria", expect.any(String));
  });

  it("shows Active (no button) for the nation the player already acts as", () => {
    render(<PlayAsNation countryId="e1" countryName="Gallambria" active />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reports a refused switch", () => {
    render(<PlayAsNation countryId="e1" countryName="Gallambria" active={false} />);
    options.onError?.({ message: "You can only play as a nation you own" });
    expect(mockNotify.error).toHaveBeenCalledWith("Could not switch nation", "You can only play as a nation you own");
    expect(mockInvalidateProfile).not.toHaveBeenCalled();
  });
});
