// scripts/cards/backfill-cards-refresh-types.ts
/**
 * The cards refresh backfill's shapes (docs/specs/2026-10-15-cards-refresh-design.md §5.5 step 3): the snapshot of the
 * pre-refresh tables, the plan of writes, the dry-run report, and the writer and IO that backfill-cards-refresh.ts
 * implements with raw SQL. backfill-cards-refresh-plan.ts computes them.
 */
import type { Prisma } from "@prisma/client";
import type { CardFinish, CardRarity, CardType } from "~/lib/cards/enums";
import type { LedgerRow, LegacyTransfer, RealmPageRow } from "~/lib/cards/legacy-mapping";

export type Json = Prisma.JsonValue | null;

export interface SnapshotCard {
  id: string;
  cardType: string;
  rarity: string;
  category: string | null;
  title: string;
  wikiSource: string | null;
  wikiArticleTitle: string | null;
  countryId: string | null;
  lorewardEntryId: string | null;
  nsCardId: number | null;
  nsSeason: number | null;
  season: number;
  realmId: string | null;
  isBound: boolean;
  artwork: string | null;
  artworkUrl: string | null;
  metadata: Json;
  stats: Json;
  nsData: Json;
  createdAt: Date;
}

export interface SnapshotCopy {
  id: string;
  cardId: string;
  ownerId: string;
  serialNumber: number;
  acquiredAt: Date;
  finish: CardFinish;
}

export interface SnapshotPack {
  id: string;
  cardType: string | null;
  themeFilter: Json;
  guaranteedRarity: string | null;
  season: number | null;
}

export interface BackfillSnapshot {
  realms: Array<{ id: string; slug: string; isSystem: boolean }>;
  cards: SnapshotCard[];
  copies: SnapshotCopy[];
  packs: SnapshotPack[];
  realmPages: RealmPageRow[];
  countries: Array<{ id: string; realmId: string }>;
  transfers: LegacyTransfer[];
  verifications: Array<{ userId: string; nationName: string }>;
  ledger: Array<{ nsCardId: number; nsSeason: number; nation: string }>;
  requestSuggestedRarities: string[];
  requestNsImportCategories: number;
}

export interface PlanOptions {
  nsPremium: number;
  floor: (rarity: CardRarity) => number;
}

export interface RealmInsert {
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
}

export interface CardPatch {
  id: string;
  cardType?: CardType;
  rarity?: CardRarity;
  realmId?: string;
  category?: string | null;
  isBound?: boolean;
  metadata?: Json;
  artwork?: string;
  wikiArticleTitle?: string;
}

export interface PackPatch {
  id: string;
  cardType?: CardType;
  themeFilter?: Json;
  guaranteedRarity?: CardRarity;
}

export interface CopyPatch {
  id: string;
  cardId?: string;
  serialNumber?: number;
  finish?: CardFinish;
}

export interface CardMerge {
  survivorId: string;
  loserIds: string[];
}

export interface BackfillPlan {
  realms: RealmInsert[];
  cards: CardPatch[];
  packs: PackPatch[];
  copies: CopyPatch[];
  ledger: LedgerRow[];
  clearRequestCategories: boolean;
  merges: CardMerge[];
}

/** A pack that filters by card type: how many cards its type, season and theme types match, before and after. */
export interface PackPool {
  id: string;
  cardType: CardType | null;
  season: number | null;
  before: number;
  after: number;
}

export interface BackfillReport {
  realmsSeeded: string[];
  typeChanges: Record<string, number>;
  rarityChanges: Record<string, number>;
  realmAssignments: Record<string, number>;
  commonsCards: Array<{ id: string; title: string }>;
  categories: string[];
  packCardTypes: string[];
  /** Type-filtered packs' pools (never Special or Trophy cards): a pool that empties is a pack that cannot open. */
  packPools: PackPool[];
  suggestedRarities: string[];
  otherWikiSources: string[];
  /** Copies of Mythic and Divine cards, now Legendary Holo: each is worth 9× in Phase 4 dust. */
  holoCopies: number;
  serialisedCopies: number;
  /** NS cards whose bank value × the NS premium is above their floor: they keep the NS term until they first sell. */
  nsTermCards: {
    count: number;
    sample: Array<{ id: string; title: string; bankValue: number; floor: number }>;
  };
  ledgerRows: number;
  unattributedImports: number;
  /** Imported NS copies whose owner was taken as importer (no trade giver); auction buyers among them are misread. */
  ownerInferredImports: number;
  mergeGroups: Array<{ key: string; survivorId: string; loserIds: string[]; copiesMoved: number }>;
  serialRenumbers: Array<{ ownershipId: string; cardId: string; from: number; to: number }>;
  requestCategoriesCleared: number;
  artworkCopied: number;
}

export interface PlanResult {
  plan: BackfillPlan;
  report: BackfillReport;
  errors: string[];
}

/** The backfill's writes against the database, all inside one transaction (backfill-cards-refresh.ts). */
export interface BackfillWriter {
  insertRealms(rows: RealmInsert[]): Promise<void>;
  updateCards(patches: CardPatch[]): Promise<void>;
  updatePacks(patches: PackPatch[]): Promise<void>;
  updateCopies(patches: CopyPatch[]): Promise<void>;
  insertLedger(rows: LedgerRow[]): Promise<void>;
  clearRequestCategories(): Promise<void>;
  /** Re-points the losers' value history, watchlist rows and lore requests to the survivor, then deletes them. */
  mergeCards(merge: CardMerge): Promise<void>;
}

export interface BackfillIo {
  load(): Promise<BackfillSnapshot>;
  options(): Promise<PlanOptions>;
  /** Runs `apply` inside one database transaction. */
  write(apply: (writer: BackfillWriter) => Promise<void>): Promise<void>;
}
