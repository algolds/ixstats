/** A view of the world map: where the camera is and which layers show. */
export interface MapView {
  lng: number;
  lat: number;
  zoom: number;
  /** Camera tilt and rotation in degrees (3D terrain); left out of the link at 0. */
  pitch?: number;
  bearing?: number;
  /** Visible base layers (the page adds `background` itself). */
  layers?: readonly string[];
}

/**
 * The address of `view` on the map page at `href`: `lat`, `lng`, `zoom`, `pitch`, `bearing` and `layers` set (the deep link the
 * /maps page reads), the realm and other parameters kept, a picked country (`country`, `name`) dropped so the
 * link opens on the view rather than flying to that nation.
 */
export function mapViewLink(href: string, view: MapView): string {
  const url = new URL(href);
  url.searchParams.delete("country");
  url.searchParams.delete("name");
  url.searchParams.delete("layer");
  url.searchParams.set("lat", view.lat.toFixed(4));
  url.searchParams.set("lng", view.lng.toFixed(4));
  url.searchParams.set("zoom", view.zoom.toFixed(2));
  for (const key of ["pitch", "bearing"] as const) {
    const value = Math.round(view[key] ?? 0);
    if (value !== 0) url.searchParams.set(key, String(value));
    else url.searchParams.delete(key);
  }
  const layers = view.layers?.filter((l) => l !== "background") ?? [];
  if (layers.length > 0) url.searchParams.set("layers", layers.join(","));
  else url.searchParams.delete("layers");
  return url.toString();
}

/** A coordinate as people read it: `12.3456° N, 45.6789° W`. */
export function formatLatLng(lng: number, lat: number): string {
  const part = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
  return `${part(lat, "N", "S")}, ${part(lng, "E", "W")}`;
}
