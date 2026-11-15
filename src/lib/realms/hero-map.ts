/**
 * Pure helpers for a realm page's live hero map (`RealmHeroMap`): the camera that frames the realm like its
 * SVG face, and where a nation on it leads.
 */

import { toCarrierLat } from "~/lib/maps/flat-projection";

/** MapLibre draws the world 512px wide at zoom 0. */
const TILE_SIZE = 512;

/** What a nation is on a realm's map: open to claim, held by a player, NPC scenery nobody can claim, or a region with no country. */
export type NationStatus = "open" | "claimed" | "npc" | "none";

/** The NPC nation fill: the land colour pulled toward the label, so scenery reads apart from bare land in
 * any tint or theme. One source for the SVG face and the live map (which resolves it through a probe). */
export const NPC_FILL = "color-mix(in srgb, var(--color-fill-3) 78%, var(--color-label))";

/** The nation fields the hero map's hover card and click use. */
export interface HeroNationLink {
  id: string | null;
  slug: string | null;
  name: string | null;
  status: NationStatus;
}

/**
 * The centre and zoom that make `bounds` ([west, south, east, north]) cover a `width` x `height` box with
 * `pad` of each span as margin, cropping the overflowing side: the same framing as the SVG face's
 * `xMidYMid slice`, so the live map lands where the face was.
 */
export function coverView(
  bounds: [number, number, number, number],
  width: number,
  height: number,
  pad = 0.04
): { center: [number, number]; zoom: number } {
  const [west, south, east, north] = bounds;
  const spanX = ((east - west) / 360) * (1 + 2 * pad);
  // Plate Carrée, like the face: latitude is linear, on the same scale as longitude
  const spanY = ((north - south) / 360) * (1 + 2 * pad);
  const zoomX = Math.log2(width / (TILE_SIZE * Math.max(spanX, 1e-6)));
  const zoomY = Math.log2(height / (TILE_SIZE * Math.max(spanY, 1e-6)));
  return {
    center: [(west + east) / 2, toCarrierLat((south + north) / 2)],
    zoom: Math.max(0, Math.max(zoomX, zoomY)),
  };
}

/**
 * Where a nation on the hero map leads: an open nation to the realm's Nations tab filtered to it (ready to
 * claim), any other country to its page, and a region with no country nowhere.
 */
export function heroNationHref(nation: HeroNationLink, realmSlug: string): string | null {
  if (nation.status === "open" && nation.name) {
    return `/r/${encodeURIComponent(realmSlug)}/nations?nation=${encodeURIComponent(nation.name)}`;
  }
  if (!nation.id) return null;
  return `/countries/${encodeURIComponent(nation.slug ?? nation.id)}`;
}

/** The hover card's status line. */
export function heroNationStatus(status: NationStatus): string {
  if (status === "claimed") return "Claimed by a player";
  if (status === "open") return "Open to claim";
  if (status === "npc") return "Not playable";
  return "Not open to players";
}
