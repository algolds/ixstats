/**
 * Shared doubles for the trade service suites (offers, counters, accepts). The transaction double gives writes only to
 * `tx`: a write on `db` throws. Copy reads honour `select` as Prisma does. Each suite mocks the service's collaborators
 * itself (jest.mock hoists per file); `resetTradeMocks` gives those mocks their defaults.
 */
import { settleCreditLegTx } from "~/lib/cards/market/credit-leg";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { refusesTradeOffer } from "~/server/shared/privacy-permissions";

export const NOW = new Date("2026-11-02T12:00:00Z");
export const DAY_START = new Date("2026-11-02T00:00:00Z");
export const TABLE_AT = new Date("2026-11-02T11:00:00Z");
export const NEXT_EXPIRY = new Date(NOW.getTime() + 86_400_000);
export const HOUR_MS = 3_600_000;
export const ALICE = { id: "alice", clerkUserId: "user_alice" };
export const BOB = { id: "bob", clerkUserId: "user_bob" };
export const OPEN = { isMaintenanceMode: false, isTradingEnabled: true };
export const TRADES_HREF = "/vault/cards/market?tab=trades&trade=t1";

export interface CopyRow {
  id: string;
  ownerId: string;
  isLocked: boolean;
  cardId: string;
  inscribedAt: Date | null;
  cards: {
    title: string;
    isBound: boolean;
    cardType: string;
    countryId: string | null;
    realmId: string;
  };
}

export const copy = (id: string, ownerId: string, over: Partial<CopyRow> = {}): CopyRow => ({
  id,
  ownerId,
  isLocked: false,
  cardId: `card_${id}`,
  inscribedAt: null,
  cards: {
    title: `Title ${id}`,
    isBound: false,
    cardType: "LORE",
    countryId: null,
    realmId: "default",
  },
  ...over,
});
export const cardOf = (row: CopyRow, over: Partial<CopyRow["cards"]>) => ({
  ...row.cards,
  ...over,
});

/** Alice offered a1 for Bob's b1 and 300 of his IxC; Alice wrote the table, so a1 is locked. */
export const PENDING = {
  id: "t1",
  initiatorId: "alice",
  recipientId: "bob",
  proposerId: "alice",
  revision: 0,
  initiatorCardIds: ["a1"],
  recipientCardIds: ["b1"],
  initiatorCredits: 0,
  recipientCredits: 300,
  status: "PENDING",
  message: null,
  isCrossRealm: false,
  expiresAt: new Date(NOW.getTime() + 3_600_000),
  createdAt: TABLE_AT,
  updatedAt: TABLE_AT,
};
/** The same trade after Bob countered: Bob wrote revision 1, so b1 is locked and Alice responds. */
export const COUNTERED = { ...PENDING, proposerId: "bob", revision: 1 };

type Where = { id: { in: string[] }; ownerId: string };
type Select = Record<string, boolean | { select: Record<string, boolean> }>;
/** The columns a `select` names, as Prisma returns them (one level of relation). */
function picked(row: CopyRow, select: Select): Partial<CopyRow> {
  const entries = Object.entries(select).map(([key, how]) => {
    const value = row[key as keyof CopyRow];
    if (how === true) return [key, value];
    const nested = typeof how === "object" ? Object.keys(how.select) : [];
    return [
      key,
      Object.fromEntries(Object.entries(value ?? {}).filter(([k]) => nested.includes(k))),
    ];
  });
  return Object.fromEntries(entries);
}
const ownedBy = (copies: CopyRow[]) =>
  jest.fn(async ({ where, select }: { where: Where; select: Select }) =>
    copies
      .filter((c) => where.id.in.includes(c.id) && c.ownerId === where.ownerId)
      .map((c) => picked(c, select))
  );

export function makeDb(
  copies: CopyRow[],
  options: { trade?: object | null; claimed?: number; bonusUsed?: number; credits?: number } = {}
) {
  const trade = options.trade === undefined ? PENDING : options.trade;
  const tx = {
    cardOwnership: { findMany: ownedBy(copies) },
    tradeOffer: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "t1", ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimed ?? 1 }),
      update: jest.fn(async ({ data }: { data: object }) => ({
        ...trade,
        ...data,
        status: "ACCEPTED",
      })),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...trade, revision: 99 }),
      count: jest.fn().mockResolvedValue(options.bonusUsed ?? 0),
    },
  };
  const db = {
    user: { findUnique: jest.fn().mockResolvedValue(BOB) },
    myVault: { findUnique: jest.fn().mockResolvedValue({ credits: options.credits ?? 10_000 }) },
    cardOwnership: { findMany: ownedBy(copies) },
    tradeOffer: { findUnique: jest.fn().mockResolvedValue(trade) },
    $transaction: jest.fn(async <T>(work: (t: typeof tx) => Promise<T>) => work(tx)),
  };
  return { db, tx };
}

export const nameOf = jest.fn(async (userId: string) => `@${userId}`);
export const offer = (table: object, over: object = {}) => ({
  initiator: ALICE,
  partnerId: "bob",
  table: {
    initiatorCardIds: ["a1"],
    recipientCardIds: ["b1"],
    initiatorCredits: 0,
    recipientCredits: 0,
    ...table,
  },
  now: NOW,
  nameOf,
  ...over,
});
export const order = (...mocks: jest.Mock[]) => mocks.map((m) => m.mock.invocationCallOrder[0]);
export const ascending = (values: Array<number | undefined>) =>
  values.every((v, i) => v !== undefined && (i === 0 || v > values[i - 1]!));

/** Run in each suite's beforeEach, after jest.clearAllMocks. */
export function resetTradeMocks(): void {
  jest.mocked(getVaultConfig).mockResolvedValue(OPEN as never);
  jest.mocked(refusesTradeOffer).mockResolvedValue(false);
  jest.mocked(settleCreditLegTx).mockResolvedValue({ fee: 0, net: 0, royalties: [] });
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
}
