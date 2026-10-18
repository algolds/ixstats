/**
 * A fake database for the card workshop (breaking down and fusing copies). `tx` holds every write; `db` only reads the
 * Economy tab and runs `tx`. Copy reads honour `select` (a column left out stays out), the burn's DELETE and the
 * fusion's upgrade honour their `where` (a CAS that loses really loses), the dust statement keeps a balance inside its
 * Int column as Postgres runs it, and a transaction that throws puts every table back as it was (a rollback).
 */
import type { CardFinish, CardRarity } from "@prisma/client";

/** A copy row (a type, not an interface, so it reads as a plain row). */
export type FakeCopy = {
  id: string;
  ownerId: string;
  cardId: string;
  serialNumber: number;
  finish: CardFinish;
  isLocked: boolean;
  inscription: string | null;
  inscribedById: string | null;
  inscribedName: string | null;
  importDiscounted: boolean;
  level: number;
  cards: { rarity: CardRarity; realmId: string; isBound: boolean };
};

export interface FakeOffer {
  status: string;
  initiatorCardIds: string[];
  recipientCardIds: string[];
}

export interface FakeTransferEvent {
  ownershipId: string | null;
  cardId: string | null;
  serialNumber: number | null;
  finish?: CardFinish | null;
  fromUserId?: string | null;
  toUserId?: string | null;
  action: string;
  price?: number | null;
}

export interface FakeDustEvent {
  userId: string;
  realmId: string;
  delta: number;
  balanceAfter: number;
  source: string;
  cardId: string | null;
  ownershipId?: string | null;
}

export interface WorkshopWorld {
  config: Array<{ key: string; value: string }>;
  copies: FakeCopy[];
  offers: FakeOffer[];
  events: FakeTransferEvent[];
  /** Dust per `userId:realmId`. */
  balances: Record<string, number>;
  dustEvents: FakeDustEvent[];
  /** Advisory locks taken, as `namespace:key`, in order. */
  locks: string[];
}

/** A Standard Rare copy of card c1 (realm "default"), unlocked and unsigned, held by u1. */
export const copyOf = (id: string, over: Partial<FakeCopy> = {}): FakeCopy => ({
  id,
  ownerId: "u1",
  cardId: "c1",
  serialNumber: 1,
  finish: "STANDARD",
  isLocked: false,
  inscription: null,
  inscribedById: null,
  inscribedName: null,
  importDiscounted: false,
  level: 1,
  cards: { rarity: "RARE", realmId: "default", isBound: false },
  ...over,
});

type Select = { [key: string]: boolean | { select: Select } };
type Row = { [key: string]: string | number | boolean | null | Row };

/** The row as Prisma returns it for `select`: only the columns asked for, relations included. */
function project(row: Row, select: Select): Row {
  const out: Row = {};
  for (const [key, pick] of Object.entries(select)) {
    const value = row[key];
    if (pick === true && value !== undefined) out[key] = value;
    else if (typeof pick === "object" && value && typeof value === "object") {
      out[key] = project(value, pick.select);
    }
  }
  return out;
}

export interface CopyWhere {
  id?: string | { in: string[] };
  ownerId?: string;
  cardId?: string;
  finish?: CardFinish;
  isLocked?: boolean;
  inscription?: null;
  importDiscounted?: boolean;
  OR?: CopyWhere[];
}

/** Whether a copy as it stands matches a `where`, as Postgres reads it (an empty OR matches nothing). */
function copyMatches(copy: FakeCopy, where: CopyWhere): boolean {
  const { id, OR, inscription, ...columns } = where;
  if (typeof id === "string" && copy.id !== id) return false;
  if (typeof id === "object" && !id.in.includes(copy.id)) return false;
  if (inscription === null && copy.inscription !== null) return false;
  if (OR && !OR.some((branch) => copyMatches(copy, branch))) return false;
  return Object.entries(columns).every(
    ([key, value]) => copy[key as keyof typeof columns] === value
  );
}

type Order = { serialNumber?: "asc" } | { id?: "asc" };

function byOrder(order: Order[]) {
  return (a: FakeCopy, b: FakeCopy) => {
    for (const step of order) {
      if ("serialNumber" in step && a.serialNumber !== b.serialNumber) {
        return a.serialNumber - b.serialNumber;
      }
      if ("id" in step && a.id !== b.id) return a.id < b.id ? -1 : 1;
    }
    return 0;
  };
}

interface OfferWhere {
  status: string;
  OR: Array<{
    initiatorCardIds?: { array_contains: string[] };
    recipientCardIds?: { array_contains: string[] };
  }>;
}

const offerMatches = (offer: FakeOffer, where: OfferWhere) =>
  offer.status === where.status &&
  where.OR.some(
    (branch) =>
      (branch.initiatorCardIds?.array_contains.every((id) => offer.initiatorCardIds.includes(id)) ??
        false) ||
      (branch.recipientCardIds?.array_contains.every((id) => offer.recipientCardIds.includes(id)) ??
        false)
  );

type Value = string | number;

export function makeWorkshopDb(over: Partial<WorkshopWorld> = {}) {
  const world: WorkshopWorld = {
    config: [],
    copies: [],
    offers: [],
    events: [],
    balances: {},
    dustEvents: [],
    locks: [],
    ...over,
  };
  const systemConfig = { findMany: jest.fn(async () => world.config) };
  const tx = {
    systemConfig,
    $executeRaw: jest.fn(async (_sql: TemplateStringsArray, ...values: Value[]) => {
      world.locks.push(values.join(":"));
      return 1;
    }),
    /**
     * The dust statement: insert the balance, or add to it only while the stored balance is at most the limit it
     * passes (its WHERE), returning the new balance; a refused add returns no row.
     */
    $queryRaw: jest.fn(async (sql: TemplateStringsArray, ...values: Value[]) => {
      if (!sql.join("?").includes("card_dust_balances")) throw new Error("unexpected raw query");
      const [userId, realmId, total, limit] = values as [string, string, number, number];
      const key = `${userId}:${realmId}`;
      const held = world.balances[key];
      if (held !== undefined && held > limit) return [];
      world.balances[key] = (held ?? 0) + total;
      return [{ balance: world.balances[key] }];
    }),
    cardOwnership: {
      findMany: jest.fn(async (args: { where: CopyWhere; select: Select; orderBy: Order[] }) =>
        world.copies
          .filter((c) => copyMatches(c, args.where))
          .sort(byOrder(args.orderBy))
          .map((c) => project(structuredClone(c), args.select))
      ),
      deleteMany: jest.fn(async ({ where }: { where: CopyWhere }) => {
        const gone = world.copies.filter((c) => copyMatches(c, where));
        world.copies = world.copies.filter((c) => !gone.includes(c));
        // ON DELETE SET NULL on the trail
        for (const event of world.events) {
          if (gone.some((c) => c.id === event.ownershipId)) event.ownershipId = null;
        }
        return { count: gone.length };
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: CopyWhere; data: Partial<FakeCopy> }) => {
          const hit = world.copies.filter((c) => copyMatches(c, where));
          for (const copy of hit) Object.assign(copy, data);
          return { count: hit.length };
        }
      ),
    },
    tradeOffer: {
      count: jest.fn(
        async ({ where }: { where: OfferWhere }) =>
          world.offers.filter((o) => offerMatches(o, where)).length
      ),
    },
    cardTransferEvent: {
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { ownershipId: string; cardId: null };
          data: { cardId: string; serialNumber: number };
        }) => {
          const legacy = world.events.filter(
            (e) => e.ownershipId === where.ownershipId && e.cardId === null
          );
          for (const event of legacy) Object.assign(event, data);
          return { count: legacy.length };
        }
      ),
      createMany: jest.fn(async ({ data }: { data: FakeTransferEvent[] }) => {
        world.events.push(...data.map((e) => ({ ...e })));
        return { count: data.length };
      }),
      create: jest.fn(async ({ data }: { data: FakeTransferEvent }) => {
        world.events.push({ ...data });
        return data;
      }),
    },
    cardDustBalance: {
      findUnique: jest.fn(
        async ({ where }: { where: { userId_realmId: { userId: string; realmId: string } } }) => {
          const { userId, realmId } = where.userId_realmId;
          const held = world.balances[`${userId}:${realmId}`];
          return held === undefined ? null : { balance: held };
        }
      ),
    },
    cardDustEvent: {
      createMany: jest.fn(async ({ data }: { data: FakeDustEvent[] }) => {
        world.dustEvents.push(...data.map((e) => ({ ...e })));
        return { count: data.length };
      }),
    },
  };
  const db = {
    systemConfig,
    $transaction: jest.fn(async <T>(work: (client: typeof tx) => Promise<T>) => {
      const before = structuredClone(world);
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(world, before);
        throw error;
      }
    }),
  };
  return { db, tx, world };
}
