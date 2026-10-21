import "react";
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
// The address the shell reads: `?card=` is an open card sheet (useCardSheet).
jest.mock("next/navigation", () => ({
  ...jest.requireActual<typeof import("next/navigation")>("next/navigation"),
  useSearchParams: jest.fn(),
}));
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

import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { DailyRewardProvider, DailyRewardStatus } from "~/components/vault/DailyRewardProvider";

const refreshCards = jest.mocked(useCardsRefresh());
const searchParams = jest.mocked(useSearchParams);
const atAddress = (query: string) =>
  searchParams.mockReturnValue(new ReadonlyURLSearchParams(query));

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
  atAddress("");
});

const dialog = () => screen.getByRole("dialog");
describe("DailyRewardProvider", () => {
  it("claims once even if both tiles are clicked", () => {
    render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: /Card pull/ }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ choice: "CREDITS" });
  });
  it("refreshes the statement and today's earnings after a claim", () => {
    render(<Widget />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /IxCredits/ }));
    act(() => mutationOptions.onSuccess({ creditsAwarded: 40, streak: 5 }));
    expect(invalidateBalance).toHaveBeenCalledTimes(1);
    expect(invalidateTransactions).toHaveBeenCalledTimes(1);
    expect(invalidateEarnings).toHaveBeenCalledTimes(1);
  });
  // A visitor who followed a card's link (or signed in to reach it) came for that card: the reward waits for the
  // sheet to close rather than opening over it.
  // The sidebar's column is 224px: with a two-digit streak the label gives way rather than the card widening.
});
