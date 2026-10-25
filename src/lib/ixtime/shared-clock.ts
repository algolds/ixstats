/**
 * The Discord bot's clock, shared by every server process (P1-32).
 *
 * The bot pushes its clock to one web process (`/api/ixtime/sync-from-bot`, the admin sync), which
 * adopts it in memory. That process persists the override state to the `ixtime_clock_state`
 * SystemConfig row; every other process (the cron runner, the IxWorld standalone, a restarted web
 * process) loads it before it reads IxTime: the cron runner before each job, the web through the
 * tRPC context, at most once per CLOCK_REFRESH_TTL_MS. Server-only (it takes a Prisma client);
 * the client bundle keeps using `IxTime` alone.
 */
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { IxTime, type IxTimeClockState } from "./core";

export const IXTIME_CLOCK_CONFIG_KEY = "ixtime_clock_state";
/** How long a process trusts its copy of the shared clock before reading the row again. */
export const CLOCK_REFRESH_TTL_MS = 30_000;

type ClockStore = Pick<PrismaClient, "systemConfig">;

let lastRefreshAt = 0;
let inFlight: Promise<void> | null = null;

const clockStateSchema = z.object({
  timeOverride: z.number().finite().nullable(),
  timeOverrideSetAt: z.number().finite().nullable(),
  multiplierOverride: z.number().finite().nullable(),
});

/** The stored state, or null when the row holds something else. */
export function parseClockState(value: string): IxTimeClockState | null {
  try {
    const parsed = clockStateSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Writes this process's clock state for the other processes. Call after adopting a new clock. */
export async function persistSharedClock(db: ClockStore): Promise<void> {
  try {
    await db.systemConfig.upsert({
      where: { key: IXTIME_CLOCK_CONFIG_KEY },
      create: {
        key: IXTIME_CLOCK_CONFIG_KEY,
        value: JSON.stringify(IxTime.getClockState()),
        description: "IxTime override state adopted from the Discord bot (shared by every process)",
      },
      update: { value: JSON.stringify(IxTime.getClockState()) },
    });
    lastRefreshAt = Date.now();
  } catch (error) {
    console.error("[IxTime] Failed to persist the shared clock:", error);
  }
}

async function loadSharedClock(db: ClockStore): Promise<void> {
  try {
    const row = await db.systemConfig.findUnique({ where: { key: IXTIME_CLOCK_CONFIG_KEY } });
    const state = row ? parseClockState(row.value) : null;
    if (state) IxTime.loadClockState(state);
  } catch (error) {
    console.warn("[IxTime] Failed to load the shared clock, keeping the local one:", error);
  } finally {
    lastRefreshAt = Date.now();
    inFlight = null;
  }
}

/**
 * Loads the shared clock unless this process read it within CLOCK_REFRESH_TTL_MS (`force` reads it
 * anyway). No row (the bot never pushed an override) leaves the local clock as it is.
 */
export function refreshSharedClock(db: ClockStore, options: { force?: boolean } = {}) {
  if (inFlight) return inFlight;
  if (!options.force && Date.now() - lastRefreshAt < CLOCK_REFRESH_TTL_MS) {
    return Promise.resolve();
  }
  inFlight = loadSharedClock(db);
  return inFlight;
}

/** Test seam: forget when the clock was last read. */
export function resetSharedClockCache(): void {
  lastRefreshAt = 0;
  inFlight = null;
}
