import { fireEvent, render, screen } from "@testing-library/react";
import { RealmsTab } from "~/app/admin/realms/_components/RealmsTab";

const mutate = jest.fn();
const assignFounder = jest.fn();
const deleteRealm = jest.fn();
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
      adminListUsers: { useQuery: () => ({ data: [] }) },
      region: {
        assignFounder: {
          useMutation: () => ({ mutateAsync: assignFounder, isPending: false }),
        },
        deleteRealm: { useMutation: () => ({ mutate: deleteRealm, isPending: false }) },
      },
    },
  },
}));

describe("RealmsTab nation cap (decision 15)", () => {
  beforeEach(() => {
    mutate.mockClear();
    assignFounder.mockClear();
  });

  it("shows a staff-administered realm's founder as IxStats staff", () => {
    render(<RealmsTab />);
    expect(screen.getByRole("columnheader", { name: "Founder" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "IxStats staff" })).toBeInTheDocument();
  });

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
    // The founder was left as it was: nothing to assign.
    expect(assignFounder).not.toHaveBeenCalled();
  });
});

describe("RealmsTab delete (AT-8)", () => {
  beforeEach(() => deleteRealm.mockClear());

  it("explains that a realm with nations is archived instead, with no way to delete it", () => {
    render(<RealmsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Eurth" }));
    expect(screen.getByText(/never releases or moves nations/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete realm" })).not.toBeInTheDocument();
  });

  it("deletes an empty realm once its slug is typed", () => {
    realm._count.countries = 0;
    render(<RealmsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Eurth" }));
    const confirm = screen.getByRole("button", { name: "Delete realm" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Realm slug" }), {
      target: { value: "eurth" },
    });
    fireEvent.click(confirm);
    expect(deleteRealm).toHaveBeenCalledWith({ realmId: "r_eurth", confirmSlug: "eurth" });
    realm._count.countries = 12;
  });
});
