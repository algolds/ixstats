"use client";

import {
  formatPlanetArea,
  useRealmPlanetRadius,
} from "~/components/maps/core/hooks/useRealmMapDisplay";
import { useLiveBorderArea } from "~/components/maps/editor/utils/transientStore";

/**
 * A border's area on the realm's planet. It follows the live value while a vertex is dragged, so
 * only this text renders per frame; the rest of the editor waits for the drag to commit.
 */
export function BorderAreaText({ committed }: { committed: number }) {
  const radiusKm = useRealmPlanetRadius();
  const area = useLiveBorderArea(committed) ?? committed;
  return <>{formatPlanetArea(area, radiusKm)}</>;
}
