import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

let mockUserId: string | null = "user-1";
let balance: {
  canClaimDailyBonus: boolean;
  loginStreak: number;
  claimStreak?: number;
  vaultLevel?: number;
} = { canClaimDailyBonus: true, loginStreak: 4 };
const mutate = jest.fn();
const invalidateBalance = jest.fn();
const invalidateTransactions = jest.fn();
const invalidateEarnings = jest.fn();
let mutationOptions: {
  onSuccess: (data: unknown) => void;
  onError: (err: { message: string }) => void;
};

jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: mockUserId }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      vault: {
        getBalance: { invalidate: invalidateBalance },
        getTransactions: { invalidate: invalidateTransactions },
        getTodayEarnings: { invalidate: invalidateEarnings },
      },
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
jest.mock("~/lib/sound/cuelume", () => ({
  soundCues: { reveal: () => reveal() },
  soundEffects: {},
}));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { error: jest.fn(), success: jest.fn() },
}));
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});

import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import {
  DailyRewardProvider,
  DailyRewardStatus,
  useDailyReward,
} from "~/components/vault/DailyRewardProvider";

const refreshCards = jest.mocked(useCardsRefresh());

const Widget = () => (
  <DailyRewardProvider>
    <DailyRewardStatus />
  </DailyRewardProvider>
);

// Each test uses its own user so the once-per-day auto-open guard never carries over.
let n = 0;
beforeEach(() => {
  mockUserId = `user-${++n}`;
  balance = { canClaimDailyBonus: true, loginStreak: 4 };
  mutate.mockClear();
  reveal.mockClear();
  invalidateBalance.mockClear();
  invalidateTransactions.mockClear();
  invalidateEarnings.mockClear();
  refreshCards.mockClear();
  window.localStorage.clear();
});

const dialog = () => screen.getByRole("dialog");

const CAPHIRIA_FACE = {
  cardId: "c1",
  title: "Caphiria",
  rarity: "ULTRA_RARE",
  cardType: "LORE",
  realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  artwork: null,
  silhouette: false,
  number: 1,
  season: null,
  isRetired: false,
  copy: { ownershipId: "o1", finish: "STANDARD", serialNumber: 1, level: 1 },
};

describe("DailyRewardProvider", () => {
  it("auto-opens the vault dialog with two choices and the streak", () => {
    render(<Widget />);
    expect(dialog()).toHaveAttribute("data-app", "vault");
    expect(within(dialog()).getByRole("heading", { name: "Daily reward" })).toBeInTheDocument();
    expect(within(dialog()).getByText(/Day 4 today/)).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: /IxCredits/ })).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: /Card pull/ })).toBeInTheDocument();
    expect(within(dialog()).queryByText(/maybe later/i)).toBeNull();
  });

  it("claims once even if both tiles are clicked", () => {
    render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: /Card pull/ }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ choice: "CREDITS" });
  });

  it("reveals credits, including a capped +0, and plays the reveal cue", async () => {
    render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    act(() => mutationOptions.onSuccess({ creditsAwarded: 0, streak: 5 }));
    expect(await screen.findByRole("heading", { name: "Reward claimed" })).toBeInTheDocument();
    expect(screen.getByText("+0")).toBeInTheDocument();
    expect(screen.getByText("5 days")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collect" })).toBeInTheDocument();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("shows the card pull face down before the claim, small enough for its socket", () => {
    render(<Widget />);
    const tile = within(dialog()).getByRole("button", { name: /Card pull/ });
    const faceDown = tile.querySelector(".card-face-down");
    expect(faceDown).not.toBeNull();
    // The socket is 128px tall, so the 5:7 card is 80px wide rather than size S's 128px.
    expect(faceDown).toHaveClass("w-20");
    expect(faceDown).not.toHaveClass("w-32");
  });

  it("reveals the pulled copy's real face and links to it in Mine", async () => {
    render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /Card pull/ }));
    act(() =>
      mutationOptions.onSuccess({
        cardAwarded: {
          id: "c1",
          ownershipId: "o1",
          title: "Caphiria",
          rarity: "ULTRA_RARE",
          artwork: "",
        },
        cardFace: CAPHIRIA_FACE,
        streak: 5,
      })
    );
    expect(
      await screen.findByRole("img", { name: "Caphiria, Ultra Rare, Standard, Ixnay" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View card" })).toHaveAttribute(
      "href",
      "/vault/cards/mine?card=c1"
    );
    expect(refreshCards).toHaveBeenCalledTimes(1);
  });

  it("names the pulled card and still links to it when its face could not be read", async () => {
    render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /Card pull/ }));
    act(() =>
      mutationOptions.onSuccess({
        cardAwarded: {
          id: "c1",
          ownershipId: "o1",
          title: "Caphiria",
          rarity: "ULTRA_RARE",
          artwork: "",
        },
        cardFace: null,
        streak: 5,
      })
    );
    // On screen, not only in the screen-reader description (motion keeps jsdom at opacity 0, so no toBeVisible)
    const title = await screen.findByText("Caphiria");
    expect(title.closest(".sr-only")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("link", { name: "View card" })).toHaveAttribute(
      "href",
      "/vault/cards/mine?card=c1"
    );
  });

  it("refreshes the statement and today's earnings after a claim", () => {
    render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    act(() => mutationOptions.onSuccess({ creditsAwarded: 40, streak: 5 }));
    expect(invalidateBalance).toHaveBeenCalledTimes(1);
    expect(invalidateTransactions).toHaveBeenCalledTimes(1);
    expect(invalidateEarnings).toHaveBeenCalledTimes(1);
  });

  it("closes and resyncs when the claim was already made elsewhere", async () => {
    render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    act(() => mutationOptions.onError({ message: "Daily reward already claimed" }));
    expect(invalidateBalance).toHaveBeenCalled();
    expect(invalidateTransactions).toHaveBeenCalled();
    expect(invalidateEarnings).toHaveBeenCalled();
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the greyed claimed state when nothing is claimable", () => {
    balance = { canClaimDailyBonus: false, loginStreak: 4 };
    render(<Widget />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Daily claimed")).toBeInTheDocument();
    const pill = document.querySelector("[data-slot='streak-pill']");
    // Seen as "4d"; read as "4 day streak".
    expect(pill?.textContent).toBe("4d4 day streak");
    expect(pill).not.toHaveAttribute("data-peak");
    expect(pill).toHaveAttribute("title", "The boost peaks on day 30");
  });

  it("shows a full streak pill once the boost peaks", () => {
    balance = { canClaimDailyBonus: false, loginStreak: 42 };
    render(<Widget />);
    const pill = document.querySelector("[data-slot='streak-pill']");
    expect(pill).toHaveAttribute("data-peak", "true");
    expect(pill).toHaveAttribute("title", "Streak boost at its peak");
  });

  it("shows the claimed state at once after Collect, without the claimable trigger", async () => {
    const { rerender } = render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    act(() => mutationOptions.onSuccess({ creditsAwarded: 10, streak: 5 }));
    await screen.findByRole("heading", { name: "Reward claimed" });
    balance = { canClaimDailyBonus: false, loginStreak: 5 };
    rerender(<Widget />);
    fireEvent.click(screen.getByRole("button", { name: "Collect" }));
    expect(screen.getByText("Daily claimed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Daily reward/ })).toBeNull();
  });

  it("keeps the trigger copper on hover and press", () => {
    render(<Widget />);
    // The open dialog hides the trigger from the accessibility tree.
    const trigger = screen.getByRole("button", { name: /Daily reward/, hidden: true });
    expect(trigger.className).not.toContain("hover:bg-fill-4");
    expect(trigger.className).not.toContain("active:bg-fill-3");
    expect(trigger.className).toContain("hover:bg-tint-fill");
  });

  it("raises the choice tiles as panes that lift, and drops the lift while claiming", () => {
    render(<Widget />);
    const tile = within(dialog()).getByRole("button", { name: /IxCredits/ });
    expect(tile.className).toContain("facet-pane");
    expect(tile.className).toContain("facet-lift");
    expect(tile.className).not.toContain("hover:bg-tint-fill");
    fireEvent.click(tile);
    expect(tile.className).not.toContain("facet-lift");
  });

  it("shows the boost today's claim will roll with", () => {
    // Day 5 of the streak (×1.25) at vault level 10 (×1.20): ×1.50 on the credits tile.
    balance = { canClaimDailyBonus: true, loginStreak: 4, claimStreak: 5, vaultLevel: 10 };
    render(<Widget />);
    const tile = within(dialog()).getByRole("button", { name: /IxCredits/ });
    expect(within(tile).getByText("×1.50")).toBeInTheDocument();
    expect(within(dialog()).getByText(/Day 5 today/)).toBeInTheDocument();
    expect(within(dialog()).getByText("×1.25")).toBeInTheDocument();
  });

  it("cannot be dismissed while a claim is in flight", () => {
    render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    expect(within(dialog()).queryByRole("button", { name: /close/i })).toBeNull();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(dialog()).toBeInTheDocument();
  });

  it("marks only the chosen tile busy and disables both while claiming", () => {
    render(<Widget />);
    const credits = within(dialog()).getByRole("button", { name: /IxCredits/ });
    const card = within(dialog()).getByRole("button", { name: /Card pull/ });
    fireEvent.click(credits);
    expect(credits).toHaveAttribute("aria-busy", "true");
    expect(card).toHaveAttribute("aria-busy", "false");
    expect(credits).toBeDisabled();
    expect(card).toBeDisabled();
  });

  it("auto-opens only once per user per day", async () => {
    const first = render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /close/i }));
    await act(async () => {});
    first.unmount();
    render(<Widget />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from anywhere via useDailyReward", async () => {
    const Opener = () => {
      const { open } = useDailyReward();
      return <button onClick={open}>Open reward</button>;
    };
    render(
      <DailyRewardProvider>
        <Opener />
      </DailyRewardProvider>
    );
    fireEvent.click(within(dialog()).getByRole("button", { name: /close/i }));
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open reward" }));
    expect(within(dialog()).getByRole("heading", { name: "Daily reward" })).toBeInTheDocument();
  });

  it("says today's reward is claimed when it opens after the claim, and offers no second one", async () => {
    balance = { canClaimDailyBonus: false, loginStreak: 4, claimStreak: 4 };
    const Opener = () => {
      const { open } = useDailyReward();
      return <button onClick={open}>Open reward</button>;
    };
    render(
      <DailyRewardProvider>
        <Opener />
      </DailyRewardProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Open reward" }));
    expect(within(dialog()).getByRole("heading", { name: "Daily reward" })).toBeInTheDocument();
    expect(within(dialog()).getByText("You claimed today's reward.")).toBeInTheDocument();
    expect(within(dialog()).queryByRole("button", { name: /IxCredits/ })).toBeNull();
    expect(within(dialog()).queryByRole("button", { name: /Card pull/ })).toBeNull();
    expect(within(dialog()).getByText("4 days")).toBeInTheDocument();
    expect(within(dialog()).getByText("Next reward")).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("skips the auto-open when autoOpen is off, but useDailyReward().open() still opens it", () => {
    const Opener = () => {
      const { open } = useDailyReward();
      return <button onClick={open}>Open reward</button>;
    };
    render(
      <DailyRewardProvider autoOpen={false}>
        <Opener />
      </DailyRewardProvider>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open reward" }));
    expect(within(dialog()).getByRole("heading", { name: "Daily reward" })).toBeInTheDocument();
  });

  it("does not spend today's auto-open while autoOpen is off", async () => {
    const off = render(
      <DailyRewardProvider autoOpen={false}>
        <p>Map</p>
      </DailyRewardProvider>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    off.unmount();
    render(<Widget />);
    expect(dialog()).toBeInTheDocument();
  });

  it("renders its children and no dialog for a signed-out visitor", () => {
    mockUserId = null;
    render(
      <DailyRewardProvider>
        <p>Page</p>
      </DailyRewardProvider>
    );
    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
