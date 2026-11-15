"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Package,
  MagicWand,
  Shop as Store,
  Crown,
  Cpu,
  OpenBook as BookOpen,
  Database,
  StatUp as TrendingUp,
  Trophy as Award,
  FireFlame as Flame,
  Shield,
  Flash as Zap,
  Coins,
  Heart,
  Palette,
  Wrench,
  Dashboard as Gauge,
  Lock,
  Compass,
  Trophy,
  Crown as Gem,
  Tournament as Sword,
  Archery as Target,
  WhiteFlag as Flag,
  Flare,
  Emoji as Skull,
  Key,
  LightBulb as Lightbulb,
  Terminal,
  MusicDoubleNote as Music,
  Label as Ticket,
  Gamepad as Gamepad2,
  SeaWaves as Anchor,
  SunLight as Sun,
  HalfMoon as Moon,
  Hammer,
  Eye,
  User,
  WarningCircle,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { soundCues } from "~/lib/sound/cuelume";
import { storePrerequisiteMet } from "~/lib/vault/store-purchases";
import { previewCosmetic } from "~/lib/vault/public-cosmetics";
import { cardSheetHref } from "~/lib/cards/face/sheet-link";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { PageHeader } from "~/components/shell/PageHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Skeleton } from "~/components/ui/skeleton";
import { useNotify } from "~/hooks/useNotify";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { IconWell } from "../dashboard/IconWell";
import { StoreItemCard, type StoreItem } from "./StoreItemCard";
import { PackHolographicCard, type PackItem } from "./store/PackHolographicCard";
import { StorePurchaseDialog } from "./store/StorePurchaseDialog";
import { UnopenedPacksShelf } from "./store/UnopenedPacksShelf";

const PackReveal = dynamic(
  () => import("~/components/cards/reveal/PackReveal").then((m) => m.PackReveal),
  { ssr: false }
);

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles: MagicWand,
  Cpu,
  Crown,
  BookOpen,
  Database,
  TrendingUp,
  Award,
  Flame,
  Shield,
  Zap,
  Coins,
  Heart,
  Palette,
  Wrench,
  Gauge,
  Lock,
  Compass,
  Trophy,
  Gem,
  Sword,
  Target,
  Flag,
  Ghost: Flare,
  Skull,
  Key,
  Lightbulb,
  Terminal,
  Music,
  Ticket,
  Gamepad2,
  Anchor,
  Sun,
  Moon,
  Hammer,
  Eye,
  User,
};

type CheckoutTarget =
  { kind: "pack"; pack: PackItem; item: StoreItem } | { kind: "item"; item: StoreItem };

function packToCheckoutItem(pack: PackItem): StoreItem {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description || `${pack.cardCount.toLocaleString()} collectible cards.`,
    price: pack.priceCredits,
    icon: Package,
    quality: "standard",
    badgeText: `${pack.cardCount.toLocaleString()} cards`,
    category: "packs",
    pack,
  };
}

function StoreBalanceChip({ credits, loading }: { credits?: number; loading: boolean }) {
  if (loading) return <Skeleton className="h-7 w-24 rounded-full" />;
  if (credits === undefined) return null;
  return (
    <Badge
      variant="secondary"
      data-slot="store-balance-chip"
      className="text-footnote px-2.5 py-1 font-medium tabular-nums"
    >
      <IxCreditsSymbol decorative className="size-3.5 shrink-0" />
      <span>{credits.toLocaleString()} IxC</span>
    </Badge>
  );
}

export function VaultStoreTab({ initialView: _initialView }: { initialView?: string | null } = {}) {
  const notify = useNotify();
  const router = useRouter();
  const utils = api.useUtils();

  const [opening, setOpening] = useState<{ id: string; pack: PackItem } | null>(null);
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);

  const { data: balanceData, isLoading: balanceLoading } = api.vault.getBalance.useQuery();
  const { data: myPacksData } = api.cardPacks.getMyPacks.useQuery({ isOpened: false });
  const {
    data: packsData,
    isLoading: packsLoading,
    isError: packsError,
    refetch: refetchPacks,
  } = api.cardPacks.getAvailablePacks.useQuery();
  const {
    data: storeItemsData,
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = api.vault.listStoreItems.useQuery();
  const { data: ownedData } = api.vault.getPurchasedItems.useQuery();

  const purchasePackMutation = api.cardPacks.purchasePack.useMutation({
    onSuccess: (data) => {
      setCheckout(null);
      notify.success("Card pack purchased");
      void utils.vault.getBalance.invalidate();
      void utils.cardPacks.getMyPacks.invalidate();
      setOpening({ id: data.userPack.id, pack: data.userPack.pack });
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to purchase card pack.");
    },
  });

  const purchaseStoreItemMutation = api.vault.purchaseStoreItem.useMutation({
    onSuccess: () => {
      const purchasedName = checkout?.item.name;
      soundCues.success();
      notify.success(
        "Added to your Vault",
        purchasedName
          ? `${purchasedName} is ready in your Vault.`
          : "Apply it from your account settings."
      );
      void utils.vault.getBalance.invalidate();
      void utils.vault.getPurchasedItems.invalidate();
      setCheckout(null);
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to complete transaction.");
    },
  });

  const packs = packsData?.packs ?? [];
  const myPacks = myPacksData?.packs ?? [];
  const nextWaiting = myPacks.find((p) => p.id !== opening?.id) ?? null;

  const cosmeticItems: StoreItem[] = (storeItemsData ?? [])
    .filter((item) => item.category === "cosmetics")
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      icon: ICON_MAP[item.icon] || MagicWand,
      quality: item.quality || "standard",
      badgeText: item.badgeText || "Cosmetic",
      category: item.category,
      cosmetics: previewCosmetic(item.id, item.effects),
    }));

  const UPGRADE_ITEMS: StoreItem[] = (storeItemsData ?? [])
    .filter((item) => item.category === "upgrades")
    .filter((item) => storePrerequisiteMet(item.id, ownedData?.purchaseCounts))
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      icon: ICON_MAP[item.icon] || TrendingUp,
      quality: item.quality || "standard",
      badgeText: item.badgeText || "Capacity",
      category: item.category,
    }));

  const isPurchasing =
    checkout?.kind === "pack"
      ? purchasePackMutation.isPending
      : checkout?.kind === "item"
        ? purchaseStoreItemMutation.isPending
        : false;

  const handleConfirmPurchase = () => {
    if (!checkout) return;
    if (checkout.kind === "pack") {
      purchasePackMutation.mutate({ packId: checkout.pack.id });
    } else {
      purchaseStoreItemMutation.mutate({ itemId: checkout.item.id });
    }
  };

  const isLoading = packsLoading && itemsLoading;
  const isError = packsError && itemsError;

  return (
    <div className="space-y-10 pb-10">
      <PageHeader
        title="Store"
        subtitle="Card packs, profile cosmetics, and Vault capacity."
        actions={<StoreBalanceChip credits={balanceData?.credits} loading={balanceLoading} />}
        bleed
      />

      {myPacks.length > 0 && (
        <UnopenedPacksShelf
          packs={myPacks}
          onOpenPack={(userPack) => setOpening({ id: userPack.id, pack: userPack.pack })}
        />
      )}

      {isError ? (
        <Card padding="lg">
          <EmptyState
            icon={<WarningCircle />}
            title="The store didn't load"
            message="Please try again in a moment."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void refetchPacks();
                  void refetchItems();
                }}
              >
                Try again
              </Button>
            }
          />
        </Card>
      ) : isLoading ? (
        <div aria-busy className="space-y-10">
          <div className="space-y-4">
            <Skeleton className="h-6 w-36" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="rounded-cutout h-72 w-full" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-44" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="rounded-cutout h-64 w-full" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <section aria-labelledby="store-packs-heading" className="space-y-4">
            <div className="space-y-1">
              <h2 id="store-packs-heading" className="text-title-3 text-label">
                Card packs
              </h2>
              <p className="text-label-secondary text-footnote">
                Foil packs from active realms with published drop odds.
              </p>
            </div>

            {packsLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="rounded-cutout h-72 w-full" />
                ))}
              </div>
            ) : packs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {packs.map((pack) => {
                  const buyingThisPack =
                    checkout?.kind === "pack" &&
                    checkout.pack.id === pack.id &&
                    purchasePackMutation.isPending;
                  return (
                    <PackHolographicCard
                      key={pack.id}
                      pack={pack}
                      isPurchasing={buyingThisPack}
                      onPurchase={(selectedPack) =>
                        setCheckout({
                          kind: "pack",
                          pack: selectedPack,
                          item: packToCheckoutItem(selectedPack),
                        })
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <Card padding="lg">
                <EmptyState
                  icon={<Store />}
                  title="No packs available"
                  message="Check back later for new pack drops and seasonal releases."
                />
              </Card>
            )}
          </section>

          <section aria-labelledby="store-cosmetics-heading" className="space-y-4">
            <div className="space-y-1">
              <h2 id="store-cosmetics-heading" className="text-title-3 text-label">
                Profile cosmetics
              </h2>
              <p className="text-label-secondary text-footnote">
                Frames, avatar glows, and name badges shown across IxStates.
              </p>
            </div>

            {itemsLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="rounded-cutout h-64 w-full" />
                ))}
              </div>
            ) : cosmeticItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cosmeticItems.map((item) => (
                  <StoreItemCard
                    key={item.id}
                    item={item}
                    onPurchase={(selectedItem) => setCheckout({ kind: "item", item: selectedItem })}
                    isPurchasing={
                      checkout?.kind === "item" &&
                      checkout.item.id === item.id &&
                      purchaseStoreItemMutation.isPending
                    }
                    isOwned={Boolean(ownedData?.purchasedItemIds.includes(item.id))}
                    purchaseCount={ownedData?.purchaseCounts[item.id] ?? 0}
                  />
                ))}
              </div>
            ) : (
              <Card padding="lg">
                <EmptyState
                  icon={<MagicWand />}
                  title="No cosmetics listed"
                  message="No cosmetics are for sale right now."
                />
              </Card>
            )}
          </section>

          <FacetList>
            <FacetListSection
              header="Vault capacity"
              headerAs="h2"
              footer="Permanent expansions applied immediately to your account."
            >
              {UPGRADE_ITEMS.length > 0 ? (
                UPGRADE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const ownedCount = ownedData?.purchaseCounts[item.id] ?? 0;
                  const canAfford = balanceData === undefined || balanceData.credits >= item.price;
                  const buyingThisUpgrade =
                    checkout?.kind === "item" &&
                    checkout.item.id === item.id &&
                    purchaseStoreItemMutation.isPending;

                  return (
                    <FacetRow
                      key={item.id}
                      leading={
                        <IconWell>
                          <Icon />
                        </IconWell>
                      }
                      title={item.name}
                      subtitle={item.description}
                      trailing={
                        <span className="flex flex-wrap items-center justify-end gap-2.5">
                          {ownedCount > 0 && (
                            <Badge variant="secondary">{ownedCount.toLocaleString()} owned</Badge>
                          )}
                          <span className="text-subhead font-semibold tabular-nums">
                            {item.price.toLocaleString()} IxC
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!canAfford || buyingThisUpgrade}
                            onClick={() => setCheckout({ kind: "item", item })}
                          >
                            {buyingThisUpgrade ? "Buying..." : "Buy"}
                          </Button>
                        </span>
                      }
                    />
                  );
                })
              ) : (
                <FacetRow
                  title="No capacity upgrades listed"
                  subtitle="No Vault capacity expansions are available right now."
                />
              )}
            </FacetListSection>
          </FacetList>
        </div>
      )}

      <StorePurchaseDialog
        item={checkout?.item ?? null}
        currentBalance={balanceData?.credits}
        onClose={() => setCheckout(null)}
        onConfirm={handleConfirmPurchase}
        isPurchasing={isPurchasing}
      />

      {opening && (
        <PackReveal
          key={opening.id}
          open
          userPackId={opening.id}
          pack={opening.pack}
          nextPack={nextWaiting ? { id: nextWaiting.id, name: nextWaiting.pack.name } : null}
          onOpenNext={() =>
            nextWaiting && setOpening({ id: nextWaiting.id, pack: nextWaiting.pack })
          }
          onOpenCard={(cardId) => {
            setOpening(null);
            router.push(cardSheetHref(CARD_HUB_PATHS.mine, cardId));
          }}
          onClose={() => setOpening(null)}
        />
      )}
    </div>
  );
}
