import { fireEvent, render, screen } from "@testing-library/react";

const mine = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    actionLinks: {
      myActivities: { useQuery: (...args: unknown[]) => mine(...args) },
    },
  },
}));

import { ActionCardView, ActionPicker } from "~/components/action-links";

describe("ActionCardView", () => {
  it("shows the action with a verified mark", () => {
    render(
      <ActionCardView
        card={{
          id: "a1",
          title: "Signed the Northern Pact",
          type: "diplomatic",
          createdAt: new Date(0),
          country: { id: "c1", name: "Aurelia", slug: "aurelia", flag: null },
        }}
      />
    );
    expect(screen.getByText("Signed the Northern Pact")).toBeInTheDocument();
    expect(screen.getByText("Aurelia")).toBeInTheDocument();
    expect(screen.getByLabelText("Verified action")).toBeInTheDocument();
  });

  it("says unverified when the action is missing or private", () => {
    render(<ActionCardView card={null} />);
    expect(screen.getByText("Unverified action")).toBeInTheDocument();
  });
});

describe("ActionPicker", () => {
  it("inserts the action token and closes when an action is picked", () => {
    mine.mockReturnValue({
      data: [{ id: "a1", title: "Signed the Northern Pact", type: "diplomatic", createdAt: new Date(0) }],
    });
    const onPick = jest.fn();
    render(<ActionPicker onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /attach action/i }));
    fireEvent.click(screen.getByText("Signed the Northern Pact"));
    expect(onPick).toHaveBeenCalledWith("[ixaction=a1]");
    expect(screen.queryByPlaceholderText("Search your actions")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no public actions", () => {
    mine.mockReturnValue({ data: [] });
    render(<ActionPicker onPick={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /attach action/i }));
    expect(screen.getByText("No public actions yet")).toBeInTheDocument();
  });
});
