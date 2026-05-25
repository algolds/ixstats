"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Package, ShoppingCart, Sparkles, Star, Gift, Store } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault-notifications";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { useSoundService } from "~/lib/sound-service";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";

const PackOpeningSequence = dynamic(
  () =>
    import("~/components/cards/pack-opening/PackOpeningSequence").then(
      (m) => m.PackOpeningSequence
    ),
  { ssr: false }
);

interface VaultAcquireSectionProps {
  initialTab?: string | null;
}

// ─── Pack config helper ──────────────────────────────────────────

const getPackConfig = (packType: string) => {
  const type = packType.toUpperCase();
  if (type.includes("BASIC") || type.includes("STARTER"))
    return {
      color: "text-blue-400",
      borderColor: "border-blue-400/30",
      icon: Package,
      label: "Basic",
    };
  if (type.includes("ELITE") || type.includes("LEGENDARY"))
    return {
      color: "text-purple-400",
      borderColor: "border-purple-400/30",
      icon: Star,
      label: "Elite",
    };
  if (type.includes("PREMIUM") || type.includes("GOLD"))
    return {
      color: "text-amber-400",
      borderColor: "border-amber-400/30",
      icon: Sparkles,
      label: "Premium",
    };
  if (type.includes("EVENT") || type.includes("LIMITED"))
    return {
      color: "text-red-400",
      borderColor: "border-red-400/30",
      icon: Sparkles,
      label: "Event",
    };
  return {
    color: "text-cyan-400",
    borderColor: "border-cyan-400/30",
    icon: Gift,
    label: "Special",
  };
};

// ─── Main Section (Packs only) ───────────────────────────────────

export function VaultAcquireSection({ initialTab: _initialTab }: VaultAcquireSectionProps) {
  const [openingPack, setOpeningPack] = useState<{ id: string; packType: string } | null>(null);
  const soundService = useSoundService();

  const { data: availableData, isLoading: packsLoading } =
    api.cardPacks.getAvailablePacks.useQuery();
  const {
    data: myPacksData,
    isLoading: myPacksLoading,
    refetch: refetchMyPacks,
  } = api.cardPacks.getMyPacks.useQuery(
    { isOpened: false } // Only show unopened packs
  );

  const availablePacks = availableData?.packs;
  const myPacks = myPacksData?.packs;

  const purchasePack = api.cardPacks.purchasePack.useMutation({
    onSuccess: (data) => {
      vaultNotify.packPurchased();
      void refetchMyPacks();
      soundService?.play("pack-open");
      // Auto-open the newly purchased pack
      if (data.success && data.userPack) {
        const packType = (data.userPack as any).pack?.packType ?? "BASIC";
        setOpeningPack({ id: data.userPack.id, packType });
      }
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  return (
    <div className="space-y-4">
      {/* My Packs */}
      <div>
        <h3 className="text-foreground mb-2 flex items-center gap-1.5 text-xs font-bold">
          <Package className="h-3.5 w-3.5 text-blue-400" />
          My Packs
        </h3>
        {myPacksLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !myPacks || myPacks.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Package className="text-muted-foreground/40 mb-2 h-8 w-8" />
              <p className="text-foreground/80 text-xs font-semibold">No Packs</p>
              <p className="text-muted-foreground text-[0.65rem]">
                Purchase packs from the store below
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myPacks.map((userPack: any) => {
              const packData = userPack.pack; // Prisma relation: UserPack.pack -> CardPack
              const config = getPackConfig(packData?.packType ?? "BASIC");
              const Icon = config.icon;
              return (
                <Card
                  key={userPack.id}
                  className={cn("glass-hierarchy-child border", config.borderColor)}
                >
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", config.color)} />
                        <span className="text-xs font-bold">
                          {packData?.name || config.label + " Pack"}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("px-1.5 py-0 text-[9px]", config.color)}
                      >
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[0.65rem]">
                      {packData?.cardCount || 5} cards
                    </p>
                    <Button
                      onClick={() =>
                        setOpeningPack({ id: userPack.id, packType: packData?.packType ?? "BASIC" })
                      }
                      className="w-full"
                      size="sm"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Open Pack
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pack Store */}
      <div>
        <h3 className="text-foreground mb-2 flex items-center gap-1.5 text-xs font-bold">
          <Store className="h-3.5 w-3.5 text-amber-400" />
          Pack Store
        </h3>
        {packsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : !availablePacks || availablePacks.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Store className="text-muted-foreground/40 mb-2 h-8 w-8" />
              <p className="text-foreground/80 text-xs font-semibold">No Packs Available</p>
              <p className="text-muted-foreground text-[0.65rem]">Check back soon for new packs!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availablePacks.map((pack: any) => {
              const config = getPackConfig(pack.packType);
              const Icon = config.icon;
              return (
                <Card
                  key={pack.id}
                  className={cn("glass-hierarchy-child overflow-hidden border", config.borderColor)}
                >
                  {pack.artwork ? (
                    <div className="relative h-20 w-full">
                      <img
                        src={pack.artwork}
                        alt={pack.name}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                  ) : (
                    <PackHolographicCover
                      packType={pack.packType}
                      guaranteedRarity={pack.guaranteedRarity}
                      packName={pack.name}
                      size="sm"
                    />
                  )}
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", config.color)} />
                        <span className="text-xs font-bold">{pack.name}</span>
                      </div>
                      <span className="text-sm font-bold text-amber-400">
                        {pack.priceCredits?.toLocaleString() ?? "?"} IxC
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[0.65rem]">
                      {pack.description || `${pack.cardCount || 5} cards per pack`}
                    </p>
                    <Button
                      onClick={() => purchasePack.mutate({ packId: pack.id })}
                      disabled={purchasePack.isPending}
                      className="w-full"
                      size="sm"
                    >
                      <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                      {purchasePack.isPending ? "Purchasing..." : "Purchase"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pack opening — fixed full-screen overlay */}
      {openingPack && (
        <div className="fixed inset-0 z-50">
          <PackOpeningSequence
            userPackId={openingPack.id}
            packType={openingPack.packType as any}
            onComplete={() => {
              setOpeningPack(null);
              purchasePack.reset();
              void refetchMyPacks();
            }}
            onCancel={() => {
              setOpeningPack(null);
              purchasePack.reset();
            }}
          />
        </div>
      )}
    </div>
  );
}
