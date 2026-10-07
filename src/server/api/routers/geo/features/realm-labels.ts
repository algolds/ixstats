/**
 * Realm labels: oceans, seas, regions and continents on a realm's map (`MapLabel` with `realmId`, no nation).
 * The realm's map editors manage them (site admins anywhere; the founder and officers holding the Map power in
 * their own realm; IxWorld stays with site admins). Nations' own labels stay in `labels.ts`.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { editableMapRealmId, realmScopeInput } from "~/server/api/trpc/realm-scope";
import { GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import {
  REALM_LABEL_FONT_STYLES,
  REALM_LABEL_FONT_WEIGHTS,
  REALM_LABEL_TYPES,
} from "~/lib/maps/realm-labels";
import { coordinatesSchema } from "../core/shared";

const styleFields = {
  fontSize: z.number().min(8).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontStyle: z.enum(REALM_LABEL_FONT_STYLES),
  fontWeight: z.enum(REALM_LABEL_FONT_WEIGHTS),
  letterSpacing: z.number().min(0).max(1),
  rotation: z.number().min(-180).max(180),
  opacity: z.number().min(0.1).max(1),
  minZoom: z.number().min(0).max(18),
  maxZoom: z.number().min(0).max(22),
};

const labelFields = {
  text: z.string().trim().min(1).max(100),
  labelType: z.enum(REALM_LABEL_TYPES),
  coordinates: coordinatesSchema,
  ...styleFields,
};

const LABEL_SELECT = {
  id: true,
  text: true,
  labelType: true,
  coordinates: true,
  fontSize: true,
  color: true,
  fontStyle: true,
  fontWeight: true,
  letterSpacing: true,
  rotation: true,
  opacity: true,
  minZoom: true,
  maxZoom: true,
} as const;

async function afterLabelWrite() {
  await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS);
  broadcastMapUpdate("mapLabel");
}

/** The realm label, if it is one of this realm's (a nation's label never is). */
async function requireRealmLabel(
  db: { mapLabel: { findFirst: (args: object) => Promise<unknown> } },
  labelId: string,
  realmId: string
) {
  const label = await db.mapLabel.findFirst({
    where: { id: labelId, realmId, countryId: null },
    select: { id: true },
  });
  if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Label not found" });
}

export const geoFeaturesRealmLabelsRouter = createTRPCRouter({
  /** The realm's own labels, for its map editors. */
  listRealmLabels: protectedProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input?.realm);
      return ctx.db.mapLabel.findMany({
        where: { realmId, countryId: null },
        orderBy: { text: "asc" },
        take: 500,
        select: LABEL_SELECT,
      });
    }),

  createRealmLabel: rateLimitedMutationProcedure
    .input(
      z.object({
        ...realmScopeInput.shape,
        ...labelFields,
        fontStyle: labelFields.fontStyle.default("normal"),
        fontWeight: labelFields.fontWeight.default("normal"),
        letterSpacing: labelFields.letterSpacing.default(0),
        rotation: labelFields.rotation.default(0),
        opacity: labelFields.opacity.default(1),
        minZoom: labelFields.minZoom.default(0),
        maxZoom: labelFields.maxZoom.default(22),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realmId = await editableMapRealmId(ctx, input.realm);
      const { realm: _realm, ...data } = input;
      const label = await ctx.db.mapLabel.create({
        data: {
          ...data,
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
      await requireRealmLabel(ctx.db, input.labelId, realmId);
      const { realm: _realm, labelId, ...changes } = input;
      const label = await ctx.db.mapLabel.update({
        where: { id: labelId },
        data: Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)),
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
