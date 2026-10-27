/** Action cards and the action picker date a nation's action on its realm's clock, in its calendar. */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { REAL_NOW, sixTimesReader } from "~/tests/fixtures/realm-readers";

const frost = sixTimesReader();
jest.mock("~/hooks/useRealmClock", () => ({
  useCountryClock: (country: { realmId?: string } | null) =>
    country?.realmId === "realm-frost" ? frost : null,
  useRealmClock: (realmId: string | undefined) => (realmId === "realm-frost" ? frost : null),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    users: { getProfile: { useQuery: () => ({ data: { country: { realmId: "realm-frost" } } }) } },
    actionLinks: {
      myActivities: {
        useQuery: () => ({
          data: [
            {
              id: "a1",
              title: "Opened the harbour",
              type: "economic",
              createdAt: new Date(REAL_NOW),
            },
          ],
        }),
      },
    },
  },
}));

import { ActionCardView } from "~/components/action-links/ActionCard";
import { ActionPicker } from "~/components/action-links/ActionPicker";

const card = (country: { realmId: string } | null) =>
  ({
    id: "a1",
    title: "Opened the harbour",
    type: "economic",
    createdAt: new Date(REAL_NOW),
    country: country && { id: "c1", name: "Frostmark", slug: "frostmark", flag: null, ...country },
  }) as Parameters<typeof ActionCardView>[0]["card"];

describe("action dates", () => {
  it("dates a card on its nation's realm calendar", () => {
    render(<ActionCardView card={card({ realmId: "realm-frost" })} />);
    expect(screen.getByText(/14 Thaw 812 AE/)).toBeInTheDocument();
  });

  it("shows a placeholder for an action with no nation", () => {
    render(<ActionCardView card={card(null)} />);
    expect(screen.getByText(/economic · –/)).toBeInTheDocument();
  });

  it("dates the viewer's own actions in the picker on their nation's clock", () => {
    render(<ActionPicker onPick={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Attach action/ }));
    expect(screen.getByText(/14 Thaw 812 AE/)).toBeInTheDocument();
  });
});
