/**
 * A realm's map art, by name: the images (and data files) its map pipeline builds from
 * (`Realm.settings.map.pipeline.art`, realm-map-pipeline.ts). Each named piece is a file of the realm's source-sync
 * repository at its ref (`repoPath`) or a file uploaded through the map import upload route (`uploadId`, its
 * SHA-256 in MAP_IMPORT_DIR). Steps name art by its key, so one image (a geography map) can feed several layers.
 * Client-safe.
 */
import { z } from "zod";
import { repoPathSchema } from "~/lib/realms/sources/config";

/** An art key: lower case letters, digits and hyphens, as raster layer ids are. */
const ART_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const artKeySchema = z
  .string()
  .regex(ART_KEY, "Art names are lower case letters, digits and hyphens (up to 40)");

export const artSourceSchema = z.union([
  z.object({ repoPath: repoPathSchema }).strict(),
  z
    .object({
      uploadId: z.string().regex(/^[0-9a-f]{64}$/, "Not an upload id"),
      /** The name the file was uploaded under (uploads are stored by SHA-256), for people. */
      filename: z.string().trim().min(1).max(200).optional(),
    })
    .strict(),
]);
export type ArtSource = z.infer<typeof artSourceSchema>;
