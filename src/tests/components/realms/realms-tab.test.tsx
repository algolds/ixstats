import { fireEvent, render, screen } from "@testing-library/react";
import { RealmsTab } from "~/app/admin/realms/_components/RealmsTab";

const mutate = jest.fn();
const realm = {
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  description: null,
  status: "active",
  visibility: "public",
  ownerId: "system",
  updatedAt: "2026-09-28T12:00:00Z",
  settings: { maxNationsPerUser: 3 },
  maxNationsPerUser: 3,
  _count: { countries: 12 },
};

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ realms: { adminListRealms: { invalidate: jest.fn() } } }),
    realms: {
      adminListRealms: {
        useQuery: () => ({ data: [realm], isLoading: false, refetch: jest.fn() }),
      },
      adminCreateRealm: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      adminUpdateRealm: { useMutation: () => ({ mutate, isPending: false }) },
    },
  },
}));

describe("RealmsTab nation cap (decision 15)", () => {
  beforeEach(() => mutate.mockClear());

  it("shows each realm's nations-per-player cap", () => {
    render(<RealmsTab />);
    expect(screen.getByRole("columnheader", { name: "Nations per player" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "3" })).toBeInTheDocument();
  });

  it("edits the cap starting from the realm's current value and saves it", () => {
    render(<RealmsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Eurth" }));

    const field = screen.getByRole("spinbutton", { name: "Nations per player" });
    expect(field).toHaveValue(3);
    fireEvent.change(field, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Eurth" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r_eurth", maxNationsPerUser: 5 })
    );
  });
});
