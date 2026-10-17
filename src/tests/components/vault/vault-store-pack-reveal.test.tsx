/** The Store opens a pack in the one reveal: from My packs, straight after a purchase, and pack after pack. */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

interface RevealStubProps {
  userPackId: string;
  pack: { name: string };
  nextPack?: { id: string; name: string } | null;
  onOpenNext?: () => void;
  onOpenCard: (cardId: string) => void;
  onClose: () => void;
}

// The reveal itself is tested on its own; here a stub shows what the Store hands it.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function RevealStub({
      userPackId,
      pack,
      nextPack,
      onOpenNext,
      onOpenCard,
      onClose,
    }: RevealStubProps) {
      return (
        <div role="dialog" aria-label={`Revealing ${pack.name}`}>
          <p>Pack {userPackId}</p>
          <p>Next {nextPack?.name ?? "none"}</p>
          {onOpenNext && <button onClick={onOpenNext}>Next pack</button>}
          <button onClick={() => onOpenCard("c2")}>Open card</button>
          <button onClick={onClose}>Close reveal</button>
        </div>
      );
    },
}));
jest.mock("next/navigation", () => {
  const push = jest.fn();
  return { useRouter: () => ({ push }) };
});
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/vault/sections/marketplace/store/PackHolographicCard", () => ({
  PackHolographicCard: ({
    pack,
    actionButton,
  }: {
    pack: { name: string };
    actionButton: React.ReactNode;
  }) => (
    <div>
      {pack.name}
      {actionButton}
    </div>
  ),
}));
jest.mock("~/components/vault/VaultParticleExplosionModal", () => ({
  VaultParticleExplosionModal: () => null,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      vault: { getBalance: { invalidate: jest.fn() } },
      cardPacks: { getMyPacks: { invalidate: jest.fn() } },
    }),
    cardPacks: {
      getMyPacks: { useQuery: jest.fn() },
      getAvailablePacks: { useQuery: jest.fn() },
      purchasePack: { useMutation: jest.fn() },
    },
    vault: {
      listStoreItems: { useQuery: () => ({ data: [], isLoading: false }) },
      getPurchasedItems: { useQuery: () => ({ data: undefined }) },
      purchaseStoreItem: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));

import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { VaultStoreTab } from "~/components/vault/sections/marketplace/VaultStoreTab";

const packItem = (id: string, name: string) => ({
  id,
  name,
  description: null,
  artwork: null,
  packType: "BASIC",
  priceCredits: 100,
  cardCount: 5,
  guaranteedRarity: null,
  commonOdds: 100,
  uncommonOdds: 0,
  rareOdds: 0,
  ultraRareOdds: 0,
  epicOdds: 0,
  legendaryOdds: 0,
});
const waiting = [
  { id: "up1", pack: packItem("p1", "Ixnay starter") },
  { id: "up2", pack: packItem("p2", "Eurth booster") },
];

interface PurchaseOptions {
  onSuccess: (
    data: { userPack: { id: string; pack: ReturnType<typeof packItem> } },
    variables: { packId: string }
  ) => void;
}

let purchase: PurchaseOptions | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(api.cardPacks.getMyPacks.useQuery)
    .mockReturnValue({ data: { packs: waiting }, isLoading: false } as never);
  jest.mocked(api.cardPacks.getAvailablePacks.useQuery).mockReturnValue({
    data: { packs: [packItem("p3", "Realm pack")] },
    isLoading: false,
  } as never);
  jest.mocked(api.cardPacks.purchasePack.useMutation).mockImplementation(((
    options: PurchaseOptions
  ) => {
    purchase = options;
    return { mutate: jest.fn(), isPending: false };
  }) as never);
});

describe("the Store's pack reveal", () => {
  it("lists only packs still to open", () => {
    render(<VaultStoreTab initialView="my-packs" />);
    expect(api.cardPacks.getMyPacks.useQuery).toHaveBeenCalledWith({ isOpened: false });
  });

  it("opens a waiting pack, offers the next one, and moves on to it", () => {
    render(<VaultStoreTab initialView="my-packs" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Rip open pack" })[0]!);
    expect(screen.getByRole("dialog", { name: "Revealing Ixnay starter" })).toHaveTextContent(
      "Pack up1"
    );
    expect(screen.getByText("Next Eurth booster")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next pack" }));
    expect(screen.getByRole("dialog", { name: "Revealing Eurth booster" })).toHaveTextContent(
      "Pack up2"
    );
    expect(screen.getByText("Next Ixnay starter")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close reveal" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a pack straight after it is bought", () => {
    render(<VaultStoreTab />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const bought = packItem("p3", "Realm pack");
    act(() => purchase?.onSuccess({ userPack: { id: "up9", pack: bought } }, { packId: "p3" }));
    expect(screen.getByRole("dialog", { name: "Revealing Realm pack" })).toHaveTextContent(
      "Pack up9"
    );
  });

  it("opens a pulled card's sheet in Mine", () => {
    render(<VaultStoreTab initialView="my-packs" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Rip open pack" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Open card" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useRouter().push).toHaveBeenCalledWith("/vault/cards/mine?card=c2");
  });
});
