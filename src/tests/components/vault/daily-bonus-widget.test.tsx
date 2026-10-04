import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

let mockUserId = "user-1";
let balance = { canClaimDailyBonus: true, loginStreak: 4 };
const mutate = jest.fn();
const invalidateBalance = jest.fn();
let mutationOptions: {
  onSuccess: (data: unknown) => void;
  onError: (err: { message: string }) => void;
};

jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: mockUserId }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      vault: { getBalance: { invalidate: invalidateBalance } },
      cards: { getMyCards: { invalidate: jest.fn() } },
    }),
    vault: {
      getBalance: { useQuery: () => ({ data: balance, isLoading: false }) },
      claimCombinedDailyClaim: {
        useMutation: (opts: typeof mutationOptions) => {
          mutationOptions = opts;
          return { mutate };
        },
      },
    },
  },
}));
const reveal = jest.fn();
jest.mock("~/lib/sound/cuelume", () => ({ soundCues: { reveal: () => reveal() }, soundEffects: {} }));
jest.mock("~/lib/vault/vault-notifications", () => ({ vaultNotify: { error: jest.fn(), success: jest.fn() } }));
jest.mock("~/components/cards/display/CardHolographicCover", () => ({
  CardHolographicCover: () => <div data-testid="holo-cover" />,
}));

import { DailyBonusWidget } from "~/components/vault/DailyBonusWidget";

// Each test uses its own user so the once-per-day auto-open guard never carries over.
let n = 0;
beforeEach(() => {
  mockUserId = `user-${++n}`;
  balance = { canClaimDailyBonus: true, loginStreak: 4 };
  mutate.mockClear();
  reveal.mockClear();
  invalidateBalance.mockClear();
  window.localStorage.clear();
});

const dialog = () => screen.getByRole("dialog");

describe("DailyBonusWidget", () => {
  it("auto-opens a copper dialog with two choices and the streak", () => {
    render(<DailyBonusWidget />);
    expect(dialog()).toHaveAttribute("data-app", "vault");
    expect(within(dialog()).getByRole("heading", { name: "Daily reward" })).toBeInTheDocument();
    expect(within(dialog()).getByText("4-day streak")).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: /IxCredits/ })).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: /Card pull/ })).toBeInTheDocument();
    expect(within(dialog()).queryByText(/maybe later/i)).toBeNull();
  });

  it("claims once even if both tiles are clicked", () => {
    render(<DailyBonusWidget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: /Card pull/ }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ choice: "CREDITS" });
  });

  it("reveals credits, including a capped +0, and plays the reveal cue", async () => {
    render(<DailyBonusWidget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    act(() => mutationOptions.onSuccess({ creditsAwarded: 0, streak: 5 }));
    expect(await screen.findByRole("heading", { name: "Reward claimed" })).toBeInTheDocument();
    expect(screen.getByText("+0")).toBeInTheDocument();
    expect(screen.getByText("5-day streak")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collect" })).toBeInTheDocument();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("reveals a card without artwork and links to the collection", async () => {
    render(<DailyBonusWidget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /Card pull/ }));
    act(() =>
      mutationOptions.onSuccess({
        cardAwarded: { id: "c1", title: "Caphiria", rarity: "ULTRA_RARE", artwork: "" },
        streak: 5,
      })
    );
    expect(await screen.findByText("Caphiria")).toBeInTheDocument();
    expect(screen.getByTestId("holo-cover")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("ultra rare")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View collection" })).toHaveAttribute("href", "/vault/inventory");
  });

  it("closes and resyncs when the claim was already made elsewhere", async () => {
    render(<DailyBonusWidget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    act(() => mutationOptions.onError({ message: "Daily reward already claimed" }));
    expect(invalidateBalance).toHaveBeenCalled();
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the greyed claimed state when nothing is claimable", () => {
    balance = { canClaimDailyBonus: false, loginStreak: 4 };
    render(<DailyBonusWidget />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Daily claimed")).toBeInTheDocument();
    expect(screen.getByText("· 4d streak")).toBeInTheDocument();
  });

  it("shows the claimed state at once after Collect, without the claimable trigger", async () => {
    const { rerender } = render(<DailyBonusWidget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    act(() => mutationOptions.onSuccess({ creditsAwarded: 10, streak: 5 }));
    await screen.findByRole("heading", { name: "Reward claimed" });
    balance = { canClaimDailyBonus: false, loginStreak: 5 };
    rerender(<DailyBonusWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Collect" }));
    expect(screen.getByText("Daily claimed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Daily reward/ })).toBeNull();
  });

  it("keeps the trigger copper on hover and press", () => {
    render(<DailyBonusWidget />);
    // The open dialog hides the trigger from the accessibility tree.
    const trigger = screen.getByRole("button", { name: /Daily reward/, hidden: true });
    expect(trigger.className).not.toContain("hover:bg-fill-4");
    expect(trigger.className).not.toContain("active:bg-fill-3");
    expect(trigger.className).toContain("hover:bg-tint-fill");
  });

  it("keeps the solid well on tile hover", () => {
    render(<DailyBonusWidget />);
    const tile = within(dialog()).getByRole("button", { name: /IxCredits/ });
    expect(tile.className).toContain("facet-well");
    expect(tile.className).not.toContain("hover:bg-tint-fill");
  });

  it("cannot be dismissed while a claim is in flight", () => {
    render(<DailyBonusWidget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    expect(within(dialog()).queryByRole("button", { name: /close/i })).toBeNull();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(dialog()).toBeInTheDocument();
  });

  it("marks only the chosen tile busy and disables both while claiming", () => {
    render(<DailyBonusWidget />);
    const credits = within(dialog()).getByRole("button", { name: /IxCredits/ });
    const card = within(dialog()).getByRole("button", { name: /Card pull/ });
    fireEvent.click(credits);
    expect(credits).toHaveAttribute("aria-busy", "true");
    expect(card).toHaveAttribute("aria-busy", "false");
    expect(credits).toBeDisabled();
    expect(card).toBeDisabled();
  });

  it("auto-opens only once per user per day", async () => {
    const first = render(<DailyBonusWidget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /close/i }));
    await act(async () => {});
    first.unmount();
    render(<DailyBonusWidget />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
