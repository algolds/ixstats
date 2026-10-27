/**
 * Storylines (AT-14): ordered chains of a country's story pins. A pin in a storyline gets the
 * timeline and previous/next navigation in the map's story pin modal (`StorylineTimeline`).
 *
 * Writes follow the other geo feature routers: `standardMutationCountryOwnerProcedure` binds the
 * caller to their own country (`ctx.country`, null only for privileged roles) and
 * `assertOwnCountry` rejects any other `countryId`; id-keyed rows are loaded with
 * `findFirst({ id, countryId })`. Storylines and story pins carry no `editableByOwner` lock, so
 * there is no `assertOwnerMayEdit` step.
 */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { GEO_FEATURE_INVALIDATE_KEYS_WITH_STORY_PINS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import type { db as prisma } from "~/server/db";
import { assertFound, assertOwnCountry } from "../core/shared";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a #rrggbb hex value");

/** Pins in storyline order: explicit order first, then by year (matches getStoryPinFull). */
const PIN_ORDER = [{ storylineOrder: "asc" as const }, { ixTimeYear: "asc" as const }];

/** Story chains (kind "chain", src/server/modules/action-links) share the table but never appear on the map. */
const MAP_KIND = { kind: "map" as const };

/** NOT_FOUND unless the storyline exists and belongs to `countryId`. */
export async function assertStorylineInCountry(
  db: Pick<typeof prisma, "storyline">,
  storylineId: string,
  countryId: string
) {
  assertFound(
    await db.storyline.findFirst({
      where: { id: storylineId, countryId, ...MAP_KIND },
      select: { id: true },
    }),
    "Storyline not found"
  );
}

async function afterStorylineWrite(countryId: string) {
  // The story pin modal's cached read carries the storyline and its pins.
  await invalidateCache([
    ...GEO_FEATURE_INVALIDATE_KEYS_WITH_STORY_PINS,
    "geoFeatures.getStoryPinFull",
  ]);
  broadcastMapUpdate("storyPin", countryId);
}

export const geoFeaturesStorylinesRouter = createTRPCRouter({
  /** The country's storylines with their pins, for the map editor. Owner / privileged only. */
  getCountryStorylines: protectedProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const [storylines, unassignedPins] = await Promise.all([
        ctx.db.storyline.findMany({
          where: { countryId: input.countryId, ...MAP_KIND },
          orderBy: { createdAt: "asc" },
          include: {
            pins: {
              select: {
                id: true,
                title: true,
                ixTimeYear: true,
                eraLabel: true,
                category: true,
                storylineOrder: true,
              },
              orderBy: PIN_ORDER,
            },
          },
        }),
        ctx.db.storyPin.findMany({
          where: { countryId: input.countryId, storylineId: null },
          select: { id: true, title: true, ixTimeYear: true },
          orderBy: [{ ixTimeYear: "asc" }, { title: "asc" }],
        }),
      ]);
      return { storylines, unassignedPins };
    }),

  createStoryline: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        title: z.string().trim().min(1).max(200),
        description: z.string().max(5000).optional(),
        color: hexColor.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      const storyline = await ctx.db.storyline.create({
        data: {
          countryId: input.countryId,
          title: input.title,
          description: input.description || null,
          color: input.color ?? null,
        },
      });
      await afterStorylineWrite(input.countryId);
      return { id: storyline.id, title: storyline.title };
    }),

  updateStoryline: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        storylineId: z.string().min(1),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().max(5000).nullable().optional(),
        color: hexColor.nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      await assertStorylineInCountry(ctx.db, input.storylineId, input.countryId);
      const updated = await ctx.db.storyline.update({
        where: { id: input.storylineId },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description || null }),
          ...(input.color !== undefined && { color: input.color }),
        },
      });
      await afterStorylineWrite(input.countryId);
      return { id: updated.id, title: updated.title };
    }),

  /** Deletes a storyline. Its pins stay on the map, no longer in any storyline. */
  deleteStoryline: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string().min(1), storylineId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      await assertStorylineInCountry(ctx.db, input.storylineId, input.countryId);
      await ctx.db.$transaction([
        ctx.db.storyPin.updateMany({
          where: { storylineId: input.storylineId },
          data: { storylineId: null, storylineOrder: null },
        }),
        ctx.db.storyline.delete({ where: { id: input.storylineId } }),
      ]);
      await afterStorylineWrite(input.countryId);
      return { id: input.storylineId, deleted: true };
    }),

  /**
   * Puts one of the country's story pins into one of its storylines (moving it out of any other).
   * Without `order` it goes after the storyline's last pin.
   */
  addPinToStoryline: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        storylineId: z.string().min(1),
        pinId: z.string().min(1),
        order: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      await assertStorylineInCountry(ctx.db, input.storylineId, input.countryId);
      assertFound(
        await ctx.db.storyPin.findFirst({ where: { id: input.pinId, countryId: input.countryId } }),
        "Story pin not found"
      );
      let order = input.order;
      if (order === undefined) {
        const last = await ctx.db.storyPin.aggregate({
          where: { storylineId: input.storylineId, id: { not: input.pinId } },
          _max: { storylineOrder: true },
        });
        order = (last._max.storylineOrder ?? -1) + 1;
      }
      await ctx.db.storyPin.update({
        where: { id: input.pinId },
        data: { storylineId: input.storylineId, storylineOrder: order },
      });
      await afterStorylineWrite(input.countryId);
      return { pinId: input.pinId, storylineId: input.storylineId, order };
    }),

  /** Takes a story pin out of its storyline. The pin itself stays. */
  removePinFromStoryline: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string().min(1), pinId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      assertFound(
        await ctx.db.storyPin.findFirst({ where: { id: input.pinId, countryId: input.countryId } }),
        "Story pin not found"
      );
      await ctx.db.storyPin.update({
        where: { id: input.pinId },
        data: { storylineId: null, storylineOrder: null },
      });
      await afterStorylineWrite(input.countryId);
      return { pinId: input.pinId, removed: true };
    }),
});
