/**
 * System Router - Public system information endpoints
 *
 * Provides non-sensitive system information to all users
 * Created to replace admin.getSystemStatus calls in public-facing components
 */

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";

export const systemRouter = createTRPCRouter({
  /**
   * Get current IxTime information
   * PUBLIC: Available to all users (including unauthenticated)
   *
   * Used by: CountryDataProvider, profile pages, and other components
   * that need to display current game time
   */
  getCurrentIxTime: publicProcedure.query(async () => {
    // Return current time even if the status check fails
    const status = await IxTime.getStatus().catch((error: unknown) => {
      console.error("Failed to get IxTime status:", error);
      return null;
    });
    // One clock read, so every field describes the same instant
    const now = IxTime.getCurrentIxTime();
    return {
      currentRealTime: new Date().toISOString(),
      currentIxTime: new Date(now).toISOString(),
      currentIxTimeNumber: now,
      formattedIxTime: IxTime.formatIxTime(now, true),
      multiplier: IxTime.getTimeMultiplier(),
      isPaused: status ? IxTime.isPaused() : false,
      gameYear: IxTime.getCurrentGameYear(now),
      hasTimeOverride: status?.hasTimeOverride ?? false,
    };
  }),
});
