import { withBasePath } from "~/lib/base-path";

/**
 * MapLibre 6 locates its web worker next to its own module via `import.meta.url`,
 * which points at a bundled chunk once Turbopack/webpack bundles it ("Worker failed
 * to load"). The worker and the shared chunk it imports are copied to
 * public/maplibre/ by the postinstall script; point MapLibre there.
 */
export async function loadMaplibre() {
  const maplibregl = await import("maplibre-gl");
  maplibregl.setWorkerUrl(withBasePath("/maplibre/maplibre-gl-worker.mjs"));
  return maplibregl;
}
