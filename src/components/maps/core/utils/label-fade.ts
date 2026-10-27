import type { Feature, FeatureCollection } from "geojson";
import { DEMOTED_COUNTRY_NAMES } from "~/lib/maps/map-config";

interface LabelFadeView {
  center: { lng: number; lat: number };
  zoom: number;
  /** Half the diagonal of the visible bounds, in degrees. */
  viewRadius: number;
  topCountryNames?: Set<string>;
}

/** `_importance` / `_distFade` for one country label point at the given view. */
function fadeFor(f: Feature, view: LabelFadeView): { importance: number; fade: number } | null {
  const name = f.properties?._displayName as string | undefined;
  if (name && view.topCountryNames?.has(name)) return { importance: 1, fade: 1 };
  const isDemoted = !!name && (DEMOTED_COUNTRY_NAMES as readonly string[]).includes(name);
  if (isDemoted && view.zoom < 5.5) return { importance: -1, fade: 0 };

  const geometry = f.geometry;
  if (!geometry || !("coordinates" in geometry)) return null;
  const coords = geometry.coordinates as [number, number];
  const dlng = coords[0] - view.center.lng;
  const dlat = coords[1] - view.center.lat;
  const normDist = Math.sqrt(dlng * dlng + dlat * dlat) / Math.max(view.viewRadius, 1);
  const rawFade = Math.max(0, Math.min(1, (1.2 - normDist) / 0.6));
  const zoomFade = Math.max(0, Math.min(1, (view.zoom - 2.5) / 1.5));
  return { importance: isDemoted ? -1 : 0, fade: Math.round(zoomFade * rawFade * 100) / 100 };
}

/**
 * Recompute distance-based label fading for the country label points.
 *
 * Returns `null` when no label's fade or importance changed, so the caller can skip the
 * `setData` (and the worker re-tile it triggers). At globe zoom every non-top label is fully
 * faded, so panning there used to re-send an identical collection after every move.
 */
export function computeCountryLabelFade(
  base: FeatureCollection,
  view: LabelFadeView
): FeatureCollection | null {
  let changed = false;
  const features = base.features.map((f) => {
    const next = fadeFor(f, view);
    if (!next) return f;
    const props = f.properties ?? {};
    if (props._importance === next.importance && props._distFade === next.fade) return f;
    changed = true;
    return { ...f, properties: { ...props, _importance: next.importance, _distFade: next.fade } };
  });
  return changed ? { ...base, features } : null;
}
