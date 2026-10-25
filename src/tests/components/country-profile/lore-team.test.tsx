/**
 * Native lore plan Task 5: the lore team on the country page's back face. The owner lists the co-authors, adds one by
 * IxnayID handle and removes one after confirming; a refusal shows in the server's words. Nobody else sees it, and
 * the team is not even asked for.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LoreTeam } from "~/components/country-profile/LoreTeam";

interface Member {
  userId: string;
  handle: string;
  displayName: string | null;
}

let mockAccess: { enabled: boolean; isOwner: boolean; canWrite: boolean } | undefined;
let mockMembers: Member[] | undefined;
let mockTeamFailed = false;
const mockTeamQuery = jest.fn();
const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockInvalidate = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ countryLore: { team: { invalidate: mockInvalidate } } }),
    countryLore: {
      access: { useQuery: () => ({ data: mockAccess }) },
      team: {
        useQuery: (input: object, options: { enabled: boolean }) => {
          mockTeamQuery(input, options);
          return options.enabled
            ? { data: mockMembers, isLoading: mockMembers === undefined, isError: mockTeamFailed }
            : { data: undefined, isLoading: false, isError: false };
        },
      },
      addAuthor: { useMutation: () => ({ mutateAsync: mockAdd, isPending: false }) },
      removeAuthor: { useMutation: () => ({ mutateAsync: mockRemove, isPending: false }) },
    },
  },
}));

const refusal = (code: string, message: string) =>
  Object.assign(new Error(message), { data: { code } });

const OWNER = { enabled: true, isOwner: true, canWrite: true };

beforeEach(() => {
  mockAccess = OWNER;
  mockMembers = [
    { userId: "u_livia", handle: "livia", displayName: "Livia Aurelia" },
    { userId: "u_marcus", handle: "marcus", displayName: null },
  ];
  mockTeamFailed = false;
  mockTeamQuery.mockClear();
  mockAdd.mockReset().mockResolvedValue({ userId: "u_new" });
  mockRemove.mockReset().mockResolvedValue({ removed: true });
  mockInvalidate.mockClear();
});

const team = () => screen.getByRole("region", { name: "Lore team" });

describe("LoreTeam", () => {
  it("lists the co-authors by name and handle; one with no name reads as a player", () => {
    render(<LoreTeam countryId="c_caph" />);
    const list = within(team()).getByRole("list");
    expect(within(list).getByText("Livia Aurelia")).toBeInTheDocument();
    expect(within(list).getByText("@livia")).toBeInTheDocument();
    expect(within(list).getByText("A player")).toBeInTheDocument();
    expect(within(list).getByText("@marcus")).toBeInTheDocument();
    expect(mockTeamQuery).toHaveBeenCalledWith({ countryId: "c_caph" }, { enabled: true });
  });

  it("says when there is no co-author yet", () => {
    mockMembers = [];
    render(<LoreTeam countryId="c_caph" />);
    expect(within(team()).getByText("No co-authors yet.")).toBeInTheDocument();
  });

  it("says when the team could not be loaded", () => {
    mockTeamFailed = true;
    mockMembers = [];
    render(<LoreTeam countryId="c_caph" />);
    expect(within(team()).getByText("The lore team could not be loaded.")).toBeInTheDocument();
  });

  it("shows a placeholder while the team loads", () => {
    mockMembers = undefined;
    render(<LoreTeam countryId="c_caph" />);
    expect(within(team()).getByRole("status")).toHaveAccessibleName("Loading the lore team");
  });

  it("adds a co-author by handle, then clears the field", async () => {
    render(<LoreTeam countryId="c_caph" />);
    const field = screen.getByLabelText("IxnayID handle");
    fireEvent.change(field, { target: { value: " cassia " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith({ countryId: "c_caph", handle: "cassia" })
    );
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalledWith({ countryId: "c_caph" }));
    await waitFor(() => expect(field).toHaveValue(""));
  });

  it("takes a leading @ off the handle", async () => {
    render(<LoreTeam countryId="c_caph" />);
    fireEvent.change(screen.getByLabelText("IxnayID handle"), { target: { value: " @ cassia" } });
    fireEvent.submit(screen.getByLabelText("IxnayID handle"));
    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith({ countryId: "c_caph", handle: "cassia" })
    );
  });

  it("does not send an empty handle", () => {
    render(<LoreTeam countryId="c_caph" />);
    fireEvent.change(screen.getByLabelText("IxnayID handle"), { target: { value: "  @ " } });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("IxnayID handle"));
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("shows the server's refusal and keeps the handle", async () => {
    mockAdd.mockRejectedValue(refusal("NOT_FOUND", "No IxnayID has that handle."));
    render(<LoreTeam countryId="c_caph" />);
    const field = screen.getByLabelText("IxnayID handle");
    fireEvent.change(field, { target: { value: "nobody" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No IxnayID has that handle.");
    expect(field).toHaveValue("nobody");
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("never shows a server error the owner cannot act on", async () => {
    mockAdd.mockRejectedValue(refusal("INTERNAL_SERVER_ERROR", "unique constraint"));
    render(<LoreTeam countryId="c_caph" />);
    fireEvent.change(screen.getByLabelText("IxnayID handle"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The lore team could not be changed just now."
    );
  });

  it("removes a co-author only after the owner confirms", async () => {
    render(<LoreTeam countryId="c_caph" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Livia Aurelia" }));
    const confirm = screen.getByRole("alertdialog", {
      name: "Remove Livia Aurelia from the lore team?",
    });
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep them" }));
    expect(mockRemove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove A player (@marcus)" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from the team" }));
    await waitFor(() =>
      expect(mockRemove).toHaveBeenCalledWith({ countryId: "c_caph", userId: "u_marcus" })
    );
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalledWith({ countryId: "c_caph" }));
  });

  it("shows a refused removal", async () => {
    mockRemove.mockRejectedValue(refusal("FORBIDDEN", "Only the country's owner can do this."));
    render(<LoreTeam countryId="c_caph" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Livia Aurelia" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from the team" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only the country's owner can do this."
    );
  });

  it("clears a refusal on the next try", async () => {
    mockAdd.mockRejectedValueOnce(refusal("CONFLICT", "They are already on the lore team."));
    render(<LoreTeam countryId="c_caph" />);
    fireEvent.change(screen.getByLabelText("IxnayID handle"), { target: { value: "livia" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("is not shown, nor the team asked for, to anyone but the owner while native lore is on", () => {
    for (const access of [
      undefined,
      { enabled: true, isOwner: false, canWrite: true },
      { enabled: false, isOwner: false, canWrite: false },
      { enabled: false, isOwner: true, canWrite: false },
    ]) {
      mockAccess = access;
      mockTeamQuery.mockClear();
      const { container, unmount } = render(<LoreTeam countryId="c_caph" />);
      expect(container).toBeEmptyDOMElement();
      expect(mockTeamQuery).toHaveBeenCalledWith({ countryId: "c_caph" }, { enabled: false });
      unmount();
    }
  });
});
