/**
 * The format of the packed layers the server builds: its simplification tolerances and coverage settings, coordinate
 * precision, wire format and the properties each layer carries. Layer URLs and their tags carry it next to the map
 * version, so bytes cached as immutable under a URL are always the bytes that URL's build would send. Bump it in the
 * same commit as any change to what `layer-loader.ts` or `geojson-pack.ts` produce; the next deploy then asks for new
 * URLs instead of reusing a year-old copy.
 */
export const LAYER_FORMAT_VERSION = 1;
