import { z } from "zod/v4";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { compositionSchema } from "~/lib/heraldry/composition-schema";
import { validateComposition } from "~/lib/heraldry/validation";
import { generateBlazon } from "~/lib/heraldry/blazon";
import { isSystemOwner } from "~/lib/auth";
import { invalidateCache } from "~/lib/cache";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { sanitizeSvgMarkup } from "~/lib/utils/sanitize-html";
import { RENDERED_IMAGE_URL, renderAchievementImages } from "./render";

const MAX_CHARGE_SVG_BYTES = 512 * 1024;

/** https URLs on Wikimedia's file host, the only source "Commons" charges come from. */
export function isCommonsFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "upload.wikimedia.org";
  } catch {
    return false;
  }
}

/** The achievement, or NOT_FOUND / FORBIDDEN unless the caller owns it (or is a system owner). */
async function loadOwnedAchievement(
  ctx: { db: PrismaClient; auth: { userId: string } },
  id: string,
  forbiddenMessage: string
) {
  const achievement = await ctx.db.heraldryAchievement.findUnique({ where: { id } });
  if (!achievement) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Achievement with ID ${id} not found` });
  }
  if (achievement.ownerId !== ctx.auth.userId && !isSystemOwner(ctx.auth.userId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
  }
  return achievement;
}

/**
 * Best-effort render for save/publish. On failure both URLs are cleared, so a stale image of an
 * older version of the design can never be attached; the attach flow renders again on demand.
 */
async function tryRenderImages(
  db: PrismaClient,
  achievement: { id: string; compositionData: unknown }
): Promise<{ thumbnailUrl: string | null; largeUrl: string | null }> {
  try {
    return await renderAchievementImages(db, achievement);
  } catch (error) {
    console.error(`[Vexel] Could not render achievement ${achievement.id}:`, error);
    return { thumbnailUrl: null, largeUrl: null };
  }
}

export const heraldryMutationsRouter = createTRPCRouter({
  saveAchievement: rateLimitedMutationProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        subjectType: z.enum(["COUNTRY", "CHARACTER", "INSTITUTION", "DYNASTY"]),
        subjectId: z.string().nullable(),
        compositionData: compositionSchema,
        svgData: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const generatedBlazon = generateBlazon(input.compositionData);
      const warnings = validateComposition(input.compositionData);

      let achievement;

      if (input.id) {
        await loadOwnedAchievement(
          ctx,
          input.id,
          "You do not have permission to update this achievement."
        );

        achievement = await ctx.db.heraldryAchievement.update({
          where: { id: input.id },
          data: {
            title: input.title,
            compositionData: input.compositionData as any,
            generatedBlazon,
            svgData: input.svgData,
            validationWarnings: warnings as any,
          },
        });
      } else {
        achievement = await ctx.db.heraldryAchievement.create({
          data: {
            ownerId: ctx.auth.userId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            title: input.title,
            compositionData: input.compositionData as any,
            generatedBlazon,
            svgData: input.svgData,
            validationWarnings: warnings as any,
          },
        });
      }

      // Create revision snapshot
      await ctx.db.heraldryRevision.create({
        data: {
          achievementId: achievement.id,
          compositionData: input.compositionData as any,
          generatedBlazon,
        },
      });

      // Render the saved composition to the PNGs attachToCountry uses as a coat of arms.
      return ctx.db.heraldryAchievement.update({
        where: { id: achievement.id },
        data: await tryRenderImages(ctx.db, {
          id: achievement.id,
          compositionData: input.compositionData,
        }),
      });
    }),

  /** Re-renders the owner's stored design to its thumbnail/large PNGs (e.g. before attaching). */
  renderAchievementImage: rateLimitedMutationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const achievement = await loadOwnedAchievement(
        ctx,
        input.id,
        "You do not have permission to render this achievement."
      );

      let images;
      try {
        images = await renderAchievementImages(ctx.db, achievement);
      } catch (error) {
        console.error(`[Vexel] Could not render achievement ${achievement.id}:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "This design could not be rendered to an image.",
        });
      }

      const updated = await ctx.db.heraldryAchievement.update({
        where: { id: achievement.id },
        data: images,
      });
      return { thumbnailUrl: updated.thumbnailUrl, largeUrl: updated.largeUrl };
    }),

  publishAchievement: rateLimitedMutationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const achievement = await loadOwnedAchievement(
        ctx,
        input.id,
        "You do not have permission to publish this achievement."
      );

      return ctx.db.heraldryAchievement.update({
        where: { id: input.id },
        data: {
          isPublished: true,
          publishedAt: new Date(),
          // Designs saved before images were rendered get theirs on publish.
          ...(achievement.thumbnailUrl ? {} : await tryRenderImages(ctx.db, achievement)),
        },
      });
    }),

  unpublishAchievement: rateLimitedMutationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadOwnedAchievement(
        ctx,
        input.id,
        "You do not have permission to unpublish this achievement."
      );

      return ctx.db.heraldryAchievement.update({
        where: { id: input.id },
        data: {
          isPublished: false,
          publishedAt: null,
        },
      });
    }),

  importCommonsCharge: rateLimitedMutationProcedure
    .input(
      z.object({
        name: z.string().min(1),
        category: z.enum([
          "ANIMALS",
          "BIRDS",
          "MYTHICAL_CREATURES",
          "FISH",
          "INSECTS",
          "PLANTS",
          "TREES",
          "FLOWERS",
          "CELESTIAL",
          "WEAPONS",
          "BUILDINGS",
          "CROWNS",
          "RELIGIOUS",
          "MARITIME",
          "AGRICULTURAL",
          "GEOMETRIC",
          "HUMAN_FIGURES",
          "OBJECTS",
          "LETTERS",
          "NUMBERS",
          "IXNAY_SPECIFIC",
          "MISCELLANEOUS",
        ]),
        subcategory: z.string().optional(),
        keywords: z.array(z.string()).default([]),
        url: z.string().url(),
        sourceUrl: z.string().url().optional(),
        author: z.string().optional(),
        license: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // The server fetches this URL, so only Wikimedia Commons file hosts are allowed (SSRF),
      // and the SVG is sanitized before it is stored and shown to other players (XSS).
      if (!isCommonsFileUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Charges can only be imported from upload.wikimedia.org over https.",
        });
      }
      const res = await fetch(input.url, {
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to download SVG from ${input.url}: ${res.statusText}`,
        });
      }
      const raw = await res.text();
      if (raw.length > MAX_CHARGE_SVG_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That SVG is larger than 512 KB." });
      }
      const svgData = sanitizeSvgMarkup(raw);
      if (!/<svg[\s>]/i.test(svgData)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That file is not an SVG image." });
      }

      return ctx.db.heraldryCharge.create({
        data: {
          name: input.name,
          category: input.category,
          subcategory: input.subcategory,
          keywords: input.keywords,
          svgData,
          source: "COMMONS",
          sourceUrl: input.sourceUrl || input.url,
          author: input.author,
          license: input.license,
        },
      });
    }),

  attachToCountry: rateLimitedMutationProcedure
    .input(
      z.object({
        achievementId: z.string().uuid(),
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const achievement = await loadOwnedAchievement(
        ctx,
        input.achievementId,
        "You do not own this achievement."
      );

      await assertCountryWriteAccess(ctx, input.countryId);

      // Only an image Vexel rendered itself (see render.ts) may become the coat of arms; with none,
      // writing "" would blank it. The editor renders on demand and retries on this error.
      const coatOfArmsUrl = [achievement.thumbnailUrl, achievement.largeUrl].find(
        (url): url is string => !!url && RENDERED_IMAGE_URL.test(url)
      );
      if (!coatOfArmsUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This design has no rendered image yet, so it can't be used as a coat of arms. The country's current coat of arms is unchanged.",
        });
      }

      await ctx.db.country.update({
        where: { id: input.countryId },
        data: {
          coatOfArms: coatOfArmsUrl,
          updatedAt: new Date(),
        },
      });

      await invalidateCache(["countries."]);
      clearLayerCache("political");

      return { success: true };
    }),
});
