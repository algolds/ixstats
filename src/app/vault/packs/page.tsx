"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Package, Gift, Sparkles, Clock } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { PackOpeningSequence } from "~/components/cards/pack-opening/PackOpeningSequence";

// Simple purchase confirmation modal
function PackPurchaseModal({
  pack,
  open,
  onClose,
  onConfirm,
  isPurchasing,
}: {
  pack: any;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPurchasing: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <Card className="glass-hierarchy-modal max-w-md">
        <CardHeader>
          <CardTitle>Purchase {pack?.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{pack?.description}</p>
          <div className="rounded-lg bg-white/5 p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Cards:</span>
              <span className="font-semibold">{pack?.cardCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Price:</span>
              <span className="font-semibold text-gold-400">{pack?.priceCredits} IxC</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1" disabled={isPurchasing}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-gradient-to-r from-gold-500 to-orange-500 text-black"
              disabled={isPurchasing}
            >
              {isPurchasing ? "Purchasing..." : "Confirm Purchase"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PacksPage() {
  const [selectedPack, setSelectedPack] = useState<any>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [openingPack, setOpeningPack] = useState<any>(null);

  const utils = api.useUtils();

  // Fetch available packs
  const { data: packsData, isLoading: packsLoading } = api.cardPacks.getAvailablePacks.useQuery();
  const availablePacks = packsData?.packs || [];

  // Fetch user's unopened packs
  const { data: myPacksData, isLoading: myPacksLoading } = api.cardPacks.getMyPacks.useQuery({ isOpened: false });
  const unopenedPacks = myPacksData?.packs || [];

  // Purchase pack mutation
  const purchaseMutation = api.cardPacks.purchasePack.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setPurchaseModalOpen(false);
      setSelectedPack(null);
      // Refetch unopened packs
      utils.cardPacks.getMyPacks.invalidate();
      utils.vault.getBalance.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const loading = packsLoading || myPacksLoading;

  const handlePurchase = (pack: any) => {
    setSelectedPack(pack);
    setPurchaseModalOpen(true);
  };

  const confirmPurchase = () => {
    if (!selectedPack) return;
    purchaseMutation.mutate({ packId: selectedPack.id });
  };

  const handleOpenPack = (pack: any) => {
    setOpeningPack(pack);
  };

  const handlePackOpenComplete = () => {
    setOpeningPack(null);
    // Refetch user's packs and cards
    utils.cardPacks.getMyPacks.invalidate();
    utils.cards.getMyCards.invalidate();
    toast.success("Pack opened successfully! Check your inventory.");
  };

  const getRarityColor = (packType: string) => {
    if (packType.toLowerCase().includes("basic") || packType.toLowerCase().includes("starter")) {
      return "text-blue-400";
    } else if (packType.toLowerCase().includes("premium") || packType.toLowerCase().includes("elite")) {
      return "text-gold-400";
    } else {
      return "text-purple-400";
    }
  };

  const getRarityIcon = (packType: string) => {
    if (packType.toLowerCase().includes("basic") || packType.toLowerCase().includes("starter")) {
      return Package;
    } else if (packType.toLowerCase().includes("premium") || packType.toLowerCase().includes("elite")) {
      return Sparkles;
    } else {
      return Gift;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold-400">Card Packs</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Purchase new packs or open your existing collection
        </p>
      </div>

      {/* Available packs */}
      <div>
        <h2 className="mb-4 text-xl sm:text-2xl font-bold">Available Packs</h2>
        {loading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[400px]" />
            ))}
          </div>
        ) : availablePacks.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground">No packs available at the moment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 md:grid-cols-3">
            {availablePacks.map((pack: any) => {
              const Icon = getRarityIcon(pack.packType);

              return (
                <Card
                  key={pack.id}
                  className="glass-hierarchy-child group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-gold-500/20"
                >
                  <CardHeader>
                    <div className="mb-4 flex justify-center">
                      <div className="rounded-full bg-white/5 p-8">
                        <Icon
                          className={cn(
                            "h-16 w-16 transition-all duration-300 group-hover:scale-110",
                            getRarityColor(pack.packType)
                          )}
                        />
                      </div>
                    </div>
                    <CardTitle className="text-center">{pack.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-center text-sm text-muted-foreground">
                      {pack.description}
                    </p>
                    <div className="mb-4 space-y-2 rounded-lg bg-white/5 p-3">
                      <div className="flex justify-between text-sm">
                        <span>Cards:</span>
                        <span className="font-semibold">{pack.cardCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Price:</span>
                        <span className="font-semibold text-gold-400">
                          {pack.priceCredits} IxC
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handlePurchase(pack)}
                      className="w-full bg-gradient-to-r from-gold-500 to-orange-500 font-semibold text-black hover:scale-105"
                    >
                      Purchase
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Unopened packs */}
      <div>
        <h2 className="mb-4 text-xl sm:text-2xl font-bold">Your Unopened Packs</h2>
        {loading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 xs:grid-cols-3 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 sm:h-48" />
            ))}
          </div>
        ) : unopenedPacks.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
              <p className="text-sm sm:text-base text-muted-foreground text-center px-4">
                No unopened packs. Purchase some above!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 xs:grid-cols-3 md:grid-cols-4">
            {unopenedPacks.map((userPack: any) => {
              const Icon = getRarityIcon(userPack.pack?.packType || "");

              return (
                <Card
                  key={userPack.id}
                  className="glass-hierarchy-child cursor-pointer transition-all hover:scale-105"
                  onClick={() => handleOpenPack(userPack)}
                >
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Icon className={cn("mb-2 h-12 w-12", getRarityColor(userPack.pack?.packType || ""))} />
                    <p className="font-semibold text-center">{userPack.pack?.name}</p>
                    <Button size="sm" className="mt-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                      Open Now
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <PackPurchaseModal
        pack={selectedPack}
        open={purchaseModalOpen}
        onClose={() => {
          setPurchaseModalOpen(false);
          setSelectedPack(null);
        }}
        onConfirm={confirmPurchase}
        isPurchasing={purchaseMutation.isPending}
      />

      {openingPack && (
        <PackOpeningSequence
          userPackId={openingPack.id}
          packType={openingPack.pack?.packType}
          packArtwork={openingPack.pack?.artwork}
          onComplete={handlePackOpenComplete}
          onCancel={() => setOpeningPack(null)}
        />
      )}
    </div>
  );
}
