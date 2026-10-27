import type { PrismaClient } from "@prisma/client";
import { getEconomyConfig, type CardEconomyConfig } from "~/lib/cards/economy-config";
import { getGeneralCardSettings } from "~/lib/cards/general-settings";
import { getValuationConfig, type CardValuationConfig } from "~/lib/cards/valuation";

/** The numbers the card screens preview with (dust yields, craft costs, fees, durations). None is secret. */
export async function getPublicEconomyNumbers(
  db: Pick<PrismaClient, "systemConfig">
): Promise<{ economy: CardEconomyConfig; valuation: CardValuationConfig; feeRatePct: number }> {
  const [economy, valuation, general] = await Promise.all([
    getEconomyConfig(db),
    getValuationConfig(db),
    getGeneralCardSettings(db),
  ]);
  return { economy, valuation, feeRatePct: general.auctionHouseRakePct };
}
