import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const useQuery = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    actionLinks: {
      myActivities: {
        useQuery: (input: { search?: string }, options: { enabled: boolean }) =>
          useQuery(input, options),
      },
    },
  },
}));

import { ActionPicker } from "~/components/action-links/ActionPicker";

const created = new Date("2026-10-01T00:00:00Z");
// IxTime runs at twice real time from its epoch: 2026-10-01 reads as this in-world date.
const when = "Monday, May 12, 2042 (ILT)";
const rows = [
  { id: "dir-1", title: "Create jobs", type: "directive", createdAt: created },
  { id: "a2", title: "Embassy opened", type: "diplomatic", createdAt: created },
];

const open = () => fireEvent.click(screen.getByRole("button", { name: /Attach action/ }));

describe("ActionPicker", () => {
  beforeEach(() => {
    useQuery.mockReset();
    useQuery.mockReturnValue({ data: rows });
  });

  it("opens on a Recent list whose rows show the title, the type and the IxTime date", () => {
    render(<ActionPicker onPick={jest.fn()} />);
    open();
    expect(screen.getByText("Recent actions")).toBeInTheDocument();
    expect(screen.getByText("Create jobs")).toBeInTheDocument();
    expect(screen.getByText(`Directive · ${when}`)).toBeInTheDocument();
    expect(screen.getByText(`Diplomacy · ${when}`)).toBeInTheDocument();
    expect(useQuery).toHaveBeenLastCalledWith({ search: undefined }, { enabled: true });
  });

  it("only asks once it is open", () => {
    render(<ActionPicker onPick={jest.fn()} />);
    expect(useQuery).toHaveBeenLastCalledWith({ search: undefined }, { enabled: false });
  });

  it("inserts the picked action's token and closes", () => {
    const onPick = jest.fn();
    render(<ActionPicker onPick={onPick} />);
    open();
    fireEvent.click(screen.getByText("Create jobs"));
    expect(onPick).toHaveBeenCalledWith("[ixaction=dir-1]");
    expect(screen.queryByText("Recent actions")).toBeNull();
  });

  it("searches, and says it is showing matches", () => {
    render(<ActionPicker onPick={jest.fn()} />);
    open();
    fireEvent.change(screen.getByPlaceholderText("Search your actions"), {
      target: { value: " emb " },
    });
    expect(useQuery).toHaveBeenLastCalledWith({ search: "emb" }, { enabled: true });
    expect(screen.getByText("Matching actions")).toBeInTheDocument();
  });

  it("treats a blank search as the recent list", () => {
    render(<ActionPicker onPick={jest.fn()} />);
    open();
    fireEvent.change(screen.getByPlaceholderText("Search your actions"), {
      target: { value: "   " },
    });
    expect(useQuery).toHaveBeenLastCalledWith({ search: undefined }, { enabled: true });
    expect(screen.getByText("Recent actions")).toBeInTheDocument();
  });

  it("falls back to a neutral icon and label for a type it does not know", () => {
    useQuery.mockReturnValue({
      data: [{ id: "x1", title: "Something new", type: "brand-new", createdAt: created }],
    });
    render(<ActionPicker onPick={jest.fn()} />);
    open();
    expect(screen.getByText(`Action · ${when}`)).toBeInTheDocument();
  });

  it("says so when there is nothing to attach", () => {
    useQuery.mockReturnValue({ data: [] });
    render(<ActionPicker onPick={jest.fn()} />);
    open();
    expect(screen.getByText("No public actions yet")).toBeInTheDocument();
  });
});
