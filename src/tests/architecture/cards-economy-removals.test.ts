/** @jest-environment node */
/**
 * Cards refresh Phase 4 (the economy): the paths it replaced stay gone. One value cron, one royalty rule, one trade
 * table edited in place, real-time auctions of 24 hours to 7 days, and no rarity fallback in a pack's pool.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

const REMOVED_FILES = [
  "src/lib/lorewards/card-value-cron.ts",
  "src/components/cards/trading/TradeOfferModal.tsx",
  "src/components/cards/trading/TradeNegotiation.tsx",
  "src/lib/cards/ownership-card.ts",
  "src/server/api/routers/trading/social.ts",
];

const REMOVED_NAMES = [
  /\bpayNationRoyalty\b/,
  /\brecomputeAllCardValues\b/,
  /\bgetCardMarketValue\b/,
  /\bgetCardTransferHistory\b/,
  /\btransferCreditsTx\b/,
  /\bcounterOfferFromId\b/,
  /\bpickRandomCard\b/,
  /\bfallbackTiers\b/,
  /\bblankUnseenArt\b/,
  /Inscribed cards cannot be traded/,
  /\bTradeOfferModal\b/,
  /\bTradeNegotiation\b/,
  /\bgetActiveAuctions\b/,
  /\bgetMyCards\b/,
  /\bsearchTradingPartners\b/,
  /\btradeView\b/,
  /\bCOPY_VALUE_SQL\b/,
  /\bTradeStatus\b/,
  /\bDAILY_POOL\b/,
  /type Duration = "30" \| "60"/,
  /duration: 30 \| 60/,
  /"30 minutes \(Express\)"/,
  /marketValue: price\b/,
  /earliest human puller/,
];

/**
 * Every source outside `src/tests`: the tests that pin these absences (card-market-router.test.ts asserts that
 * getActiveAuctions and getCardTransferHistory are gone, the SQL tests that the columns and enums are dropped) name
 * them on purpose, as the Phase 3 ratchet leaves its tests out too.
 */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === join(SRC, "tests") ? [] : walk(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const sources = walk(SRC).map((file) => ({
  file: relative(ROOT, file),
  text: readFileSync(file, "utf8"),
}));

describe("cards economy removals", () => {
  it.each(REMOVED_FILES)("%s does not exist", (file) => {
    expect(existsSync(join(ROOT, file))).toBe(false);
  });

  it("no source names a replaced function or the old rules", () => {
    const hits = sources.flatMap(({ file, text }) =>
      REMOVED_NAMES.filter((name) => name.test(text)).map((name) => `${file}: ${name}`)
    );
    expect(hits).toEqual([]);
  });

  it("Card.marketValue is written in bulk only by the market-values module", () => {
    const writers = sources.filter(({ text }) => /UPDATE cards c SET "marketValue"/.test(text));
    expect(writers.map(({ file }) => file)).toEqual(["src/server/modules/cards/market-values.ts"]);
  });
});
