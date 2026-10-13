/** The Ship tab's rules for applying a world to a realm, apart from the screen. Pure. */

import type { PhysicalLayer } from "~/lib/maps/import/options";
import { REALM_SLUG_PATTERN } from "~/lib/realms/realm-slug";

/** The physical layers an admin can choose to write, in the order the Ship tab lists them. */
export const LAYER_CHOICES: ReadonlyArray<{ layer: PhysicalLayer; label: string }> = [
  { layer: "altitudes", label: "Elevation" },
  { layer: "climate", label: "Climate" },
  { layer: "rivers", label: "Rivers" },
  { layer: "lakes", label: "Lakes" },
  { layer: "icecaps", label: "Ice" },
];

interface ApplyChoice {
  sourceKind: "preset" | "fit";
  /** The realm the world would go to; null until one is chosen */
  target: { isIxnay: boolean } | null;
  layers: readonly PhysicalLayer[];
}

/**
 * Why the world can't be sent to the realm yet, or null when it can. Ixnay takes only a layer choice, from a world
 * fitted to its own map; any other realm takes the founder's flow, or a layer choice with the fit source.
 */
export function applyBlock({ sourceKind, target, layers }: ApplyChoice): string | null {
  if (!target) {
    return sourceKind === "fit"
      ? "Choose the realm to fit to in the source section of the rail."
      : "Choose a realm.";
  }
  if (target.isIxnay && sourceKind === "preset") {
    return "Ixnay takes a layer choice from a world fitted to its own map. Set the source to Fit to a realm's map and choose Ixnay.";
  }
  if (target.isIxnay && layers.length === 0) return "Tick at least one layer to write to Ixnay.";
  return null;
}

/** A realm slug from its name: lower-case words joined by hyphens, at most 40 characters. */
export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** Whether the server will take `slug` as a realm slug (it may still be taken). */
export const isRealmSlug = (slug: string): boolean => REALM_SLUG_PATTERN.test(slug);
