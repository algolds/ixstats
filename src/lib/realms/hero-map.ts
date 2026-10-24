/**
 * Pure helpers for a realm page's live hero map (`RealmHeroMap`): the camera that frames the realm like its
 * SVG face, and where a nation on it leads.
 */

/** MapLibre draws the Web Mercator world 512px wide at zoom 0. */
const TILE_SIZE = 512;

type NationStatus = "open" | "claimed" | "other";

/** The nation fields the hero map's hover card and click use. */
export interface HeroNationLink {
  id: string | null;
  slug: string | null;
  name: string | null;
  status: NationStatus;
}

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latitudeOf = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

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
  const spanY = ((mercatorY(north) - mercatorY(south)) / (2 * Math.PI)) * (1 + 2 * pad);
  const zoomX = Math.log2(width / (TILE_SIZE * Math.max(spanX, 1e-6)));
  const zoomY = Math.log2(height / (TILE_SIZE * Math.max(spanY, 1e-6)));
  return {
    center: [(west + east) / 2, latitudeOf((mercatorY(south) + mercatorY(north)) / 2)],
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
  return "Not open to players";
}
