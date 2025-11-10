"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Package, Gift, Sparkles, Clock } from "lucide-react";
import { cn } from "~/lib/utils";

// TODO: These will be replaced with components from Agent 2
// For now, create placeholder components

function PackPurchaseModal({
  pack,
  open,
  onClose,
}: {
  pack: any;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <Card className="glass-hierarchy-modal max-w-md">
        <CardHeader>
          <CardTitle>Purchase {pack?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">This will be the pack purchase modal from Agent 2</p>
          <Button onClick={onClose}>Close</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PackOpeningSequence({
  pack,
  open,
  onClose,
}: {
  pack: any;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <Card className="glass-hierarchy-modal max-w-4xl">
        <CardHeader>
          <CardTitle>Opening {pack?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">This will be the pack opening animation from Agent 2</p>
          <Button onClick={onClose}>Close</Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface PackType {
  id: string;
  name: string;
  price: number;
  description: string;
  cardCount: number;
  rarity: "starter" | "booster" | "premium";
  imageUrl?: string;
}

const AVAILABLE_PACKS: PackType[] = [
  {
    id: "starter",
    name: "Starter Pack",
    price: 100,
    description: "Perfect for beginners. Contains 5 cards with guaranteed uncommon.",
    cardCount: 5,
    rarity: "starter",
  },
  {
    id: "booster",
    name: "Booster Pack",
    price: 250,
    description: "Standard pack with 8 cards and a chance for rare cards.",
    cardCount: 8,
    rarity: "booster",
  },
  {
    id: "premium",
    name: "Premium Pack",
    price: 500,
    description: "Deluxe pack with 12 cards and guaranteed rare or better.",
    cardCount: 12,
    rarity: "premium",
  },
];

export default function PacksPage() {
  const [selectedPack, setSelectedPack] = useState<PackType | null>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [openingModalOpen, setOpeningModalOpen] = useState(false);

  // TODO: Replace with actual API calls
  const unopenedPacks: any[] = [];
  const purchaseHistory: any[] = [];
  const loading = false;

  const handlePurchase = (pack: PackType) => {
    setSelectedPack(pack);
    setPurchaseModalOpen(true);
  };

  const handleOpenPack = (pack: any) => {
    setSelectedPack(pack);
    setOpeningModalOpen(true);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "starter":
        return "text-blue-400";
      case "booster":
        return "text-purple-400";
      case "premium":
        return "text-gold-400";
      default:
        return "text-gray-400";
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case "starter":
        return Package;
      case "booster":
        return Gift;
      case "premium":
        return Sparkles;
      default:
        return Package;
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
        <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 md:grid-cols-3">
          {AVAILABLE_PACKS.map((pack) => {
            const Icon = getRarityIcon(pack.rarity);

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
                          getRarityColor(pack.rarity)
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
                        {pack.price} IxC
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
            {unopenedPacks.map((pack) => (
              <Card
                key={pack.id}
                className="glass-hierarchy-child cursor-pointer transition-all hover:scale-105"
                onClick={() => handleOpenPack(pack)}
              >
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Package className="mb-2 h-12 w-12 text-purple-400" />
                  <p className="font-semibold">{pack.name}</p>
                  <Button size="sm" className="mt-4">
                    Open Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Purchase history */}
      <div>
        <h2 className="mb-4 text-xl sm:text-2xl font-bold">Purchase History</h2>
        <Card className="glass-hierarchy-child">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : purchaseHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Clock className="mb-4 h-16 w-16 text-muted-foreground" />
                <p className="text-muted-foreground">No purchase history yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {purchaseHistory.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div>
                      <p className="font-semibold">{purchase.packName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(purchase.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gold-400">
                        {purchase.price} IxC
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <PackPurchaseModal
        pack={selectedPack}
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
      />
      <PackOpeningSequence
        pack={selectedPack}
        open={openingModalOpen}
        onClose={() => setOpeningModalOpen(false)}
      />
    </div>
  );
}
