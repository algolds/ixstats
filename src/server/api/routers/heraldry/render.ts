/**
 * Server-side coat-of-arms render: the stored composition → SVG (the same scene the editor draws)
 * → PNG via sharp → files in the uploads directory. The URLs this writes are built here from the
 * achievement id and a content hash; nothing a caller sends ever becomes thumbnailUrl/largeUrl.
 */
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { PrismaClient } from "@prisma/client";
import type { HeraldryComposition } from "~/lib/heraldry";
import { CHARGE_PATHS } from "~/lib/heraldry/charge-paths";
import { compositionSchema } from "~/lib/heraldry/composition-schema";
import {
  buildShieldScene,
  serializeShieldSvg,
  SHIELD_IMAGE_VIEWBOX,
} from "~/lib/heraldry/shield-scene";
import { uploadsDir, UPLOADS_URL_PREFIX } from "~/server/shared/upload-storage";

export const RENDER_SIZES = { thumbnailUrl: 256, largeUrl: 1024 } as const;

export type RenderedImages = { thumbnailUrl: string; largeUrl: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The only file names renderAchievementImages writes (served under UPLOADS_URL_PREFIX). */
export const RENDERED_IMAGE_URL =
  /^\/images\/uploads\/heraldry_[0-9a-f-]{36}_[0-9a-f]{16}_(?:256|1024)\.png$/;

type RenderDb = Pick<PrismaClient, "heraldryCharge">;

/** Stored SVGs for the composition's library charges (template charges need none). */
async function loadCustomChargeSvgs(
  db: RenderDb,
  composition: HeraldryComposition
): Promise<Record<string, string>> {
  const ids = [...new Set((composition.shield.charges ?? []).map((c) => c.chargeId))].filter(
    (id) => !(id in CHARGE_PATHS) && UUID.test(id)
  );
  if (ids.length === 0) return {};
  const rows = await db.heraldryCharge.findMany({
    where: { id: { in: ids } },
    select: { id: true, svgData: true },
  });
  return Object.fromEntries(rows.map((row) => [row.id, row.svgData]));
}

/** The stored composition as the scene the editor draws, library charges included. */
async function buildAchievementScene(db: RenderDb, compositionData: unknown) {
  const composition = compositionSchema.parse(compositionData) as HeraldryComposition;
  return buildShieldScene(composition, await loadCustomChargeSvgs(db, composition));
}

/**
 * Renders the achievement's stored composition to a 256px thumbnail and a 1024px PNG, writes them
 * to the uploads directory and returns their public URLs. Throws if the composition can't be
 * rendered. File names carry a content hash, so an unchanged design reuses the same files.
 */
export async function renderAchievementImages(
  db: RenderDb,
  achievement: { id: string; compositionData: unknown }
): Promise<RenderedImages> {
  if (!UUID.test(achievement.id)) throw new Error("Achievement id is not a UUID");
  const id = achievement.id.toLowerCase();
  const scene = await buildAchievementScene(db, achievement.compositionData);
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });

  const entries = await Promise.all(
    Object.entries(RENDER_SIZES).map(async ([key, size]) => {
      const svg = serializeShieldSvg(scene, { viewBox: SHIELD_IMAGE_VIEWBOX, size });
      const hash = createHash("sha256").update(svg).digest("hex").slice(0, 16);
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      const fileName = `heraldry_${id}_${hash}_${size}.png`;
      await writeFile(path.join(dir, fileName), png);
      return [key, `${UPLOADS_URL_PREFIX}${fileName}`] as const;
    })
  );
  return Object.fromEntries(entries) as RenderedImages;
}
