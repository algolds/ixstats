import { fireEvent, render, screen } from "@testing-library/react";
import { RealmsTab } from "~/app/admin/realms/_components/RealmsTab";

// Radix checkboxes measure themselves; jsdom has no ResizeObserver.
global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const mutate = jest.fn();
const transferOwner = jest.fn();
const deleteRealm = jest.fn();
const users = [
  {
    clerkUserId: "clerk_leader",
    isActive: true,
    nations: [{ id: "c1", name: "Aurelia", realmId: "r_eurth" }],
  },
  {
    clerkUserId: "clerk_gone",
    isActive: false,
    nations: [{ id: "c2", name: "Borea", realmId: "r_eurth" }],
  },
];
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
      adminListUsers: { useQuery: () => ({ data: users }) },
      region: {
        adminTransferOwner: {
          useMutation: () => ({ mutate: transferOwner, isPending: false }),
        },
        deleteRealm: { useMutation: () => ({ mutate: deleteRealm, isPending: false }) },
      },
    },
  },
}));

describe("RealmsTab nation cap (decision 15)", () => {
  beforeEach(() => mutate.mockClear());

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
    // Editing never changes the founder: that goes through Transfer.
    expect(transferOwner).not.toHaveBeenCalled();
  });
});

describe("RealmsTab transfer", () => {
  beforeEach(() => transferOwner.mockClear());

  it("hands the realm to an active player once its slug is typed, optionally keeping the founder", () => {
    realm.ownerId = "clerk_founder";
    render(<RealmsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Transfer Eurth" }));
    // Deactivated accounts are not offered.
    expect(screen.queryByRole("button", { name: /Borea/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find the new founder" }), {
      target: { value: "aur" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Aurelia/ }));
    const confirm = screen.getByRole("button", { name: "Transfer realm" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep previous owner as officer" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Realm slug" }), {
      target: { value: "eurth" },
    });
    fireEvent.click(confirm);
    expect(transferOwner).toHaveBeenCalledWith({
      realmId: "r_eurth",
      newOwnerId: "clerk_leader",
      confirmSlug: "eurth",
      keepPreviousAsOfficer: true,
    });
    realm.ownerId = "system";
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
