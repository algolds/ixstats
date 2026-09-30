// src/server/api/routers/government.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";
import { ATOMIC_TAX_COMPONENTS } from "~/lib/government/tax/atomic-tax-components";
import {
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
  parseTimeToImplement,
} from "~/lib/government/atomic-utils";
import { mapTaxComponentTypeToId } from "~/lib/enums";
import { IxTime } from "~/lib/ixtime";

// Input validation schemas
// Base schema for government departments
// Create schema - all required fields with defaults
// Update schema - all fields optional
export const governmentComponentsRouter = createTRPCRouter({
  // Civil service capacity + rollout queue for the country dashboard.
  // Aggregates government / economic / tax components: staff is consumed by both
  // active and still-implementing components, while only implementing ones appear
  // in the rollout queue (with a progress estimate based on createdAt → implementationDate).
  getCivilServiceStatus: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // implementationDate is stored in IxTime (game time), so compare against IxTime now.
      const nowMs = IxTime.getCurrentIxTime();
      const now = new Date(nowMs);
      const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

      const [country, gov, econ, tax] = await Promise.all([
        ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: {
            currentPopulation: true,
            governmentalEfficiency: true,
            governmentStructure: { select: { governmentEffectiveness: true } },
          },
        }),
        ctx.db.governmentComponent.findMany({
          where: { countryId: input.countryId },
          select: { id: true, componentType: true, isActive: true, implementationDate: true },
        }),
        ctx.db.economicComponent.findMany({
          where: { countryId: input.countryId },
          select: { id: true, componentType: true, isActive: true, implementationDate: true },
        }),
        ctx.db.taxComponent.findMany({
          where: { countryId: input.countryId },
          select: { id: true, componentType: true, isActive: true, implementationDate: true },
        }),
      ]);

      const isActive = (c: { isActive: boolean; implementationDate: Date | null }) =>
        c.isActive === true || (!!c.implementationDate && new Date(c.implementationDate) <= now);

      type RolloutEntry = {
        kind: "government" | "economic" | "tax";
        id: string;
        componentType: string;
        name: string;
        staffRequired: number;
        completionDate: number;
        remainingMs: number;
        progress: number;
      };

      const rolloutQueue: RolloutEntry[] = [];
      const allGovTypes: string[] = [];
      const allEconTypes: string[] = [];
      const allTaxIds: string[] = [];
      let activeCount = 0;

      const addRollout = (
        kind: RolloutEntry["kind"],
        id: string,
        componentType: string,
        name: string,
        staffRequired: number,
        timeToImplement: string | undefined,
        c: { implementationDate: Date | null }
      ) => {
        const completionMs = c.implementationDate
          ? new Date(c.implementationDate).getTime()
          : nowMs;
        // Estimate total rollout duration from the catalog timeframe (IxTime domain).
        const parsed = parseTimeToImplement(timeToImplement ?? "12 months");
        const totalMonths = parsed.years ? parsed.years * 12 : (parsed.months ?? 12);
        const durationMs = Math.max(1, totalMonths * MONTH_MS);
        const remainingMs = Math.max(0, completionMs - nowMs);
        const progress = Math.round(
          Math.min(100, Math.max(0, (1 - remainingMs / durationMs) * 100))
        );
        rolloutQueue.push({
          kind,
          id,
          componentType,
          name,
          staffRequired,
          completionDate: completionMs,
          remainingMs,
          progress,
        });
      };

      for (const c of gov) {
        const type = String(c.componentType);
        const data = (ATOMIC_COMPONENTS as Record<string, any>)[type];
        allGovTypes.push(type);
        if (isActive(c)) activeCount++;
        else
          addRollout(
            "government",
            c.id,
            type,
            data?.name ?? type,
            data?.metadata?.staffRequired ?? 0,
            data?.metadata?.timeToImplement,
            c
          );
      }
      for (const c of econ) {
        const type = String(c.componentType);
        const data = (ATOMIC_ECONOMIC_COMPONENTS as Record<string, any>)[type];
        allEconTypes.push(type);
        if (isActive(c)) activeCount++;
        else
          addRollout(
            "economic",
            c.id,
            type,
            data?.name ?? type,
            data?.metadata?.staffRequired ?? 0,
            data?.metadata?.timeToImplement,
            c
          );
      }
      for (const c of tax) {
        const id = mapTaxComponentTypeToId(String(c.componentType));
        const data = (ATOMIC_TAX_COMPONENTS as Record<string, any>)[id];
        allTaxIds.push(id);
        if (isActive(c)) activeCount++;
        else
          addRollout(
            "tax",
            c.id,
            id,
            data?.name ?? id,
            data?.metadata?.staffRequired ?? 0,
            data?.metadata?.timeToImplement,
            c
          );
      }

      // Staff is consumed by both active and implementing components.
      const consumedStaff = calculateTotalConsumedStaff(
        allGovTypes as any[],
        allEconTypes as any[],
        allTaxIds
      );
      const effectiveness =
        country?.governmentStructure?.governmentEffectiveness ??
        country?.governmentalEfficiency ??
        50;
      const capacity = calculateCivilServiceCapacity(
        country?.currentPopulation ?? 0,
        effectiveness
      );

      rolloutQueue.sort((a, b) => a.completionDate - b.completionDate);

      return {
        capacity,
        consumedStaff,
        availableStaff: Math.max(0, capacity - consumedStaff),
        utilizationPercent: capacity > 0 ? Math.round((consumedStaff / capacity) * 100) : 0,
        overCapacity: consumedStaff > capacity,
        activeCount,
        implementingCount: rolloutQueue.length,
        rolloutQueue,
      };
    }),
});
