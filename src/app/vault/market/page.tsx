"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Plus } from "lucide-react";
import { MarketBrowser, CreateAuctionModal } from "~/components/cards/marketplace";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";

/**
 * Market Page - Card Marketplace with Auction System
 *
 * Features:
 * - Active auctions browser with filters and sorting
 * - User's active bids tracking
 * - User's active listings management
 * - Create auction modal for listing cards
 * - Real-time countdown timers
 * - Glass physics design system
 * - Mobile responsive layout
 *
 * Backend Integration:
 * - api.cardMarket.getActiveAuctions - Browse all active auctions
 * - api.cardMarket.getMyActiveBids - User's current bids
 * - api.cardMarket.getMyActiveAuctions - User's listings
 * - api.cardMarket.createAuction - Create new listing
 * - api.cardMarket.placeBid - Place bid on auction
 * - api.cardMarket.executeBuyout - Instant purchase
 */
export default function MarketPage() {
  const { userId } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  // Fetch user vault balance for bidding
  const { data: vaultBalance } = api.vault.getBalance.useQuery(
    { userId: userId || "" },
    { enabled: !!userId }
  );

  // Fetch user's available cards for listing
  // TODO: Wire up when inventory endpoint is available
  // const { data: userCards } = api.vault.getUserCards.useQuery(
  //   { userId: userId || "" },
  //   { enabled: !!userId }
  // );

  // Create auction mutation
  const createAuctionMutation = api.cardMarket.createAuction.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Auction created successfully!");
      setCreateModalOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create auction");
    },
  });

  /**
   * Handle auction creation
   */
  const handleCreateAuction = async (input: any) => {
    try {
      await createAuctionMutation.mutateAsync({
        cardId: input.cardInstanceId,
        startingPrice: input.startingPrice,
        buyoutPrice: input.buyoutPrice,
        duration: String(input.duration) as "30" | "60",
        isFeatured: input.isFeatured,
      });
    } catch (error) {
      // Error handling is done in mutation callbacks
      console.error("[MarketPage] Error creating auction:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gold-400">
            Card Marketplace
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Buy and sell cards with other players through live auctions
          </p>
          {vaultBalance && (
            <p className="text-xs sm:text-sm text-gray-400">
              Your Balance: <span className="font-bold text-gold-400">{vaultBalance.credits.toLocaleString()} IxC</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          disabled={!userId}
          className="rounded-lg bg-gradient-to-r from-gold-500 to-orange-500 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-bold text-black hover:scale-105 active:scale-95 touch-manipulation transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <Plus className="mr-2 inline-block h-3 w-3 sm:h-4 sm:w-4" />
          Create Auction
        </button>
      </div>

      {/* Market tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass-hierarchy-child grid w-full grid-cols-3 gap-1 p-1">
          <TabsTrigger value="active" className="text-xs sm:text-sm">
            Active Auctions
          </TabsTrigger>
          <TabsTrigger value="bids" className="text-xs sm:text-sm">
            My Bids
          </TabsTrigger>
          <TabsTrigger value="listings" className="text-xs sm:text-sm">
            My Listings
          </TabsTrigger>
        </TabsList>

        {/* Active Auctions Tab */}
        <TabsContent value="active" className="mt-6">
          <MarketBrowser
            showAnalytics={true}
            currentUserId={userId || undefined}
            userBalance={vaultBalance?.credits || 0}
          />
        </TabsContent>

        {/* My Bids Tab */}
        <TabsContent value="bids" className="mt-6">
          {!userId ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-12 text-center">
              <p className="text-lg font-medium text-white">Sign in to view your bids</p>
              <p className="mt-2 text-sm text-gray-400">
                Track your active bids and auction participation
              </p>
            </div>
          ) : (
            <MarketBrowser
              initialFilters={{ }}
              showAnalytics={false}
              currentUserId={userId}
              userBalance={vaultBalance?.credits || 0}
            />
          )}
        </TabsContent>

        {/* My Listings Tab */}
        <TabsContent value="listings" className="mt-6">
          {!userId ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-12 text-center">
              <p className="text-lg font-medium text-white">Sign in to view your listings</p>
              <p className="mt-2 text-sm text-gray-400">
                Manage your active auction listings
              </p>
            </div>
          ) : (
            <MarketBrowser
              initialFilters={{  }}
              showAnalytics={false}
              currentUserId={userId}
              userBalance={vaultBalance?.credits || 0}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Create auction modal */}
      <CreateAuctionModal
        availableCards={[]} // TODO: Pass user's available cards from inventory
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreateAuction={handleCreateAuction}
        userBalance={vaultBalance?.credits || 0}
      />
    </div>
  );
}
