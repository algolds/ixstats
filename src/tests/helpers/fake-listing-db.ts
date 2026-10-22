/**
 * A fake database for fixed-price listing tests. `tx` holds every write and `db` only reads and runs `tx`. The listing
 * and copy claims honour their `where`, so a CAS that loses really loses, and a transaction that throws puts the
 * listing and the copy back as they were (a rollback).
 */
import type { CardFinish, CardListingStatus, CardType } from "@prisma/client";

export const NOW = new Date("2026-11-02T12:00:00Z");
export const DAY = 86_400_000;

type Row = { key: string; value: string };
/** The Economy tab as stored: fees of 7 and 13 IxC, a 40% refund and 10 listing days (none of them the defaults). */
export const ECONOMY: Row[] = [
  { key: "card_economy_listing_fee", value: "7" },
  { key: "card_economy_listing_fee_featured", value: "13" },
  { key: "card_economy_listing_refund_pct", value: "40" },
  { key: "card_economy_listing_days", value: "10" },
];

export interface CopyState {
  id: string;
  ownerId: string;
  cardId: string;
  serialNumber: number;
  finish: CardFinish;
  isLocked: boolean;
  cards: { isBound: boolean };
}

export interface ListingState {
  id: string;
  ownershipId: string | null;
  cardId: string;
  serialNumber: number;
  finish: CardFinish;
  sellerId: string;
  price: number;
  isFeatured: boolean;
  listingFee: number;
  status: CardListingStatus;
  expiresAt: Date;
  card: { title: string; cardType: CardType; countryId: string | null };
}

interface World {
  config: Row[];
  copy: CopyState | null;
  listing: ListingState | null;
}

/** A live listing of copy own_1, a Holo #4, while the copy itself reads Foil #9: the sale must use what was stored. */
export const listingOf = (over: Partial<ListingState> = {}): ListingState => ({
  id: "l1",
  ownershipId: "own_1",
  cardId: "card_1",
  serialNumber: 4,
  finish: "HOLO",
  sellerId: "seller",
  price: 500,
  isFeatured: false,
  listingFee: 10,
  status: "ACTIVE",
  expiresAt: new Date(NOW.getTime() + DAY),
  card: { title: "Aurelia", cardType: "NATION", countryId: "country_1" },
  ...over,
});

export const copyOf = (over: Partial<CopyState> = {}): CopyState => ({
  id: "own_1",
  ownerId: "seller",
  cardId: "card_1",
  serialNumber: 9,
  finish: "FOIL",
  isLocked: false,
  cards: { isBound: false },
  ...over,
});

interface ListingClaim {
  id: string;
  status: CardListingStatus;
  expiresAt?: { gt?: Date; lte?: Date };
}

interface CopyClaim {
  id: string;
  ownerId?: string;
  isLocked?: boolean;
}

/** Whether the listing as it stands matches a claim's `where`. */
function listingMatches(listing: ListingState | null, where: ListingClaim): boolean {
  if (!listing || listing.id !== where.id || listing.status !== where.status) return false;
  const end = where.expiresAt;
  if (end?.gt && !(listing.expiresAt > end.gt)) return false;
  return !(end?.lte && !(listing.expiresAt <= end.lte));
}

function copyMatches(copy: CopyState | null, where: CopyClaim): boolean {
  if (!copy || copy.id !== where.id) return false;
  if (where.ownerId !== undefined && copy.ownerId !== where.ownerId) return false;
  return where.isLocked === undefined || copy.isLocked === where.isLocked;
}

export function makeListingDb(over: Partial<World> = {}) {
  const world: World = {
    config: ECONOMY,
    copy: copyOf({ isLocked: true }),
    listing: listingOf(),
    ...over,
  };
  const systemConfig = { findMany: jest.fn(async () => world.config) };
  const tx = {
    systemConfig,
    // The seller's vault lock (lockVaultsTx)
    $queryRaw: jest.fn(async () => []),
    cardOwnership: {
      findFirst: jest.fn(async ({ where }: { where: CopyClaim }) =>
        copyMatches(world.copy, where) && world.copy ? { ...world.copy } : null
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: CopyClaim; data: { isLocked: boolean } }) => {
          if (!copyMatches(world.copy, where) || !world.copy) return { count: 0 };
          world.copy.isLocked = data.isLocked;
          return { count: 1 };
        }
      ),
    },
    cardListing: {
      create: jest.fn(async ({ data }: { data: Omit<ListingState, "id" | "status" | "card"> }) => {
        world.listing = { ...listingOf(), ...data, id: "l_new", status: "ACTIVE" };
        return { ...world.listing };
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: ListingClaim; data: { status: CardListingStatus } }) => {
          if (!listingMatches(world.listing, where) || !world.listing) return { count: 0 };
          world.listing.status = data.status;
          return { count: 1 };
        }
      ),
    },
  };
  const db = {
    systemConfig,
    cardListing: {
      findUnique: jest.fn(async () => (world.listing ? { ...world.listing } : null)),
      findMany: jest.fn(async () => (world.listing ? [{ ...world.listing }] : [])),
    },
    $transaction: jest.fn(async <T>(work: (client: typeof tx) => Promise<T>) => {
      const before = structuredClone({ copy: world.copy, listing: world.listing });
      try {
        return await work(tx);
      } catch (error) {
        world.copy = before.copy;
        world.listing = before.listing;
        throw error;
      }
    }),
  };
  return { db, tx, world };
}
