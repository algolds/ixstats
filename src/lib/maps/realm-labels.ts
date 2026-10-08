/**
 * Realm labels: names a realm's map editors (site admins, the founder, officers with the Map power) place on the
 * realm's map anywhere, not inside a nation: oceans, seas, regions and continents (`MapLabel` with `realmId` set
 * and no `countryId`). They are drawn in IxWorld's ocean-label layer with its style, so each one has a kind and a
 * rank instead of a font of its own (`ocean-labels.ts`). Client-safe.
 */
import { z } from "zod";

export const REALM_LABEL_TYPES = ["ocean", "sea", "region", "continent"] as const;

export type RealmLabelType = (typeof REALM_LABEL_TYPES)[number];

export const REALM_LABEL_TYPE_NAMES: Record<RealmLabelType, string> = {
  ocean: "Ocean",
  sea: "Sea",
  region: "Region",
  continent: "Continent",
};

/** IxWorld's water-name ranks: major names show from the globe view, medium from zoom 1.5, minor from zoom 3. */
export const REALM_LABEL_RANKS = ["major", "medium", "minor"] as const;

export type RealmLabelRank = (typeof REALM_LABEL_RANKS)[number];

export const REALM_LABEL_RANK_NAMES: Record<RealmLabelRank, string> = {
  major: "Major",
  medium: "Medium",
  minor: "Minor",
};

/** The rank a label of each kind gets unless its editor picks another (bays, gulfs and straits are minor seas). */
export const REALM_LABEL_DEFAULT_RANK: Record<RealmLabelType, RealmLabelRank> = {
  ocean: "major",
  sea: "medium",
  region: "medium",
  continent: "major",
};

export function isRealmLabelRank(value: string | null | undefined): value is RealmLabelRank {
  return (REALM_LABEL_RANKS as readonly (string | null | undefined)[]).includes(value);
}

/** A realm label's rank: the stored one, else its kind's default (medium for a kind this version does not know). */
export function realmLabelRank(labelType: string, storedRank?: string | null): RealmLabelRank {
  if (isRealmLabelRank(storedRank)) return storedRank;
  return REALM_LABEL_DEFAULT_RANK[labelType as RealmLabelType] ?? "medium";
}

const realmLabelCoordinatesSchema = z
  .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .describe("[lng, lat]");

/**
 * A seed list (the map pipeline's `labels`: a JSON file of the art, or typed in):
 * `{ source, labels: [{ key?, text, kind, rank?, coordinates }] }`; `key` (default: the text) tells apart two
 * labels with one name, such as an ocean named twice.
 */
export const realmLabelSeedFileSchema = z.object({
  source: z.string(),
  labels: z
    .array(
      z.object({
        key: z.string().min(1).optional(),
        text: z.string().trim().min(1).max(100),
        kind: z.enum(REALM_LABEL_TYPES),
        rank: z.enum(REALM_LABEL_RANKS).optional(),
        coordinates: realmLabelCoordinatesSchema,
      })
    )
    .max(1000),
});

export type RealmLabelSeedEntry = z.infer<typeof realmLabelSeedFileSchema>["labels"][number];

/** `/maps?…&editor=labels`: the realm's map, opened in the world editor with its Realm labels dialog. */
const LABELS_EDITOR = "labels";

/** A link to edit a realm's labels on its map (the world editor opens for those who may edit it). */
export const realmLabelsEditorHref = (realmSlug: string) =>
  `/maps?realm=${encodeURIComponent(realmSlug)}&editor=${LABELS_EDITOR}`;

/** Whether the map's address asks for the Realm labels editor. */
export const wantsRealmLabelsEditor = (params: Pick<URLSearchParams, "get"> | null) =>
  params?.get("editor") === LABELS_EDITOR;
