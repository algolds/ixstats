import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

/** Reusable Zod schema for WGS84 coordinate pair [lng, lat] with bounds checking. */
export const coordinatesSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
    message: "Coordinates must be valid WGS84 (lng: -180 to 180, lat: -90 to 90)",
  });

/**
 * Country owners may only act on their own country; admins (no `ctx.country`) may act on any.
 * `action` completes "You can only ... your own country".
 */
export function assertOwnCountry(
  ctx: { country?: object | null },
  countryId: string,
  action = "edit"
) {
  const owned = ctx.country as { id: string } | null | undefined;
  if (owned && owned.id !== countryId) {
    throw new TRPCError({ code: "FORBIDDEN", message: `You can only ${action} your own country` });
  }
}

/** NOT_FOUND unless the (already queried) map feature exists. */
export function assertFeatureFound<T>(feature: T | null | undefined, featureId: string): T {
  if (!feature) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Feature not found: ${featureId}` });
  }
  return feature;
}

/** Neighbouring layers overlapping a [minLng, minLat, maxLng, maxLat] box padded by `pad`, as feature stubs. */
export function neighbourFeatures<
  T extends {
    featureId: string;
    displayName: string | null;
    geometry: unknown;
    boundingBox: unknown;
  },
>(layers: T[], bbox: number[], pad: number) {
  return layers
    .filter((l) => {
      const nb = l.boundingBox as number[] | null;
      return (
        !!nb &&
        nb.length === 4 &&
        nb[0]! < bbox[2]! + pad &&
        nb[2]! > bbox[0]! - pad &&
        nb[1]! < bbox[3]! + pad &&
        nb[3]! > bbox[1]! - pad
      );
    })
    .map((l) => ({ featureId: l.featureId, displayName: l.displayName, geometry: l.geometry }));
}

/** The realm's political layer for a feature (featureId is unique only within a realm), or NOT_FOUND. */
export async function requirePoliticalLayer(db: PrismaClient, featureId: string, realmId: string) {
  const mapLayer = await db.mapLayer.findFirst({
    where: { layerType: "political", featureId, realmId },
  });
  if (!mapLayer) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Map feature not found: ${featureId}` });
  }
  return mapLayer;
}

/**
 * Climate color map: maps fill colors to human-readable Trewartha climate names.
 * Includes both canonical Trewartha colors and legacy SVG colors for backward compat.
 */
export const CLIMATE_COLOR_MAP: Record<string, string> = {
  // Canonical Trewartha colors (from climate-system.ts)
  "#990000": "Ar: Tropical Wet",
  "#ff3300": "Aw: Tropical Wet-And-Dry",
  "#ffff33": "Bw: Desert or Arid",
  "#ff9933": "Bs: Steppe or Semiarid",
  "#669900": "Cs: Subtropical Dry Summer",
  "#336600": "Cf: Subtropical Humid",
  "#00ff99": "Do: Temperate Oceanic",
  "#0099ff": "Dc: Temperate Continental",
  "#0066cc": "E: Boreal",
  "#b9b9b9": "Ft: Tundra",
  "#99ffff": "Fi: Ice Cap",
  "#ffccff": "H: Highland",
  // Legacy SVG colors (pre-Trewartha import data)
  "#00fd97": "Do: Temperate Oceanic",
  "#326500": "Cf: Subtropical Humid",
  "#fd9833": "Bs: Steppe or Semiarid",
  "#659700": "Cs: Subtropical Dry Summer",
  "#fc3502": "Aw: Tropical Wet-And-Dry",
  "#980000": "Ar: Tropical Wet",
  "#fcfc33": "Bw: Desert or Arid",
  "#0098fd": "Dc: Temperate Continental",
  "#9ea7b0": "Ft: Tundra",
  "#0065ca": "E: Boreal",
  "#fecbfe": "H: Highland",
};
