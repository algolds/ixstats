/** Cards refresh §5.4: the pack reveal's last stage has no junk action, per card or in bulk. */
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { Stage4_QuickActions } from "~/components/cards/pack-opening/Stage4_QuickActions";

jest.mock("motion/react", () => ({
  motion: {
    div: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/components/cards/display/CardHolographicCover", () => ({
  CardHolographicCover: () => null,
}));
jest.mock("~/lib/cards/pack-opening-service", () => ({
  getPackOpeningService: () => ({ triggerHaptic: jest.fn(), getRarityColor: () => "#ffffff" }),
}));

const cards = [
  {
    id: "o1",
    title: "Velarc",
    rarity: "RARE" as const,
    cardType: "LORE",
    artwork: "/a.png",
    season: 1,
  },
  {
    id: "o2",
    title: "Kiro",
    rarity: "COMMON" as const,
    cardType: "NS",
    artwork: "/b.png",
    season: 3,
  },
];

describe("pack opening, stage 4", () => {
  it("offers keep and list on each card, and no junk", () => {
    render(<Stage4_QuickActions cards={cards} onComplete={jest.fn()} />);
    expect(screen.getAllByRole("button", { name: "Keep" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /junk/i })).toBeNull();
  });

  it("offers no bulk junk either", () => {
    render(<Stage4_QuickActions cards={cards} onComplete={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Bulk Select" }));
    fireEvent.click(screen.getByText("Velarc"));
    expect(screen.getByRole("button", { name: "Keep (1)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /junk/i })).toBeNull();
  });
});
