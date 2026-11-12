import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@clerk/nextjs", () => ({
  useAuth: jest.fn(),
}));

jest.mock("~/hooks/useCardSheet", () => ({
  useCardSheetOpen: jest.fn(),
}));

jest.mock("~/hooks/useCardsRefresh", () => ({
  useCardsRefresh: () => jest.fn(),
}));

jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => true,
}));

jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value.toLocaleString("en-US")}</span>,
}));

jest.mock("~/components/cards/reveal/reveal-feedback", () => ({
  playRevealFeedback: jest.fn(),
}));

jest.mock("~/lib/sound/cuelume", () => ({
  soundCues: {
    reveal: jest.fn(),
    hover: jest.fn(),
    press: jest.fn(),
  },
}));

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    vault: {
      getBalance: { useQuery: jest.fn() },
      claimCombinedDailyClaim: { useMutation: jest.fn() },
    },
  },
}));

import { useAuth } from "@clerk/nextjs";
import { useCardSheetOpen } from "~/hooks/useCardSheet";
import { playRevealFeedback } from "~/components/cards/reveal/reveal-feedback";
import { DailyRewardProvider, useDailyReward } from "~/components/vault/DailyRewardProvider";
import { DailyRewardTile } from "~/components/vault/sections/dashboard/DailyRewardTile";
import {
  resetAutoOpenedInSession,
  type ClaimResult,
} from "~/components/vault/daily-reward/daily-reward-utils";
import type { CardFaceData } from "~/lib/cards/face/types";
import { api } from "~/trpc/react";

const SAMPLE_CARD_FACE: CardFaceData = {
  cardId: "card-aurora-1",
  title: "Crown of Castellan",
  rarity: "EPIC",
  cardType: "LORE",
  realm: {
    id: "realm-default",
    slug: "ixworld",
    name: "IxWorld",
    crestUrl: null,
    isSystem: true,
  },
  artwork: "https://ixwiki.com/images/castellan.png",
  uncollected: false,
  number: 42,
  season: 1,
  isRetired: false,
  copy: {
    ownershipId: "own-1",
    finish: "FOIL",
    serialNumber: 7,
    level: 1,
  },
};

function OpenTrigger() {
  const { open } = useDailyReward();
  return (
    <button type="button" onClick={open}>
      Open reward modal
    </button>
  );
}

describe("DailyRewardProvider & DailyRewardDialog", () => {
  let mutationHandlers: {
    onSuccess?: (data: ClaimResult) => void;
    onError?: (err: Error) => void;
  } = {};
  const mutateMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    resetAutoOpenedInSession();
    mutationHandlers = {};

    jest.mocked(useAuth).mockReturnValue({ userId: "user-1" } as never);
    jest.mocked(useCardSheetOpen).mockReturnValue(false);
    jest.mocked(api.useUtils).mockReturnValue({
      vault: {
        getBalance: { invalidate: jest.fn() },
        getTransactions: { invalidate: jest.fn() },
        getTodayEarnings: { invalidate: jest.fn() },
      },
    } as never);
    jest
      .mocked(api.vault.claimCombinedDailyClaim.useMutation)
      .mockImplementation(
        (opts?: { onSuccess?: (data: ClaimResult) => void; onError?: (err: Error) => void }) => {
          mutationHandlers = opts ?? {};
          return { mutate: mutateMock } as never;
        }
      );
  });

  it("auto-opens with live IxCredits and Card pull choices and zero streak counters", () => {
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: {
        credits: 2450,
        canClaimDailyBonus: true,
        loginStreak: 5,
        claimStreak: 5,
        vaultLevel: 3,
      },
      isLoading: false,
    } as never);

    render(
      <DailyRewardProvider>
        <div>App content</div>
      </DailyRewardProvider>
    );

    expect(screen.getByRole("heading", { name: "Daily reward" })).toBeVisible();
    expect(document.querySelector("[data-slot='daily-choice-credits']")).toBeInTheDocument();
    expect(document.querySelector("[data-slot='daily-choice-card']")).toBeInTheDocument();
    expect(screen.getByText("2,450")).toBeInTheDocument();
    expect(screen.getByText(/Resets at 00:00 UTC/)).toBeInTheDocument();

    // Multi-plane front-page monogram parallax layers sit behind the overlay
    const parallax = document.querySelector("[data-slot='monogram-parallax']")!;
    expect(parallax).toBeInTheDocument();
    for (const app of ["wiki", "mycountry", "maps", "realms"]) {
      expect(parallax.querySelector(`[data-app='${app}']`)).toBeInTheDocument();
    }

    // Choice cards have no eyebrows, and the 3 fanned cards carry distinct rarities/editions
    expect(screen.queryByText("Currency roll")).not.toBeInTheDocument();
    expect(screen.queryByText("Mystery mint")).not.toBeInTheDocument();
    const cardTile = document.querySelector("[data-slot='daily-choice-card']")!;
    const cardBacks = [...cardTile.querySelectorAll("[data-card-back]")].map((el) =>
      el.getAttribute("data-card-rarity")
    );
    expect(cardBacks).toEqual(["RARE", "EPIC", "LEGENDARY"]);

    // Streak counter and progress bar are completely absent from the modal
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("claims IxCredits and presents the payout and updated Vault balance without a streak stat", async () => {
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: {
        credits: 1200,
        canClaimDailyBonus: true,
        loginStreak: 4,
        claimStreak: 4,
        vaultLevel: 2,
      },
      isLoading: false,
    } as never);

    render(
      <DailyRewardProvider>
        <div>App content</div>
      </DailyRewardProvider>
    );

    fireEvent.click(document.querySelector("[data-slot='daily-choice-credits']")!);
    expect(mutateMock).toHaveBeenCalledWith({ choice: "CREDITS" });

    act(() => {
      mutationHandlers.onSuccess?.({
        creditsAwarded: 350,
        cardFace: null,
        streak: 5,
      });
    });

    await waitFor(() => {
      expect(document.querySelector("[data-slot='daily-credits-reveal']")).toBeInTheDocument();
    });
    expect(screen.getByText("350")).toBeInTheDocument();
    expect(screen.getByText("1,550")).toBeInTheDocument();
    expect(screen.getByText("Vault balance")).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collect" }));
  });

  it("claims a Card pull and reveals the minted card with rarity, finish, serial, and sheet link", async () => {
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: {
        credits: 800,
        canClaimDailyBonus: true,
        loginStreak: 2,
        claimStreak: 2,
        vaultLevel: 1,
      },
      isLoading: false,
    } as never);

    render(
      <DailyRewardProvider>
        <div>App content</div>
      </DailyRewardProvider>
    );

    fireEvent.click(document.querySelector("[data-slot='daily-choice-card']")!);
    expect(mutateMock).toHaveBeenCalledWith({ choice: "CARD" });

    act(() => {
      mutationHandlers.onSuccess?.({
        cardAwarded: { id: SAMPLE_CARD_FACE.cardId, title: SAMPLE_CARD_FACE.title },
        cardFace: SAMPLE_CARD_FACE,
        streak: 3,
      });
    });

    await waitFor(() => {
      expect(document.querySelector("[data-slot='daily-card-reveal']")).toBeInTheDocument();
    });
    expect(playRevealFeedback).toHaveBeenCalledWith("EPIC", true);
    expect(screen.getByRole("heading", { name: "Crown of Castellan" })).toBeInTheDocument();
    expect(screen.getByText("Foil")).toBeInTheDocument();
    expect(screen.getByText("#7")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inspect card" })).toHaveAttribute(
      "href",
      expect.stringContaining("card-aurora-1")
    );
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it("shows Claimed for today without a streak counter when opened after claiming", () => {
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: {
        credits: 1500,
        canClaimDailyBonus: false,
        loginStreak: 9,
        claimStreak: 9,
        vaultLevel: 2,
      },
      isLoading: false,
    } as never);

    render(
      <DailyRewardProvider autoOpen={false}>
        <OpenTrigger />
      </DailyRewardProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open reward modal" }));

    expect(document.querySelector("[data-slot='daily-already-claimed']")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Claimed for today" })).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it("renders DailyRewardTile in ready state without duplicating the streak pill", () => {
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: {
        credits: 500,
        canClaimDailyBonus: true,
        loginStreak: 6,
      },
      isLoading: false,
    } as never);

    render(
      <DailyRewardProvider autoOpen={false}>
        <DailyRewardTile />
      </DailyRewardProvider>
    );

    expect(screen.getByText("Daily reward ready")).toBeInTheDocument();
    expect(screen.getByText("IxCredits or a mystery card")).toBeInTheDocument();
    expect(screen.queryByText(/6d/)).not.toBeInTheDocument();
  });
});
