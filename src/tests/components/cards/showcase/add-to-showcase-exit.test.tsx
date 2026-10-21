import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const invalidate = () => ({ invalidate: jest.fn() });
  const utils = {
    cards: { listMyShowcases: invalidate(), getShowcase: invalidate(), getMyDisplay: invalidate() },
    ixnayid: { getPassport: invalidate() },
  };
  const mutation = () => ({ useMutation: () => ({ mutate: jest.fn(), isPending: false }) });
  return {
    api: {
      useUtils: () => utils,
      cards: {
        listMyShowcases: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
        addToShowcase: mutation(),
        createShowcase: mutation(),
      },
    },
  };
});
// The dialog's content stays drawn whatever `open` says, as it does while the real one animates out.
jest.mock("~/components/ui/dialog", () => {
  const Part = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Part,
    DialogContent: Part,
    DialogHeader: Part,
    DialogTitle: Part,
    DialogDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  };
});

import { AddToShowcaseDialog } from "~/components/cards/showcase/AddToShowcaseDialog";

describe("AddToShowcaseDialog closing", () => {
  it("keeps saying what it was adding while it leaves, when the caller has already let go of the cards", () => {
    const { rerender } = render(
      <AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o1", "o2"]} />
    );
    expect(screen.getByText("Pick a showcase for 2 cards.")).toBeInTheDocument();
    rerender(<AddToShowcaseDialog open={false} onOpenChange={jest.fn()} ownershipIds={[]} />);
    expect(screen.getByText("Pick a showcase for 2 cards.")).toBeInTheDocument();
    rerender(<AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o3"]} />);
    expect(screen.getByText("Pick a showcase for 1 card.")).toBeInTheDocument();
    rerender(<AddToShowcaseDialog open={false} onOpenChange={jest.fn()} ownershipIds={[]} />);
    expect(screen.getByText("Pick a showcase for 1 card.")).toBeInTheDocument();
  });
});
