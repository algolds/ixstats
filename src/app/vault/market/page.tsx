"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Plus, ShoppingCart } from "lucide-react";

// TODO: These will be replaced with components from Agent 3
// For now, create placeholder components

function MarketBrowser({ filter }: { filter: string }) {
  return (
    <Card className="glass-hierarchy-child">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <ShoppingCart className="mb-4 h-16 w-16 text-muted-foreground" />
        <p className="mb-2 text-lg font-semibold">Market Browser Component</p>
        <p className="text-sm text-muted-foreground">
          This will be the {filter} marketplace browser from Agent 3
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Will include: card listings, filters, sorting, real-time updates
        </p>
      </CardContent>
    </Card>
  );
}

function CreateAuctionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <Card className="glass-hierarchy-modal max-w-2xl">
        <CardContent className="p-8">
          <h2 className="mb-4 text-2xl font-bold">Create Auction</h2>
          <p className="mb-4">This will be the auction creation modal from Agent 3</p>
          <Button onClick={onClose}>Close</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MarketPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gold-400">Card Market</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Buy and sell cards with other players
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-gradient-to-r from-gold-500 to-orange-500 font-semibold text-black hover:scale-105 active:scale-95 touch-manipulation text-sm sm:text-base"
        >
          <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Create Auction
        </Button>
      </div>

      {/* Market tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass-hierarchy-child grid w-full grid-cols-3">
          <TabsTrigger value="active">Active Auctions</TabsTrigger>
          <TabsTrigger value="bids">My Bids</TabsTrigger>
          <TabsTrigger value="listings">My Listings</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <MarketBrowser filter="active" />
        </TabsContent>

        <TabsContent value="bids" className="mt-6">
          <MarketBrowser filter="my-bids" />
        </TabsContent>

        <TabsContent value="listings" className="mt-6">
          <MarketBrowser filter="my-listings" />
        </TabsContent>
      </Tabs>

      {/* Create auction modal */}
      <CreateAuctionModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
