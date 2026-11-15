import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MagicWand, StatUp as TrendingUp } from "iconoir-react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => true,
}));

jest.mock("~/components/cards/reveal/PackReveal", () => ({
  PackReveal: ({ pack }: { pack: { name: string } }) => (
    <div data-slot="pack-reveal-mock">{pack.name}</div>
  ),
}));

jest.mock("~/lib/sound/cuelume", () => ({
  soundCues: {
    success: jest.fn(),
    present: jest.fn(),
    dismiss: jest.fn(),
  },
}));

const notifySuccess = jest.fn();
const notifyError = jest.fn();

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({
    success: notifySuccess,
    error: notifyError,
    warning: jest.fn(),
    info: jest.fn(),
    notify: jest.fn(),
  }),
}));

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    vault: {
      getBalance: { useQuery: jest.fn() },
      listStoreItems: { useQuery: jest.fn() },
      getPurchasedItems: { useQuery: jest.fn() },
      purchaseStoreItem: { useMutation: jest.fn() },
    },
    cardPacks: {
      getMyPacks: { useQuery: jest.fn() },
      getAvailablePacks: { useQuery: jest.fn() },
      purchasePack: { useMutation: jest.fn() },
    },
  },
}));

import { api } from "~/trpc/react";
import { soundCues } from "~/lib/sound/cuelume";
import {
  StoreItemCard,
  type StoreItem,
} from "~/components/vault/sections/marketplace/StoreItemCard";
import {
  PackHolographicCard,
  type PackItem,
} from "~/components/vault/sections/marketplace/store/PackHolographicCard";
import { StorePurchaseDialog } from "~/components/vault/sections/marketplace/store/StorePurchaseDialog";
import { VaultStoreTab } from "~/components/vault/sections/marketplace/VaultStoreTab";

const SAMPLE_ITEM: StoreItem = {
  id: "cosmetic-aurora",
  name: "Aurora Frame",
  description: "Iridescent border for your collector profile.",
  price: 1500,
  icon: MagicWand,
  quality: "EPIC",
  badgeText: "Frame",
  category: "cosmetics",
};

const SAMPLE_UPGRADE: StoreItem = {
  id: "upgrade_card_capacity",
  name: "Binder Expansion",
  description: "Adds 50 permanent card slots to your Vault.",
  price: 2000,
  icon: TrendingUp,
  quality: "STANDARD",
  badgeText: "Capacity",
  category: "upgrades",
};

const SAMPLE_PACK: PackItem = {
  id: "pack-sovereign",
  name: "Sovereign Booster",
  description: "Five cards across every active realm.",
  artwork: null,
  packType: "PREMIUM",
  priceCredits: 500,
  cardCount: 5,
  guaranteedRarity: "RARE",
  commonOdds: 50,
  uncommonOdds: 25,
  rareOdds: 15,
  ultraRareOdds: 5,
  epicOdds: 4,
  legendaryOdds: 1,
  season: 1,
  cardType: null,
};

describe("IxVault Store (Facet 5 + Apple Storefront)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    class MockIntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    window.IntersectionObserver = MockIntersectionObserver;
  });

  it("rebuilds PackHolographicCard and StoreItemCard on CutoutCard with recessed stages and Owned badge", () => {
    const onPurchaseItem = jest.fn();
    const onPurchasePack = jest.fn();
    const { rerender } = render(
      <div>
        <StoreItemCard
          item={SAMPLE_ITEM}
          onPurchase={onPurchaseItem}
          isPurchasing={false}
          isOwned={false}
        />
        <PackHolographicCard pack={SAMPLE_PACK} onPurchase={onPurchasePack} />
      </div>
    );

    const itemCard = document.querySelector("[data-slot='store-item-card']") as HTMLElement;
    const packCard = document.querySelector("[data-slot='pack-store-card']") as HTMLElement;
    expect(itemCard).toHaveClass("facet-pane", "rounded-cutout", "w-full");
    expect(packCard).toHaveClass("facet-pane", "rounded-cutout", "w-full");

    // Recessed preview wells instead of centered SaaS icon boxes
    expect(itemCard.querySelector("[data-slot='cosmetic-preview-well']")).toHaveClass(
      "facet-recess"
    );
    expect(packCard.querySelector("[data-slot='pack-stage']")).toHaveClass(
      "pack-stage",
      "facet-recess"
    );

    // CutoutCardHeader h3 titles + secondary badges
    expect(
      within(packCard).getByRole("heading", { level: 3, name: "Sovereign Booster" })
    ).toBeInTheDocument();
    expect(within(packCard).getByText("5 cards")).toBeInTheDocument();
    expect(within(packCard).getByRole("button", { name: "Drop odds" })).toBeInTheDocument();
    expect(within(packCard).getByText("500 IxC")).toBeInTheDocument();

    expect(
      within(itemCard).getByRole("heading", { level: 3, name: "Aurora Frame" })
    ).toBeInTheDocument();
    expect(within(itemCard).getByRole("button", { name: "Preview" })).toBeInTheDocument();
    expect(within(itemCard).getByText("1,500 IxC")).toBeInTheDocument();

    // Pointer hover/move never applies 3D tilt, scale, or translate transforms to grid cards
    fireEvent.mouseEnter(itemCard);
    fireEvent.mouseMove(itemCard, { clientX: 80, clientY: 40 });
    expect(itemCard.style.transform).toBe("");
    fireEvent.mouseEnter(packCard);
    fireEvent.mouseMove(packCard, { clientX: 80, clientY: 40 });
    expect(packCard.style.transform).toBe("");

    // Owned items display an "Owned" Badge (never "Unlocked") and omit the Buy button
    rerender(
      <StoreItemCard
        item={SAMPLE_ITEM}
        onPurchase={onPurchaseItem}
        isPurchasing={false}
        isOwned={true}
      />
    );
    expect(screen.queryByText(/unlocked/i)).not.toBeInTheDocument();
    const ownedBadge = screen.getByText("Owned");
    expect(ownedBadge).toHaveAttribute("data-slot", "badge");
    expect(screen.queryByRole("button", { name: "Buy" })).not.toBeInTheDocument();
  });

  it("renders StorePurchaseDialog on native facet-overlay with a single formatted Buy button and balance breakdown", () => {
    const onConfirm = jest.fn();
    render(
      <StorePurchaseDialog
        item={SAMPLE_ITEM}
        currentBalance={4000}
        onClose={jest.fn()}
        onConfirm={onConfirm}
        isPurchasing={false}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("facet-overlay");
    expect(dialog).not.toHaveClass("bg-surface");

    const buyButtons = screen.getAllByRole("button", { name: /buy/i });
    expect(buyButtons).toHaveLength(1);
    expect(buyButtons[0]).toHaveTextContent("Buy for 1,500 IxC");

    expect(screen.getByText("Current balance")).toBeInTheDocument();
    expect(screen.getByText("4,000")).toBeInTheDocument();
    expect(screen.getByText("Balance after purchase")).toBeInTheDocument();
    expect(screen.getByText("2,500")).toBeInTheDocument();

    fireEvent.click(buyButtons[0]!);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders a single-scroll Storefront with zero category tabs and confirms packs, cosmetics, and capacity upgrades via StorePurchaseDialog", async () => {
    let onStoreItemSuccess: (() => void) | undefined;
    let onPackSuccess: ((data: { userPack: { id: string; pack: PackItem } }) => void) | undefined;
    const mutateStoreItem = jest.fn();
    const mutatePack = jest.fn();

    jest.mocked(api.useUtils).mockReturnValue({
      vault: {
        getBalance: { invalidate: jest.fn() },
        getPurchasedItems: { invalidate: jest.fn() },
      },
      cardPacks: {
        getMyPacks: { invalidate: jest.fn() },
      },
    } as never);
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: { credits: 5000 },
      isLoading: false,
      isError: false,
    } as never);
    jest.mocked(api.cardPacks.getMyPacks.useQuery).mockReturnValue({
      data: { packs: [{ id: "waiting-1", pack: SAMPLE_PACK }] },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
    jest.mocked(api.cardPacks.getAvailablePacks.useQuery).mockReturnValue({
      data: { packs: [SAMPLE_PACK] },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
    jest.mocked(api.vault.listStoreItems.useQuery).mockReturnValue({
      data: [
        {
          id: SAMPLE_ITEM.id,
          name: SAMPLE_ITEM.name,
          description: SAMPLE_ITEM.description,
          price: SAMPLE_ITEM.price,
          icon: "Sparkles",
          quality: SAMPLE_ITEM.quality,
          badgeText: SAMPLE_ITEM.badgeText,
          category: "cosmetics",
          effects: {},
        },
        {
          id: SAMPLE_UPGRADE.id,
          name: SAMPLE_UPGRADE.name,
          description: SAMPLE_UPGRADE.description,
          price: SAMPLE_UPGRADE.price,
          icon: "TrendingUp",
          quality: SAMPLE_UPGRADE.quality,
          badgeText: SAMPLE_UPGRADE.badgeText,
          category: "upgrades",
          effects: {},
        },
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
    jest.mocked(api.vault.getPurchasedItems.useQuery).mockReturnValue({
      data: { purchasedItemIds: [], purchaseCounts: { [SAMPLE_UPGRADE.id]: 2 } },
    } as never);
    jest
      .mocked(api.cardPacks.purchasePack.useMutation)
      .mockImplementation(
        (opts?: { onSuccess?: (data: { userPack: { id: string; pack: PackItem } }) => void }) => {
          onPackSuccess = opts?.onSuccess;
          return { mutate: mutatePack, isPending: false } as never;
        }
      );
    jest
      .mocked(api.vault.purchaseStoreItem.useMutation)
      .mockImplementation((opts?: { onSuccess?: () => void }) => {
        onStoreItemSuccess = opts?.onSuccess;
        return { mutate: mutateStoreItem, isPending: false } as never;
      });

    render(<VaultStoreTab />);

    // Single-scroll header with balance chip, no back button, and no category tablist
    expect(screen.getByRole("heading", { level: 1, name: "Store" })).toBeVisible();
    expect(screen.getByText("Card packs, profile cosmetics, and Vault capacity.")).toBeVisible();
    expect(document.querySelector("[data-slot='store-balance-chip']")).toHaveTextContent(
      "5,000 IxC"
    );
    expect(screen.queryByRole("link", { name: /vault/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();

    // Unopened packs shelf at top when waiting packs exist
    const shelf = document.querySelector("[data-slot='unopened-packs-shelf']") as HTMLElement;
    expect(shelf).toBeInTheDocument();
    expect(within(shelf).getByRole("button", { name: "Rip open pack" })).toBeVisible();

    // All three merchandising sections visible together on one page
    expect(screen.getByRole("heading", { level: 2, name: "Card packs" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Profile cosmetics" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Vault capacity" })).toBeVisible();

    const capacityList = document.querySelector("[data-slot='facet-list']") as HTMLElement;
    expect(within(capacityList).getByText("Binder Expansion")).toBeVisible();
    expect(within(capacityList).getByText("2 owned")).toBeVisible();
    expect(within(capacityList).getByText("2,000 IxC")).toBeVisible();

    // 1. Confirm a cosmetic purchase via StorePurchaseDialog
    const itemCard = document.querySelector("[data-slot='store-item-card']") as HTMLElement;
    fireEvent.click(within(itemCard).getByRole("button", { name: "Buy" }));
    fireEvent.click(screen.getByRole("button", { name: /Buy for 1,500 IxC/i }));
    expect(mutateStoreItem).toHaveBeenCalledWith({ itemId: "cosmetic-aurora" });

    act(() => {
      onStoreItemSuccess?.();
    });
    expect(soundCues.success).toHaveBeenCalledTimes(1);
    expect(notifySuccess).toHaveBeenCalledWith(
      "Added to your Vault",
      expect.stringContaining("Aurora Frame")
    );

    // 2. Confirm a capacity upgrade via the same StorePurchaseDialog
    fireEvent.click(within(capacityList).getByRole("button", { name: "Buy" }));
    fireEvent.click(screen.getByRole("button", { name: /Buy for 2,000 IxC/i }));
    expect(mutateStoreItem).toHaveBeenCalledWith({ itemId: "upgrade_card_capacity" });

    act(() => {
      onStoreItemSuccess?.();
    });

    // 3. Confirm a card pack via the same StorePurchaseDialog
    const packCard = document.querySelector("[data-slot='pack-store-card']") as HTMLElement;
    fireEvent.click(within(packCard).getByRole("button", { name: "Buy" }));
    fireEvent.click(screen.getByRole("button", { name: /Buy for 500 IxC/i }));
    expect(mutatePack).toHaveBeenCalledWith({ packId: "pack-sovereign" });

    await act(async () => {
      onPackSuccess?.({ userPack: { id: "new-pack-1", pack: SAMPLE_PACK } });
    });
    expect(notifySuccess).toHaveBeenCalledWith("Card pack purchased");
    expect(document.querySelector("[data-slot='pack-reveal-mock']")).toHaveTextContent(
      "Sovereign Booster"
    );
    expect(screen.queryByText(/unlocked/i)).not.toBeInTheDocument();
  });

  it("hides the unopened packs shelf when no packs are waiting and disables unaffordable capacity upgrades", () => {
    jest.mocked(api.useUtils).mockReturnValue({
      vault: {
        getBalance: { invalidate: jest.fn() },
        getPurchasedItems: { invalidate: jest.fn() },
      },
      cardPacks: {
        getMyPacks: { invalidate: jest.fn() },
      },
    } as never);
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: { credits: 400 },
      isLoading: false,
      isError: false,
    } as never);
    jest.mocked(api.cardPacks.getMyPacks.useQuery).mockReturnValue({
      data: { packs: [] },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
    jest.mocked(api.cardPacks.getAvailablePacks.useQuery).mockReturnValue({
      data: { packs: [SAMPLE_PACK] },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
    jest.mocked(api.vault.listStoreItems.useQuery).mockReturnValue({
      data: [
        {
          id: SAMPLE_UPGRADE.id,
          name: SAMPLE_UPGRADE.name,
          description: SAMPLE_UPGRADE.description,
          price: SAMPLE_UPGRADE.price,
          icon: "TrendingUp",
          quality: SAMPLE_UPGRADE.quality,
          badgeText: SAMPLE_UPGRADE.badgeText,
          category: "upgrades",
          effects: {},
        },
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
    jest.mocked(api.vault.getPurchasedItems.useQuery).mockReturnValue({
      data: { purchasedItemIds: [], purchaseCounts: {} },
    } as never);
    jest.mocked(api.cardPacks.purchasePack.useMutation).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as never);
    jest.mocked(api.vault.purchaseStoreItem.useMutation).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as never);

    render(<VaultStoreTab />);

    expect(document.querySelector("[data-slot='unopened-packs-shelf']")).not.toBeInTheDocument();

    const capacityList = document.querySelector("[data-slot='facet-list']") as HTMLElement;
    expect(within(capacityList).getByRole("button", { name: "Buy" })).toBeDisabled();
  });
});
