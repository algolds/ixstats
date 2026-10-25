/**
 * The defense model's levers and reads (realm time D2a, design §4). Thin: inputs validated here, logic in
 * `~/server/modules/defense`. Writes are premium with the canonical country-write check; reads serve the owner the
 * derived defense and everyone else the public order of battle (D3 adds intelligence estimates).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  premiumMutationProcedure,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  assertCountryResourceWriteAccess,
  assertCountryWriteAccess,
  hasCountryWriteAccess,
} from "~/server/shared/country-authorization";
import {
  ALERT_LEVELS,
  DOCTRINES,
  MAX_RESERVE_YEARS,
  O_M_PRIORITIES,
  SERVICE_MONTHS_MAX,
  SERVICE_MONTHS_MIN,
  SHARE_PRESETS,
  type SharePreset,
} from "~/lib/military/model";
import {
  MAX_ORDER_QUANTITY,
  branchDetail,
  cancelProcurementOrder,
  defenseOverview,
  demobiliseReserves,
  listProcurementOrders,
  mobiliseReserves,
  orderProcurement,
  publicDefenseOverview,
  setAlertLevel,
  setDefenseShares,
  setDoctrine,
  setManpowerModel,
  setOmPriority,
  setSurge,
  syncDefense,
} from "~/server/modules/defense";

const countryInput = z.object({ countryId: z.string().min(1) });
const share = z.number().finite().min(0).max(1);
const PRESETS = Object.keys(SHARE_PRESETS) as [SharePreset, ...SharePreset[]];

const sharesSchema = z
  .object({ personnel: share, om: share, procurement: share, rd: share, infrastructure: share })
  .refine(
    (s) => Math.abs(s.personnel + s.om + s.procurement + s.rd + s.infrastructure - 1) < 0.001,
    "Shares must add up to 100%"
  );

type Ctx = Parameters<typeof assertCountryResourceWriteAccess>[0] & { db: PrismaClient };

/** The branch's nation, after the canonical write check on it. */
async function writableBranchCountry(ctx: Ctx, branchId: string): Promise<string> {
  const branch = await ctx.db.militaryBranch.findUnique({
    where: { id: branchId },
    select: { countryId: true, isActive: true },
  });
  if (!branch?.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Military branch not found" });
  await assertCountryResourceWriteAccess(ctx, branch.countryId, "Military branch");
  return branch.countryId;
}

export const securityDefenseRouter = createTRPCRouter({
  // The nation's defense now: policy, budget and source, combat power, readiness, every branch's derived state.
  getDefensePolicy: publicProcedure.input(countryInput).query(async ({ ctx, input }) => {
    const snapshot = await syncDefense(ctx.db, input.countryId);
    return (await hasCountryWriteAccess(ctx, input.countryId))
      ? defenseOverview(snapshot)
      : publicDefenseOverview(snapshot);
  }),

  // National combat power and readiness (owner; others get the public view).
  getNationalDefense: publicProcedure.input(countryInput).query(async ({ ctx, input }) => {
    const snapshot = await syncDefense(ctx.db, input.countryId);
    if (!(await hasCountryWriteAccess(ctx, input.countryId))) return publicDefenseOverview(snapshot);
    const { view } = snapshot;
    return {
      countryId: input.countryId,
      redacted: false as const,
      combatPower: view.combatPower,
      readiness: view.readiness,
      cLevel: view.cLevel,
      cev: view.cev,
      alertInEffect: view.alert,
      burden: view.burden,
      branches: view.branches,
    };
  }),

  // One branch's derived state, assets and open orders (owner).
  getBranchState: protectedProcedure
    .input(z.object({ branchId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const countryId = await writableBranchCountry(ctx, input.branchId);
      const detail = branchDetail(await syncDefense(ctx.db, countryId), input.branchId);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Military branch not found" });
      return detail;
    }),

  setDefenseShares: premiumMutationProcedure
    .input(
      z.union([
        countryInput.extend({ preset: z.enum(PRESETS) }),
        countryInput.extend({ shares: sharesSchema }),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return setDefenseShares(ctx.db, input);
    }),

  setManpowerModel: premiumMutationProcedure
    .input(
      countryInput.extend({
        volunteerShare: share,
        serviceMonths: z.number().int().min(SERVICE_MONTHS_MIN).max(SERVICE_MONTHS_MAX),
        reserveYears: z.number().int().min(0).max(MAX_RESERVE_YEARS),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return setManpowerModel(ctx.db, input);
    }),

  setDoctrine: premiumMutationProcedure
    .input(countryInput.extend({ doctrine: z.enum(DOCTRINES) }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return setDoctrine(ctx.db, input);
    }),

  // A raised alert bites after 7 (Elevated) to 30 (War) in-game days.
  setAlertLevel: premiumMutationProcedure
    .input(countryInput.extend({ alertLevel: z.enum(ALERT_LEVELS) }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return setAlertLevel(ctx.db, input);
    }),

  setOmPriority: premiumMutationProcedure
    .input(countryInput.extend({ omPriority: z.enum(O_M_PRIORITIES) }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return setOmPriority(ctx.db, input);
    }),

  setProductionSurge: premiumMutationProcedure
    .input(countryInput.extend({ surging: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return setSurge(ctx.db, input);
    }),

  getProcurementOrders: protectedProcedure
    .input(countryInput.extend({ includeClosed: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return listProcurementOrders(ctx.db, input);
    }),

  // Domestic within industrial capacity, or a catalog import at +15% cost and a longer lead time.
  orderProcurement: premiumMutationProcedure
    .input(
      z.object({
        branchId: z.string().min(1),
        catalogKey: z.string().min(1).max(200),
        quantity: z.number().int().min(1).max(MAX_ORDER_QUANTITY),
        source: z.enum(["domestic", "import"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const countryId = await writableBranchCountry(ctx, input.branchId);
      return orderProcurement(ctx.db, { ...input, countryId });
    }),

  cancelProcurementOrder: premiumMutationProcedure
    .input(countryInput.extend({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return cancelProcurementOrder(ctx.db, input);
    }),

  mobiliseReserves: premiumMutationProcedure
    .input(z.object({ branchId: z.string().min(1), reservists: z.number().int().min(1).max(50_000_000) }))
    .mutation(async ({ ctx, input }) => {
      const countryId = await writableBranchCountry(ctx, input.branchId);
      return mobiliseReserves(ctx.db, { ...input, countryId });
    }),

  demobiliseReserves: premiumMutationProcedure
    .input(z.object({ branchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const countryId = await writableBranchCountry(ctx, input.branchId);
      return demobiliseReserves(ctx.db, { ...input, countryId });
    }),
});
