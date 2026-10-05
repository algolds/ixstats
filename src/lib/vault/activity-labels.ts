import { sentenceCase } from "~/lib/format/sentence-case";

/** Human labels for ledger `source` keys shown in the Vault's recent activity. Only keys whose label differs from the sentence-cased key; the rest fall through. */
const LABELS: Record<string, string> = {
  DAILY_DIVIDEND: "Daily nation dividend",
  DAILY_LOGIN: "Daily reward",
  DAILY_LOGIN_CREDITS: "Daily reward",
  DAILY_LOGIN_CARD: "Daily reward card",
  P2P_TRADE: "Player trade",
  WALLET_SEED: "Starting balance",
  JUNK_CARDS: "Cards junked",
  SOCIAL_POST: "ThinkPages post",
  cultural_exchange_created: "Cultural exchange",
  card_sale_auction: "Card sold at auction",
  card_sale_buyout: "Card sold by buyout",
  card_purchase_buyout: "Card bought by buyout",
  auction_bid_reserve: "Auction bid reserved",
};

export function activitySourceLabel(key: string): string {
  const known = LABELS[key];
  if (known) return known;
  if (key.startsWith("bonus:loreward")) return "Loreward bonus";
  if (key.startsWith("bonus:")) return `${sentenceCase(key.slice("bonus:".length))} bonus`;
  if (key.startsWith("exploit_correction:")) return "Balance correction";
  // Free-text sources ("Purchase item: Gold frame") are already readable.
  if (/^[A-Z][a-z]/.test(key) && /\s/.test(key)) return key;
  return sentenceCase(key);
}
