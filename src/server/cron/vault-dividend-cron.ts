import { db } from "~/server/db";
import { shiftDay, utcDay } from "~/lib/vault/vault-dividend";
import {
  recordDividendStart,
  settleDividendDay,
  settleMissedDividends,
} from "~/server/modules/vault/vault-dividend-settle";

/** Midnight UTC: pay yesterday's Vault dividend, then any earlier unsettled day of the last week. */
export async function runVaultDividend() {
  const now = new Date();
  const day = shiftDay(utcDay(now), -1);
  await recordDividendStart(db, day);
  const settled = await settleDividendDay(db, day);
  const missed = await settleMissedDividends(db, now);
  console.log(
    `[CRON] Vault dividend ${day}: ${settled.paid} paid, ${settled.skipped} skipped, missed days ${missed.days.join(",") || "none"}`
  );
  return { day, ...settled, missedDays: missed.days };
}
