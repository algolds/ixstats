/**
 * Seeds (research §7.5 step 3, exploit checklist 7): the binding seed is HMAC(server secret, battleId ‖ committedAt ‖
 * orders hash), fixed at commit and stored, so the orders cannot be re-sent for another roll and a replay recomputes
 * exactly. Intelligence draws and preview seeds come from separate HMAC domains, so neither reveals the commit seed.
 */
import { createHash, createHmac } from "crypto";
import { env } from "~/env";
import { DAY_MS } from "~/lib/military/model";
import { INTEL_REDRAW_DAYS } from "~/lib/military/combat";

const DEV_SECRET = "ixstats-dev-combat-seed";

/** COMBAT_SEED_SECRET, else CRON_SECRET (required in production), else a fixed development key. */
function secret(): string {
  return env.COMBAT_SEED_SECRET ?? env.CRON_SECRET ?? DEV_SECRET;
}

const hmac = (message: string) => createHmac("sha256", secret()).update(message).digest("hex");

type OrderValue = string | number | boolean | null;

/** SHA-256 of the orders with sorted keys, so the same orders always hash the same. */
export function ordersHash(orders: Readonly<Record<string, OrderValue>>): string {
  const canonical = JSON.stringify(Object.keys(orders).sort().map((key) => [key, orders[key]]));
  return createHash("sha256").update(canonical).digest("hex");
}

/** The binding seed of a battle. */
export const combatSeed = (battleId: string, committedClockMs: number, hash: string) =>
  hmac(`battle|${battleId}|${committedClockMs}|${hash}`);

/** A uniform in [0, 1) from a hex digest. */
const uniformOf = (hex: string) => Number.parseInt(hex.slice(0, 13), 16) / 2 ** 52;

/** The viewer's intelligence error draw on a target: fixed for an in-game week, so asking again never averages it. */
export function intelDraw(viewerId: string, targetId: string, clockMs: number): number {
  const week = Math.floor(clockMs / (INTEL_REDRAW_DAYS * DAY_MS));
  return uniformOf(hmac(`intel|${viewerId}|${targetId}|${week}`));
}

/** The preview's seed: per viewer, target and in-game day, never the commit seed. */
export function previewSeed(viewerId: string, targetId: string, clockMs: number): string {
  return hmac(`preview|${viewerId}|${targetId}|${Math.floor(clockMs / DAY_MS)}`);
}
