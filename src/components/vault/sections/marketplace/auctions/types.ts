export interface MarketAuctionItem {
  id: string;
  sellerId: string;
  startingPrice: number;
  currentBid: number;
  buyoutPrice: number | null;
  endTime: Date | string;
  status: string;
  bidCount?: number;
  participation?: string;
  finalPrice?: number | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  CardOwnership?: {
    id: string;
    cards: {
      id: string;
      title: string;
      rarity: string;
      cardType: string;
      artwork: string;
      season: number;
      wikiSource?: string | null;
      description?: string | null;
      marketValue?: number | null;
      totalSupply?: number | null;
      country?: { id: string; name: string } | null;
    };
  };
  AuctionBid?: Array<{
    id: string;
    amount: number;
    bidderId: string;
    createdAt: Date | string;
  }>;
}
