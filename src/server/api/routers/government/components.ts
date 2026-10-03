import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
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

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

type ComponentRow = {
  id: string;
  componentType: string;
  isActive: boolean;
  implementationDate: Date | null;
};

type CatalogEntry = {
  name?: string;
  metadata?: { staffRequired?: number; timeToImplement?: string };
};

type RolloutKind = "government" | "economic" | "tax";

/** One entry per component family: its rows, the catalog describing them, and how a row maps to a catalog id. */
function componentFamilies(rows: Record<RolloutKind, ComponentRow[]>) {
  return [
    {
      kind: "government",
      rows: rows.government,
      catalog: ATOMIC_COMPONENTS as Record<string, CatalogEntry>,
      idOf: (c: ComponentRow) => String(c.componentType),
    },
    {
      kind: "economic",
      rows: rows.economic,
      catalog: ATOMIC_ECONOMIC_COMPONENTS as Record<string, CatalogEntry>,
      idOf: (c: ComponentRow) => String(c.componentType),
    },
    {
      kind: "tax",
      rows: rows.tax,
      catalog: ATOMIC_TAX_COMPONENTS as Record<string, CatalogEntry>,
      idOf: (c: ComponentRow) => mapTaxComponentTypeToId(String(c.componentType)),
    },
  ] as const;
}

/** A component still rolling out; its duration is estimated from the catalog timeframe (IxTime domain). */
function rolloutEntry(
  kind: RolloutKind,
  componentId: string,
  id: string,
  entry: CatalogEntry | undefined,
  implementationDate: Date | null,
  nowMs: number
) {
  const completionDate = implementationDate ? new Date(implementationDate).getTime() : nowMs;
  const parsed = parseTimeToImplement(entry?.metadata?.timeToImplement ?? "12 months");
  const totalMonths = parsed.years ? parsed.years * 12 : (parsed.months ?? 12);
  const durationMs = Math.max(1, totalMonths * MONTH_MS);
  const remainingMs = Math.max(0, completionDate - nowMs);
  return {
    kind,
    id: componentId,
    componentType: id,
    name: entry?.name ?? id,
    staffRequired: entry?.metadata?.staffRequired ?? 0,
    completionDate,
    remainingMs,
    progress: Math.round(Math.min(100, Math.max(0, (1 - remainingMs / durationMs) * 100))),
  };
}

export const governmentComponentsRouter = createTRPCRouter({
  // Civil service capacity + rollout queue for the country dashboard.
  // Aggregates government / economic / tax components: staff is consumed by both
  // active and still-implementing components, while only implementing ones appear
  // in the rollout queue (with a progress estimate based on createdAt → implementationDate).
  // Owner/privileged only: civil-service capacity is private like CivCap.
  getCivilServiceStatus: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      // implementationDate is stored in IxTime (game time), so compare against IxTime now.
      const nowMs = IxTime.getCurrentIxTime();
      const now = new Date(nowMs);

      const forCountry = { where: { countryId: input.countryId } };
      const select = { id: true, componentType: true, isActive: true, implementationDate: true };
      const [country, government, economic, tax] = await Promise.all([
        ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: {
            currentPopulation: true,
            governmentalEfficiency: true,
            governmentStructure: { select: { governmentEffectiveness: true } },
          },
        }),
        ctx.db.governmentComponent.findMany({ ...forCountry, select }),
        ctx.db.economicComponent.findMany({ ...forCountry, select }),
        ctx.db.taxComponent.findMany({ ...forCountry, select }),
      ]);

      const isActive = (c: ComponentRow) =>
        c.isActive === true || (!!c.implementationDate && new Date(c.implementationDate) <= now);

      const rolloutQueue: ReturnType<typeof rolloutEntry>[] = [];
      const idsByKind: Record<RolloutKind, string[]> = { government: [], economic: [], tax: [] };
      let activeCount = 0;
      for (const { kind, rows, catalog, idOf } of componentFamilies({
        government,
        economic,
        tax,
      })) {
        for (const c of rows) {
          const id = idOf(c);
          idsByKind[kind].push(id);
          if (isActive(c)) activeCount++;
          else
            rolloutQueue.push(
              rolloutEntry(kind, c.id, id, catalog[id], c.implementationDate, nowMs)
            );
        }
      }

      // Staff is consumed by both active and implementing components.
      const consumedStaff = calculateTotalConsumedStaff(
        idsByKind.government as any[],
        idsByKind.economic as any[],
        idsByKind.tax
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
