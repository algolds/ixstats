import type { api } from "~/trpc/react";

/** Refreshes the map views that depend on geometry/linkage data. */
export function invalidateMapViews(
  utils: ReturnType<typeof api.useUtils>,
  { list = false, stats = false } = {}
) {
  if (list) utils.geoCore.listCountries.invalidate();
  // the new map version names new layer URLs, so the layers download again
  utils.realms.map.version.invalidate();
  utils.geoCore.getMapBundleMarkers.invalidate();
  utils.geoCore.getMapBundleDetail.invalidate();
  if (stats) utils.geoCore.getMapStats.invalidate();
}

export const notifySuccess = (title: string) =>
  ({ title, type: "success", priority: "low" }) as const;
export const notifyFailure = (title: string, message: string) =>
  ({ title, message, type: "error", priority: "high" }) as const;
