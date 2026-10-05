/** Human labels for ledger `source` keys shown in the Vault's recent activity. */

const LABELS: Record<string, string> = {
  "bonus:new_player": "New player bonus",
  DAILY_DIVIDEND: "Daily nation dividend",
  DAILY_NATION_DIVIDEND: "Daily nation dividend",
  DAILY_LOGIN: "Daily reward",
  DAILY_LOGIN_CREDITS: "Daily reward",
  DAILY_LOGIN_CARD: "Daily reward card",
  P2P_TRADE: "Player trade",
  WALLET_SEED: "Starting balance",
  JUNK_CARDS: "Cards junked",
  PACK_PURCHASE: "Pack purchase",
  LORE_CARD_REQUEST: "Lore card request",
  SOCIAL_POST: "ThinkPages post",
  diplomatic_scenario: "Diplomatic scenario",
  embassy_established: "Embassy established",
  cultural_exchange_created: "Cultural exchange",
  nation_card_royalty: "Nation card royalty",
  card_sale_auction: "Card sold at auction",
  card_sale_buyout: "Card sold by buyout",
  card_purchase_buyout: "Card bought by buyout",
  auction_listing_fee: "Auction listing fee",
  auction_listing_fee_refund: "Auction listing fee refund",
  auction_fee_refund: "Auction fee refund",
  auction_bid_reserve: "Auction bid reserved",
  auction_bid_refund: "Auction bid refund",
};

const sentenceCase = (raw: string): string => {
  const plain = raw.replace(/[_:]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return plain.charAt(0).toUpperCase() + plain.slice(1);
};

export function activitySourceLabel(source: string): string {
  const key = source.replace(/^bonus:new player$/, "bonus:new_player");
  const known = LABELS[key];
  if (known) return known;
  if (key.startsWith("bonus:loreward")) return "Loreward bonus";
  if (key.startsWith("bonus:")) return `${sentenceCase(key.slice("bonus:".length))} bonus`;
  if (key.startsWith("exploit_correction:")) return "Balance correction";
  // Free-text sources ("Purchase item: Gold frame") are already readable.
  if (/^[A-Z][a-z]/.test(key) && /\s/.test(key)) return key;
  return sentenceCase(key);
}
