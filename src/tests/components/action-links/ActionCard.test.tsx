import { fireEvent, render, screen } from "@testing-library/react";

const cards = jest.fn();
const mine = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    actionLinks: {
      activityCards: { useQuery: (...args: unknown[]) => cards(...args) },
      myActivities: { useQuery: (...args: unknown[]) => mine(...args) },
    },
  },
}));

import { ActionCard, ActionPicker } from "~/components/action-links";

describe("ActionCard", () => {
  it("shows the action with a verified mark", () => {
    cards.mockReturnValue({
      data: [
        {
          id: "a1",
          title: "Signed the Northern Pact",
          type: "diplomatic",
          createdAt: new Date(0),
          country: { name: "Aurelia", slug: "aurelia", flag: null },
        },
      ],
      isLoading: false,
    });
    render(<ActionCard activityId="a1" />);
    expect(screen.getByText("Signed the Northern Pact")).toBeInTheDocument();
    expect(screen.getByText("Aurelia")).toBeInTheDocument();
    expect(screen.getByLabelText("Verified action")).toBeInTheDocument();
  });

  it("says unverified when the action is missing or private", () => {
    cards.mockReturnValue({ data: [], isLoading: false });
    render(<ActionCard activityId="gone" />);
    expect(screen.getByText("Unverified action")).toBeInTheDocument();
  });

  it("renders nothing while loading", () => {
    cards.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<ActionCard activityId="a1" />);
    expect(container).toBeEmptyDOMElement();
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
