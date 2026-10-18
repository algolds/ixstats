import { TRPCError } from "@trpc/server";
import { TradeStatus } from "~/lib/vault/trade-settlement";
import type { getVaultConfig } from "~/lib/vault/vault-service";
import { loadPassportHandlesById } from "~/server/modules/identity/identity.passport-handles";

const PARTY_SELECT = {
  select: {
    id: true,
    clerkUserId: true,
    country: { select: { name: true, flag: true } },
  },
} as const;

/** Both sides of a trade; `withPartyHandles` names them. */
export const TRADE_PARTIES_INCLUDE = { initiator: PARTY_SELECT, recipient: PARTY_SELECT } as const;

interface Party {
  id: string;
  clerkUserId: string;
}
type Parties = { initiator: Party; recipient: Party };

/** The passport handle of every player in these trades, in one batched read. */
const handlesOf = (trades: readonly Parties[]) =>
  loadPassportHandlesById(trades.flatMap((trade) => [trade.initiator.id, trade.recipient.id]));

/** A party named by passport handle; the Clerk id is the chain's last link. */
function named<P extends Party>(party: P, handles: ReadonlyMap<string, string>) {
  return { ...party, passportHandle: handles.get(party.id) ?? party.clerkUserId };
}

function nameParties<T extends Parties>(trade: T, handles: ReadonlyMap<string, string>) {
  return {
    ...trade,
    initiator: named(trade.initiator, handles),
    recipient: named(trade.recipient, handles),
  };
}

/** Trades with both sides named by passport handle: a trade is direct, so a partner is always named. */
export async function withPartyHandles<T extends Parties>(trades: readonly T[]) {
  const handles = await handlesOf(trades);
  return trades.map((trade) => nameParties(trade, handles));
}

/** One trade with both sides named by passport handle. */
export async function withPartyHandle<T extends Parties>(trade: T) {
  return nameParties(trade, await handlesOf([trade]));
}

export const FINISHED_TRADE_STATUSES = [
  TradeStatus.ACCEPTED,
  TradeStatus.REJECTED,
  TradeStatus.CANCELLED,
  TradeStatus.EXPIRED,
];

/** Trading is closed while the vault is in maintenance or P2P trading is switched off. */
export function assertTradingOpen(config: Awaited<ReturnType<typeof getVaultConfig>>) {
  if (config.isMaintenanceMode) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Vault economy is currently in maintenance mode.",
    });
  }
  if (!config.isTradingEnabled) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "P2P card trading is currently disabled globally.",
    });
  }
}
