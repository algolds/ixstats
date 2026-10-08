/**
 * Realm labels: oceans, seas, regions and continents on a realm's map (`MapLabel` with `realmId`, no nation), drawn
 * in IxWorld's ocean-label style by kind and rank (`src/lib/maps/ocean-labels.ts`).
 * The realm's map editors manage them (site admins anywhere; the founder and officers holding the Map power in
 * their own realm; IxWorld stays with site admins). Nations' own labels stay in `labels.ts`.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { editableMapRealmId, realmScopeInput } from "~/server/api/trpc/realm-scope";
import { GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { REALM_LABEL_RANKS, REALM_LABEL_TYPES, realmLabelRank } from "~/lib/maps/realm-labels";
import { realmLabelData, storedRealmLabelRank } from "~/server/modules/maps/realm-labels";
import { coordinatesSchema } from "../core/shared";

/** A realm label is a name, a kind, an anchor and a rank; its look is IxWorld's ocean-label style for that rank. */
const labelFields = {
  text: z.string().trim().min(1).max(100),
  labelType: z.enum(REALM_LABEL_TYPES),
  coordinates: coordinatesSchema,
  rank: z.enum(REALM_LABEL_RANKS),
};

const LABEL_SELECT = {
  id: true,
  text: true,
  labelType: true,
  coordinates: true,
  metadata: true,
} as const;

async function afterLabelWrite() {
  await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS);
  broadcastMapUpdate("mapLabel");
}

/** The realm label, if it is one of this realm's (a nation's label never is). */
async function requireRealmLabel(db: PrismaClient, labelId: string, realmId: string) {
  const label = await db.mapLabel.findFirst({
    where: { id: labelId, realmId, countryId: null },
    select: { id: true, metadata: true },
  });
  if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Label not found" });
  return label;
}

/** The label's metadata with a new rank, keeping what else it holds (a seeded label's key). */
function withRank(metadata: Prisma.JsonValue, rank: string): Prisma.InputJsonObject {
  const kept = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  return { ...kept, rank };
}

export const geoFeaturesRealmLabelsRouter = createTRPCRouter({
  /** The realm's own labels, for its map editors. */
  listRealmLabels: protectedProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input?.realm);
      const rows = await ctx.db.mapLabel.findMany({
        where: { realmId, countryId: null },
        orderBy: { text: "asc" },
        take: 500,
        select: LABEL_SELECT,
      });
      return rows.map(({ metadata, ...label }) => ({
        ...label,
        rank: realmLabelRank(label.labelType, storedRealmLabelRank(metadata)),
      }));
    }),

  createRealmLabel: rateLimitedMutationProcedure
    .input(
      z.object({
        ...realmScopeInput.shape,
        ...labelFields,
        rank: labelFields.rank.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const label = await ctx.db.mapLabel.create({
        data: {
          ...realmLabelData(input),
          realmId,
          countryId: null,
          status: "approved",
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        },
        select: LABEL_SELECT,
      });
      await afterLabelWrite();
      return label;
    }),

  updateRealmLabel: rateLimitedMutationProcedure
    .input(
      z.object({
        ...realmScopeInput.shape,
        labelId: z.string().min(1),
        ...z.object(labelFields).partial().shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const existing = await requireRealmLabel(ctx.db, input.labelId, realmId);
      const { realm: _realm, labelId, rank, ...changes } = input;
      const label = await ctx.db.mapLabel.update({
        where: { id: labelId },
        data: {
          ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)),
          ...(rank ? { metadata: withRank(existing.metadata, rank) } : {}),
        },
        select: LABEL_SELECT,
      });
      await afterLabelWrite();
      return label;
    }),

  deleteRealmLabel: rateLimitedMutationProcedure
    .input(z.object({ ...realmScopeInput.shape, labelId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      await requireRealmLabel(ctx.db, input.labelId, realmId);
      await ctx.db.mapLabel.delete({ where: { id: input.labelId } });
      await afterLabelWrite();
      return { id: input.labelId, deleted: true };
    }),
});
