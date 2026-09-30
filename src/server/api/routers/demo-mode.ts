/**
 * Demo Mode API Router
 *
 * Admin-only endpoints for managing the live demo system.
 * Creates a cloned demo country with seeded data across all subsystems.
 */

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { isSystemOwner } from "~/lib/auth";

// SystemConfig keys for demo mode state
const DEMO_ACTIVE_KEY = "demo_mode_active";
const DEMO_COUNTRY_KEY = "demo_country_id";

/** Read a SystemConfig value */
async function getConfig(prisma: any, key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Upsert a SystemConfig value */
async function setConfig(prisma: any, key: string, value: string, description?: string) {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value, description },
  });
}

export const demoModeRouter = createTRPCRouter({
  /**
   * Get demo mode state. Only returns real data for system owners.
   * Used by DemoModeContext on the client.
   */
  getDemoState: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId || !isSystemOwner(userId)) {
      return { isActive: false, demoCountryId: null };
    }

    const [activeValue, countryId] = await Promise.all([
      getConfig(ctx.db, DEMO_ACTIVE_KEY),
      getConfig(ctx.db, DEMO_COUNTRY_KEY),
    ]);

    const isActive = activeValue === "true" && !!countryId;

    // Verify the demo country still exists
    if (isActive && countryId) {
      const exists = await ctx.db.country.findFirst({
        where: { id: countryId, isDemo: true },
        select: { id: true },
      });
      if (!exists) {
        // Country was deleted externally, clean up config
        await setConfig(ctx.db, DEMO_ACTIVE_KEY, "false");
        return { isActive: false, demoCountryId: null };
      }
    }

    return { isActive, demoCountryId: isActive ? countryId : null };
  }),
});
