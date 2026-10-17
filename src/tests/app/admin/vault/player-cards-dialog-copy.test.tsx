/** A closing reason dialog keeps the copy of the target it acted on, never its fallback copy. */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RouterOutputs } from "~/trpc/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      admin: {
        overview: { findCards: { useQuery: jest.fn() } },
        tools: {
          grant: { useMutation: jest.fn() },
          revoke: { useMutation: jest.fn() },
          cancelAuction: { useMutation: jest.fn() },
          voidTrade: { useMutation: jest.fn() },
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
// The real dialog unmounts at once in jsdom. This one stays mounted, so the test sees what a dialog renders while
// its exit animation plays.
jest.mock("~/app/admin/cards/shared/ReasonDialog", () => ({
  ReasonDialog: (props: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: (reason: string) => void;
  }) => (
    <section
      aria-label="Reason dialog"
      data-open={String(props.open)}
      data-destructive={String(Boolean(props.destructive))}
    >
      <h2>{props.title}</h2>
      <p>{props.description}</p>
      <button onClick={() => props.onConfirm("A reason")}>{props.confirmLabel}</button>
    </section>
  ),
}));

import { api } from "~/trpc/react";
import { CopiesSection } from "~/app/admin/vault/player-cards/CopiesSection";
import { MarketSection } from "~/app/admin/vault/player-cards/MarketSection";

type Inventory = RouterOutputs["cards"]["admin"]["tools"]["playerCards"];

const copy: Inventory["copies"][number] = {
  id: "own_1",
  serialNumber: 3,
  finish: "STANDARD",
  isLocked: false,
  auctioned: false,
  acquiredAt: new Date(0),
  cards: { id: "card_1", title: "Elm", rarity: "RARE", cardType: "LORE", isBound: false },
};
const trade: Inventory["trades"][number] = {
  id: "tr_1",
  initiating: true,
  copiesOffered: 1,
  copiesAsked: 2,
  creditsOffered: 0,
  creditsAsked: 0,
  expiresAt: new Date(0),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { tools: { playerCards: { invalidate: jest.fn() } } } },
  } as never);
  jest.mocked(api.cards.admin.overview.findCards.useQuery).mockReturnValue({ data: [] } as never);
  // Each mutation succeeds at once, so the dialog closes as it would after the server answers
  const tools = api.cards.admin.tools;
  for (const hook of [tools.grant, tools.revoke, tools.cancelAuction, tools.voidTrade]) {
    jest.mocked(hook.useMutation).mockImplementation(((options: {
      onSuccess: (data: { serialNumber: number }) => void;
    }) => ({
      mutate: () => options.onSuccess({ serialNumber: 7 }),
      isPending: false,
    })) as never);
  }
});

const dialog = () => screen.getByRole("region", { name: "Reason dialog" });

it("keeps the revoke copy while the dialog closes after a revoke", () => {
  render(<CopiesSection userId="user_1" copies={[copy]} copyCount={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Revoke Elm #3" }));
  fireEvent.click(within(dialog()).getByRole("button", { name: "Revoke" }));

  expect(dialog()).toHaveAttribute("data-open", "false");
  expect(within(dialog()).getByRole("heading")).toHaveTextContent("Revoke Elm #3");
  expect(dialog()).toHaveTextContent(/leaves this player's collection/);
  expect(dialog()).toHaveAttribute("data-destructive", "true");
  expect(within(dialog()).queryByRole("button", { name: "Grant" })).not.toBeInTheDocument();
});

it("keeps the void copy while the dialog closes after a trade void", () => {
  render(<MarketSection userId="user_1" auctions={[]} trades={[trade]} />);
  fireEvent.click(screen.getByRole("button", { name: "Void trade offered by this player" }));
  fireEvent.click(within(dialog()).getByRole("button", { name: "Void trade" }));

  expect(dialog()).toHaveAttribute("data-open", "false");
  expect(within(dialog()).getByRole("heading")).toHaveTextContent("Void this trade");
  expect(dialog()).not.toHaveTextContent(/auction/);
});
