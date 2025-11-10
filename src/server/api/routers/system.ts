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
    try {
      const ixTimeStatus = await IxTime.getStatus();

      return {
        currentRealTime: new Date().toISOString(),
        currentIxTime: new Date(IxTime.getCurrentIxTime()).toISOString(),
        currentIxTimeNumber: IxTime.getCurrentIxTime(),
        formattedIxTime: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
        multiplier: IxTime.getTimeMultiplier(),
        isPaused: IxTime.isPaused(),
        gameYear: IxTime.getCurrentGameYear(),
        hasTimeOverride: ixTimeStatus.hasTimeOverride,
      };
    } catch (error) {
      console.error("Failed to get IxTime status:", error);
      // Return current time even if status check fails
      return {
        currentRealTime: new Date().toISOString(),
        currentIxTime: new Date(IxTime.getCurrentIxTime()).toISOString(),
        currentIxTimeNumber: IxTime.getCurrentIxTime(),
        formattedIxTime: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
        multiplier: IxTime.getTimeMultiplier(),
        isPaused: false,
        gameYear: IxTime.getCurrentGameYear(),
        hasTimeOverride: false,
      };
    }
  }),
});
