"use client";

import { springSmooth } from "~/lib/design/motion";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
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
import { storePrerequisiteMet } from "~/lib/vault/store-purchases";
import { previewCosmetic } from "~/lib/vault/public-cosmetics";
import { cardSheetHref } from "~/lib/cards/face/sheet-link";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { StoreItemCard, type StoreItem } from "./StoreItemCard";
import { useNotify } from "~/hooks/useNotify";
import { PackHolographicCard, type PackItem } from "./store/PackHolographicCard";
import { StoreCategoryHeader } from "./store/StoreCategoryHeader";
import { StorePurchaseDialog } from "./store/StorePurchaseDialog";
import { VaultParticleExplosionModal } from "~/components/vault/VaultParticleExplosionModal";
import { Card, CardTitle } from "~/components/ui/card";

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

const STORE_TABS = [
  { id: "my-packs" as const, label: "My packs", icon: Package },
  { id: "packs" as const, label: "Packs", icon: Store },
  { id: "cosmetics" as const, label: "Cosmetics", icon: MagicWand },
  { id: "upgrades" as const, label: "Account upgrades", icon: TrendingUp },
];

type StoreView = (typeof STORE_TABS)[number]["id"];

/** The store sub-tab a `view` URL param names; Packs by default (old `boosters` links included). */
export function resolveStoreView(view: string | null | undefined): StoreView {
  return STORE_TABS.find((tab) => tab.id === view)?.id ?? "packs";
}

export function VaultStoreTab({ initialView }: { initialView?: string | null }) {
  const notify = useNotify();
  const router = useRouter();

  const [storeTab, setStoreTab] = useState<StoreView>(() => resolveStoreView(initialView));
  const [opening, setOpening] = useState<{ id: string; pack: PackItem } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activeCheckoutItem, setActiveCheckoutItem] = useState<StoreItem | null>(null);
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null);
  const sections = useRef<HTMLDivElement>(null);

  const utils = api.useUtils();

  const {
    data: myPacksData,
    isLoading: myPacksLoading,
    isError: myPacksError,
    refetch: refetchMyPacks,
  } = api.cardPacks.getMyPacks.useQuery({
    isOpened: false,
  });
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
      notify.success("Item unlocked");
      void utils.vault.getBalance.invalidate();
      void utils.vault.getPurchasedItems.invalidate();
      setActiveCheckoutItem(null);
      setPurchasingItemId(null);
      setShowCelebration(true);

      setTimeout(() => {
        setShowCelebration(false);
      }, 3500);
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to complete transaction.");
      setPurchasingItemId(null);
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

  const upgradeItems: StoreItem[] = (storeItemsData ?? [])
    .filter((item) => item.category === "upgrades")
    .filter((item) => storePrerequisiteMet(item.id, ownedData?.purchaseCounts))
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      icon: ICON_MAP[item.icon] || MagicWand,
      quality: item.quality || "standard",
      badgeText: item.badgeText || "Custom",
      category: item.category,
    }));

  const handleCustomPurchaseConfirm = () => {
    if (!activeCheckoutItem) return;
    setPurchasingItemId(activeCheckoutItem.id);
    purchaseStoreItemMutation.mutate({ itemId: activeCheckoutItem.id });
  };

  const isLoading =
    storeTab === "my-packs" ? myPacksLoading : storeTab === "packs" ? packsLoading : itemsLoading;
  const isError =
    storeTab === "my-packs" ? myPacksError : storeTab === "packs" ? packsError : itemsError;
  const retryActive =
    storeTab === "my-packs" ? refetchMyPacks : storeTab === "packs" ? refetchPacks : refetchItems;

  const activeConfig = {
    "my-packs": {
      title: "My unopened packs",
      icon: <Package className="text-blue h-4 w-4" />,
      description: "Packs you own that are ready to open.",
    },
    packs: {
      title: "Packs",
      icon: <Store className="text-tint h-4 w-4" />,
      description: "Packs from every realm. Each shows its odds.",
    },
    cosmetics: {
      title: "Profile customizations",
      icon: <MagicWand className="text-indigo h-4 w-4" />,
      description: "Decorations, frames, and name badges for your profile.",
    },
    upgrades: {
      title: "Vault system upgrades",
      icon: <TrendingUp className="text-green h-4 w-4" />,
      description: "Permanent card space and passive credit yield.",
    },
  }[storeTab];

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Store"
        subtitle="Packs, profile cosmetics and Vault capacity upgrades."
        back={{ href: "/vault", label: "Vault" }}
        bleed
      />

      <div ref={sections}>
        <StoreCategoryHeader
          tabs={STORE_TABS}
          activeTab={storeTab}
          onTabChange={setStoreTab}
          myPacksCount={myPacks.length}
        />
      </div>

      {isError ? (
        <Card>
          <EmptyState
            icon={<WarningCircle />}
            title="The store didn't load"
            message="Please try again in a moment."
            action={
              <Button variant="secondary" size="sm" onClick={() => void retryActive()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : isLoading ? (
        <Card padding="lg" className="space-y-5">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div aria-busy className="flex flex-wrap justify-center gap-6 py-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="rounded-card h-[280px] w-44 shrink-0" />
            ))}
          </div>
        </Card>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={storeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={springSmooth}
            className="relative"
          >
            {storeTab === "my-packs" &&
              (myPacks.length > 0 ? (
                <Card padding="lg" className="space-y-5">
                  <div className="border-separator border-b pb-4">
                    <CardTitle icon={activeConfig.icon}>{activeConfig.title}</CardTitle>
                    <p className="text-label-secondary text-footnote mt-1">
                      {activeConfig.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-8 py-2">
                    {myPacks.map((userPack) => {
                      const packData = userPack.pack;
                      return (
                        <div key={userPack.id} className="shrink-0">
                          <PackHolographicCard
                            pack={packData}
                            actionButton={
                              <Button
                                size="sm"
                                onClick={() => setOpening({ id: userPack.id, pack: packData })}
                                className="h-7 w-full"
                              >
                                Rip open pack
                              </Button>
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : (
                <Card>
                  <EmptyState
                    icon={<Package />}
                    title="No unopened packs"
                    message="You have no unopened packs right now. Buy one from Packs."
                    action={
                      <Button size="sm" onClick={() => setStoreTab("packs")}>
                        <Store aria-hidden />
                        Browse packs
                      </Button>
                    }
                  />
                </Card>
              ))}

            {storeTab === "packs" &&
              (packs.length > 0 ? (
                <Card padding="lg" className="space-y-5">
                  <div className="border-separator border-b pb-4">
                    <CardTitle icon={activeConfig.icon}>{activeConfig.title}</CardTitle>
                    <p className="text-label-secondary text-footnote mt-1">
                      {activeConfig.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-8 py-2">
                    {packs.map((pack) => {
                      const isPending =
                        purchasePackMutation.isPending &&
                        purchasePackMutation.variables?.packId === pack.id;
                      return (
                        <div key={pack.id} className="shrink-0">
                          <PackHolographicCard
                            pack={pack}
                            actionButton={
                              <Button
                                size="sm"
                                onClick={() =>
                                  purchasePackMutation.mutate({
                                    packId: pack.id,
                                  })
                                }
                                disabled={isPending}
                                className="h-7 w-full"
                              >
                                {isPending ? (
                                  "Buying..."
                                ) : (
                                  <span className="flex items-center gap-1 tabular-nums">
                                    <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                                    Buy ({pack.priceCredits.toLocaleString()})
                                  </span>
                                )}
                              </Button>
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : (
                <Card>
                  <EmptyState
                    icon={<Store />}
                    title="No packs available"
                    message="Check back later for new pack drops and seasonal releases."
                  />
                </Card>
              ))}

            {storeTab === "cosmetics" &&
              (cosmeticItems.length > 0 ? (
                <Card padding="lg" className="space-y-5">
                  <div className="border-separator border-b pb-4">
                    <CardTitle icon={activeConfig.icon}>{activeConfig.title}</CardTitle>
                    <p className="text-label-secondary text-footnote mt-1">
                      {activeConfig.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cosmeticItems.map((item: StoreItem) => (
                      <StoreItemCard
                        key={item.id}
                        item={item}
                        onPurchase={(itm: StoreItem) => setActiveCheckoutItem(itm)}
                        isPurchasing={purchasingItemId === item.id}
                        isOwned={!!ownedData?.purchasedItemIds.includes(item.id)}
                        purchaseCount={ownedData?.purchaseCounts[item.id] ?? 0}
                      />
                    ))}
                  </div>
                </Card>
              ) : (
                <Card>
                  <EmptyState
                    icon={<MagicWand />}
                    title="No cosmetics listed"
                    message="No cosmetics are for sale right now."
                  />
                </Card>
              ))}

            {storeTab === "upgrades" &&
              (upgradeItems.length > 0 ? (
                <Card padding="lg" className="space-y-5">
                  <div className="border-separator border-b pb-4">
                    <CardTitle icon={activeConfig.icon}>{activeConfig.title}</CardTitle>
                    <p className="text-label-secondary text-footnote mt-1">
                      {activeConfig.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {upgradeItems.map((item: StoreItem) => (
                      <StoreItemCard
                        key={item.id}
                        item={item}
                        onPurchase={(itm: StoreItem) => setActiveCheckoutItem(itm)}
                        isPurchasing={purchasingItemId === item.id}
                        // Upgrades stack, so they are never "owned"; the count shows how many.
                        isOwned={false}
                        purchaseCount={ownedData?.purchaseCounts[item.id] ?? 0}
                      />
                    ))}
                  </div>
                </Card>
              ) : (
                <Card>
                  <EmptyState
                    icon={<TrendingUp />}
                    title="No upgrades listed"
                    message="No upgrades are for sale right now."
                  />
                </Card>
              ))}
          </motion.div>
        </AnimatePresence>
      )}

      <StorePurchaseDialog
        item={activeCheckoutItem}
        onClose={() => setActiveCheckoutItem(null)}
        onConfirm={handleCustomPurchaseConfirm}
        isPurchasing={
          purchasingItemId === activeCheckoutItem?.id && purchaseStoreItemMutation.isPending
        }
      />

      <VaultParticleExplosionModal
        open={showCelebration}
        title="Item added"
        subtitle="Apply it from your account settings."
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
          // An opened pack's "Rip open pack" button leaves My packs, so focus goes back to the section's tab.
          returnFocus={() =>
            sections.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ??
            null
          }
        />
      )}
    </div>
  );
}
