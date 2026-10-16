// src/lib/cards/legacy-mapping.ts
/**
 * The cards refresh's legacy mapping (docs/specs/2026-10-15-cards-refresh-design.md §5.3): how every pre-refresh
 * card, pack and copy maps onto the new model. Pure; scripts/cards/backfill-cards-refresh.ts runs it, and new cards
 * use its title and realm rules. It is the one file under src/ that may name the retired type and rarity values.
 */
import type { Prisma } from "@prisma/client";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import {
  ALTHISTORY_REALM_ID,
  DEFAULT_REALM_ID,
  IIWIKI_REALM_ID,
  NS_REALM_ID,
} from "~/lib/realms/realm-ids";
import { SPORTS_TROPHY_TITLE } from "~/lib/sports/trophy-titles";
import { CardFinish, CardRarity, CardType, parseCardRarity } from "./enums";
import { pickNsFacts, type NsFacts } from "./ns-facts";

/** The pre-refresh type of Commons flag cards (they become Lore cards in Ixnay; the dry run lists them). */
export const COMMONS_LEGACY_TYPE = "COMMONS_IMPORT";

/** Every type string and its new type. The new values map to themselves, so a re-run changes nothing. */
const TYPE_TABLE: Readonly<Record<string, CardType>> = {
  LORE: CardType.LORE,
  LORE_BATCH: CardType.LORE,
  WIKI_LORE: CardType.LORE,
  [COMMONS_LEGACY_TYPE]: CardType.LORE,
  USER_CUSTOM: CardType.LORE,
  NS_IMPORT: CardType.NS,
  NS: CardType.NS,
  NATION: CardType.NATION,
  SPECIAL: CardType.SPECIAL,
  TROPHY: CardType.TROPHY,
};

/** A card's or a pack's type string as the new enum; null for a value the table does not know. */
export function mapTypeString(value: string): CardType | null {
  return TYPE_TABLE[value.trim().toUpperCase()] ?? null;
}

export interface LegacyTypeInput {
  cardType: string;
  lorewardEntryId: string | null;
  title: string;
}

/**
 * A card's new type. A card with a Loreward entry is a Trophy whatever its type, and so is a Special card a sports
 * championship minted (its title template). Null for an unknown type: the dry run fails on it.
 */
export function mapCardType(card: LegacyTypeInput): CardType | null {
  if (card.lorewardEntryId) return CardType.TROPHY;
  const type = mapTypeString(card.cardType);
  if (type === CardType.SPECIAL && SPORTS_TROPHY_TITLE.test(card.title)) return CardType.TROPHY;
  return type;
}

const RETIRED_TOP_TIERS: ReadonlySet<string> = new Set(["MYTHIC", "DIVINE"]);

export interface MappedRarity {
  rarity: CardRarity;
  /** Was Mythic or Divine: its copies become Holo. */
  retiredTopTier: boolean;
}

/** A rarity string as the enum (any casing, "ultra-rare" normalised); Mythic and Divine fold into Legendary. */
export function mapRarity(value: string): MappedRarity | null {
  const key = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (RETIRED_TOP_TIERS.has(key)) return { rarity: CardRarity.LEGENDARY, retiredTopTier: true };
  const rarity = parseCardRarity(key);
  return rarity ? { rarity, retiredTopTier: false } : null;
}

/** A copy's finish: trophies Serialised, retired Mythic and Divine copies Holo, every other copy unchanged. */
export function finishFor(input: {
  type: CardType;
  retiredTopTier: boolean;
  current: CardFinish;
}): CardFinish {
  if (input.type === CardType.TROPHY) return CardFinish.SERIALISED;
  if (input.retiredTopTier) return CardFinish.HOLO;
  return input.current;
}

/** No category for NS cards (their automatic sets go by NS season) and none for the retired NS_IMPORT bucket. */
export function categoryFor(input: { type: CardType; category: string | null }): string | null {
  if (input.type === CardType.NS || input.category === "NS_IMPORT") return null;
  return input.category;
}

/** Bound (§2.1): trophies and the achievement reward cards. A card already bound stays bound. */
export function boundFor(
  card: { id: string; type: CardType; isBound: boolean },
  achievementCardIds: ReadonlySet<string>
): boolean {
  return card.isBound || card.type === CardType.TROPHY || achievementCardIds.has(card.id);
}

const WIKI_REALMS: Readonly<Record<string, string>> = {
  ixwiki: DEFAULT_REALM_ID,
  iiwiki: IIWIKI_REALM_ID,
  althistory: ALTHISTORY_REALM_ID,
};

/** A wiki source as the realm sources key it: lower case, "ixwiki" when unset. */
export function wikiSourceKey(source: string | null | undefined): string {
  return source?.trim().toLowerCase() || "ixwiki";
}

/** Where a wiki's cards live when no realm imported their page: IxWiki (and any other wiki) Ixnay. */
export function wikiFallbackRealm(source: string | null | undefined): string {
  return WIKI_REALMS[wikiSourceKey(source)] ?? DEFAULT_REALM_ID;
}

/** A page title in MediaWiki's canonical form; the trimmed title when MediaWiki would refuse it. */
export function canonicalArticleTitle(title: string, source: string | null | undefined): string {
  const canonical = canonicalizeTitle(title, { source: wikiSourceKey(source) });
  return canonical?.title ?? title.replace(/_/g, " ").trim();
}

/** One article's key everywhere (the Lore natural key, the RealmPage match): its wiki and lower-cased canonical title. */
export function articleKey(source: string | null | undefined, title: string): string {
  return `${wikiSourceKey(source)}:${canonicalArticleTitle(title, source).toLowerCase()}`;
}

export interface RealmPageRow {
  realmId: string;
  wikiSource: string;
  title: string;
  importedAt: Date;
}

/** Each article's realm: the realm that imported its page earliest. */
export function earliestRealmByArticle(pages: readonly RealmPageRow[]): Map<string, string> {
  const sorted = [...pages].sort(
    (a, b) => a.importedAt.getTime() - b.importedAt.getTime() || a.realmId.localeCompare(b.realmId)
  );
  const byArticle = new Map<string, string>();
  for (const page of sorted) {
    const key = articleKey(page.wikiSource, page.title);
    if (!byArticle.has(key)) byArticle.set(key, page.realmId);
  }
  return byArticle;
}

export interface HomeRealmInput {
  type: CardType;
  countryId: string | null;
  wikiSource: string | null;
  wikiArticleTitle: string | null;
  title: string;
}

export interface HomeRealmLookups {
  countryRealm: ReadonlyMap<string, string>;
  articleRealm: ReadonlyMap<string, string>;
}

/** A card's home realm (§5.3), kept forever. */
export function homeRealmFor(card: HomeRealmInput, lookups: HomeRealmLookups): string {
  if (card.type === CardType.NS) return NS_REALM_ID;
  if (card.type === CardType.SPECIAL) return DEFAULT_REALM_ID;
  if (card.type === CardType.NATION) {
    return (card.countryId && lookups.countryRealm.get(card.countryId)) || DEFAULT_REALM_ID;
  }
  const key = articleKey(card.wikiSource, card.wikiArticleTitle ?? card.title);
  return lookups.articleRealm.get(key) ?? wikiFallbackRealm(card.wikiSource);
}

const isJsonObject = (value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * An NS card's facts from its three pre-refresh homes: `stats` (kept freshest by the value refreshes), then
 * `metadata.nsData`, then the `nsData` column; the card's own NS id and season fill any gap.
 */
export function legacyNsFacts(card: {
  stats: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  nsData: Prisma.JsonValue | null;
  nsCardId: number | null;
  nsSeason: number | null;
}): NsFacts {
  const stats = isJsonObject(card.stats)
    ? {
        region: card.stats.region,
        category: card.stats.category,
        market_value: card.stats.marketValue,
      }
    : null;
  const metaFacts = isJsonObject(card.metadata) ? card.metadata.nsData : null;
  const own = {
    id: card.nsCardId === null ? null : String(card.nsCardId),
    season: card.nsSeason === null ? null : String(card.nsSeason),
  };
  return pickNsFacts(stats, metaFacts, card.nsData, own);
}

/** `metadata` without the computed stats (§5.2: `loreStats` and the legacy `stats` copy); the same object otherwise. */
export function withoutStatKeys(metadata: Prisma.JsonValue | null): Prisma.JsonValue | null {
  if (!isJsonObject(metadata) || !("loreStats" in metadata || "stats" in metadata)) return metadata;
  const { loreStats: _loreStats, stats: _stats, ...rest } = metadata;
  return rest;
}

export interface SystemRealmRow {
  id: string;
  slug: string;
  name: string;
  description: string;
}

/** The owner id Ixnay and the system realms carry; site admins act as their owner (§3). */
export const SYSTEM_REALM_OWNER_ID = "system";

/** The system realms the backfill seeds (§5.1): public, active, `isSystem` set. */
export const SYSTEM_REALMS: readonly SystemRealmRow[] = [
  {
    id: NS_REALM_ID,
    slug: NS_REALM_ID,
    name: "NationStates",
    description: "Trading cards of NationStates nations.",
  },
  {
    id: IIWIKI_REALM_ID,
    slug: IIWIKI_REALM_ID,
    name: "IIWiki",
    description: "Lore cards from IIWiki articles that no realm has imported.",
  },
  {
    id: ALTHISTORY_REALM_ID,
    slug: ALTHISTORY_REALM_ID,
    name: "AltHistory",
    description: "Lore cards from AltHistory articles that no realm has imported.",
  },
];

export interface MergeCard {
  id: string;
  type: CardType;
  wikiSource: string | null;
  wikiArticleTitle: string | null;
  createdAt: Date;
  copies: number;
}

export interface LoreMergeGroup {
  key: string;
  survivorId: string;
  loserIds: string[];
}

const bySurvivorOrder = (a: MergeCard, b: MergeCard) =>
  b.copies - a.copies || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

/** Duplicate Lore cards (one wiki, one canonical title). The survivor has the most copies, then is the oldest. */
export function loreMergeGroups(cards: readonly MergeCard[]): LoreMergeGroup[] {
  const byKey = new Map<string, MergeCard[]>();
  for (const card of cards) {
    if (card.type !== CardType.LORE || !card.wikiArticleTitle) continue;
    const key = articleKey(card.wikiSource, card.wikiArticleTitle);
    const group = byKey.get(key);
    if (group) group.push(card);
    else byKey.set(key, [card]);
  }
  const groups: LoreMergeGroup[] = [];
  for (const [key, group] of byKey) {
    const [survivor, ...losers] = [...group].sort(bySurvivorOrder);
    if (survivor && losers.length > 0) {
      groups.push({ key, survivorId: survivor.id, loserIds: losers.map((card) => card.id) });
    }
  }
  return groups;
}

export interface LegacyCopy {
  id: string;
  cardId: string;
  ownerId: string;
  serialNumber: number;
  acquiredAt: Date;
}

const byAcquisition = (a: LegacyCopy, b: LegacyCopy) =>
  a.acquiredAt.getTime() - b.acquiredAt.getTime() || a.id.localeCompare(b.id);

/** Copies moving onto a survivor, numbered after its highest serial in the order they were acquired. */
export function renumberOnto(
  survivorMaxSerial: number,
  moving: readonly LegacyCopy[]
): Array<{ id: string; serialNumber: number }> {
  return [...moving]
    .sort(byAcquisition)
    .map((copy, index) => ({ id: copy.id, serialNumber: survivorMaxSerial + index + 1 }));
}

/** One card's serial collisions: the earliest acquired keeps the number, later ones move past the highest serial. */
export function renumberCollisions(
  copies: readonly LegacyCopy[]
): Array<{ id: string; serialNumber: number }> {
  let next = Math.max(0, ...copies.map((copy) => copy.serialNumber));
  const taken = new Set<number>();
  const moves: Array<{ id: string; serialNumber: number }> = [];
  for (const copy of [...copies].sort(byAcquisition)) {
    if (!taken.has(copy.serialNumber)) {
      taken.add(copy.serialNumber);
      continue;
    }
    next += 1;
    moves.push({ id: copy.id, serialNumber: next });
  }
  return moves;
}

export interface LegacyTransfer {
  ownershipId: string;
  action: string;
  fromUserId: string | null;
  createdAt: Date;
}

export interface LedgerRow {
  nsCardId: number;
  nsSeason: number;
  nation: string;
  userId: string | null;
  ownershipId: string | null;
}

export const ledgerKey = (row: { nsCardId: number; nsSeason: number; nation: string }) =>
  `${row.nsCardId}:${row.nsSeason}:${row.nation}`;

const MINTED_BY_PACK_OR_DAILY: ReadonlySet<string> = new Set(["PACK_OPEN", "DAILY_CLAIM"]);

/**
 * The import ledger for existing NS copies (§5.5 step 3.7). A copy came from a deck import when no pack or daily
 * claim minted it; its importer is the giver of its first trade, else its owner; it is recorded against every nation
 * that importer verified. A copy whose importer verified none is counted as unattributed.
 */
export function inferImportLedger(input: {
  copies: ReadonlyArray<LegacyCopy & { nsCardId: number; nsSeason: number }>;
  transfers: readonly LegacyTransfer[];
  verifiedNations: ReadonlyMap<string, readonly string[]>;
  existing: ReadonlySet<string>;
}): { rows: LedgerRow[]; unattributed: number } {
  const events = new Map<string, LegacyTransfer[]>();
  for (const transfer of [...input.transfers].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )) {
    events.set(transfer.ownershipId, [...(events.get(transfer.ownershipId) ?? []), transfer]);
  }
  const seen = new Set(input.existing);
  const rows: LedgerRow[] = [];
  let unattributed = 0;
  for (const copy of input.copies) {
    const trail = events.get(copy.id) ?? [];
    if (trail.some((event) => MINTED_BY_PACK_OR_DAILY.has(event.action))) continue;
    const importer = trail.find((event) => event.action === "TRADE")?.fromUserId ?? copy.ownerId;
    const nations = input.verifiedNations.get(importer) ?? [];
    if (nations.length === 0) unattributed += 1;
    for (const nation of nations) {
      const row = {
        nsCardId: copy.nsCardId,
        nsSeason: copy.nsSeason,
        nation,
        userId: importer,
        ownershipId: copy.id,
      };
      if (seen.has(ledgerKey(row))) continue;
      seen.add(ledgerKey(row));
      rows.push(row);
    }
  }
  return { rows, unattributed };
}
