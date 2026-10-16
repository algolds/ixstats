/** Cards refresh final review I1: a fast double tap opens the pack once and shows the reveal, not an error. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { api } from "~/trpc/react";
import { PackOpeningSequence } from "~/components/cards/pack-opening/PackOpeningSequence";

type Props = { children?: React.ReactNode; className?: string; onClick?: () => void };

jest.mock("motion/react", () => ({
  motion: {
    div: ({ children, className }: Props) => <div className={className}>{children}</div>,
    button: ({ children, className, onClick }: Props) => (
      <button className={className} onClick={onClick}>
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: Props) => <>{children}</>,
}));
jest.mock("~/trpc/react", () => ({
  api: { cardPacks: { openPack: { useMutation: jest.fn() } } },
}));
jest.mock("~/lib/cards/pack-opening-service", () => ({
  getPackOpeningService: () => ({ triggerHaptic: jest.fn(), cleanup: jest.fn() }),
}));
jest.mock("~/components/cards/pack-opening/Stage1_PackReveal", () => ({
  Stage1_PackReveal: ({ onTap }: { onTap: () => void }) => (
    <button onClick={onTap}>Tap to open pack</button>
  ),
}));
jest.mock("~/components/cards/pack-opening/Stage2_PackExplosion", () => ({
  Stage2_PackExplosion: () => <div>Explosion stage</div>,
}));
jest.mock("~/components/cards/pack-opening/Stage3_CardReveal", () => ({
  Stage3_CardReveal: () => null,
}));
jest.mock("~/components/cards/pack-opening/Stage4_QuickActions", () => ({
  Stage4_QuickActions: () => null,
}));

interface OpenPackOptions {
  onSuccess: (data: { success: boolean; cards: Array<Record<string, string | number>> }) => void;
  onError: (err: { message: string; data?: { code: string } }) => void;
}

const mutate = jest.fn();
let options: OpenPackOptions | undefined;

beforeEach(() => {
  mutate.mockClear();
  jest.mocked(api.cardPacks.openPack.useMutation).mockImplementation(((opts: OpenPackOptions) => {
    options = opts;
    return { mutate, isPending: false };
  }) as never);
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const pulled = {
  success: true,
  cards: [
    {
      id: "c1",
      ownershipId: "o1",
      name: "Velarc",
      rarity: "RARE",
      cardType: "LORE",
      artwork: "/a.png",
      season: 1,
    },
  ],
};
const conflict = { message: "This pack has already been opened", data: { code: "CONFLICT" } };

const renderSequence = () =>
  render(
    <PackOpeningSequence
      userPackId="ckpackabcdefghijklmnop12"
      packType="BASIC"
      onComplete={jest.fn()}
      onCancel={jest.fn()}
    />
  );

describe("PackOpeningSequence", () => {
  it("opens the pack once on a double tap, and a CONFLICT after the cards keeps the reveal", () => {
    renderSequence();
    const tap = screen.getByRole("button", { name: "Tap to open pack" });

    act(() => {
      fireEvent.click(tap);
      fireEvent.click(tap);
    });
    expect(mutate).toHaveBeenCalledTimes(1);

    act(() => {
      options?.onSuccess(pulled);
      options?.onError(conflict);
    });
    expect(screen.queryByText("Error opening pack")).toBeNull();
    expect(screen.getByText("Explosion stage")).toBeInTheDocument();
  });

  it("still shows the error when the pack was opened elsewhere and no cards came", () => {
    renderSequence();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Tap to open pack" }));
    });
    act(() => options?.onError(conflict));
    expect(screen.getByText("Error opening pack")).toBeInTheDocument();
  });
});
