import { TRPCError } from "@trpc/server";
import { TradeStatus } from "@prisma/client";
import type { getVaultConfig } from "~/lib/vault/vault-service";

const PARTY_SELECT = {
  select: {
    id: true,
    clerkUserId: true,
    country: { select: { name: true, flag: true } },
  },
} as const;

/** Both sides of a trade with the country badge shown in the trade UI. */
export const TRADE_PARTIES_INCLUDE = { initiator: PARTY_SELECT, recipient: PARTY_SELECT } as const;

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
