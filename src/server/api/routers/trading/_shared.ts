import type { TradeOfferStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { getVaultConfig } from "~/lib/vault/vault-service";
import { loadPlayerNames, type PlayerName } from "~/server/modules/identity/identity.player-names";

const PARTY_SELECT = {
  select: {
    id: true,
    clerkUserId: true,
    country: { select: { name: true, flag: true } },
  },
} as const;

/** Both sides of a trade; `withPartyNames` names them. */
export const TRADE_PARTIES_INCLUDE = { initiator: PARTY_SELECT, recipient: PARTY_SELECT } as const;

interface Party {
  id: string;
  clerkUserId: string;
}
type Parties = { initiator: Party; recipient: Party };

/** The name of every player in these trades, in one batched read. */
const namesOf = (trades: readonly Parties[]) =>
  loadPlayerNames(trades.flatMap((trade) => [trade.initiator.id, trade.recipient.id]));

/**
 * A party with their passport handle, for the holder link (the Clerk id, the chain's last link, when it is all they
 * have), and their name by the identity rule (null reads "a player"). A trade is direct, so the vaultCards switch does
 * not hide a partner.
 */
function named<P extends Party>(party: P, names: ReadonlyMap<string, PlayerName>) {
  const name = names.get(party.id);
  return {
    ...party,
    passportHandle: name?.handle ?? party.clerkUserId,
    displayName: name?.displayName ?? null,
  };
}

function nameParties<T extends Parties>(trade: T, names: ReadonlyMap<string, PlayerName>) {
  return {
    ...trade,
    initiator: named(trade.initiator, names),
    recipient: named(trade.recipient, names),
  };
}

/** Trades with both sides named. */
export async function withPartyNames<T extends Parties>(trades: readonly T[]) {
  const names = await namesOf(trades);
  return trades.map((trade) => nameParties(trade, names));
}

/** One trade with both sides named. */
export async function withPartyName<T extends Parties>(trade: T) {
  return nameParties(trade, await namesOf([trade]));
}

export const FINISHED_TRADE_STATUSES: TradeOfferStatus[] = [
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
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
