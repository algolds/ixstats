/**
 * src/lib/worldgen/index.ts — Master barrel export for Procedural World Generation (UPG v1 & v2).
 */

export * from "./types";
export * from "./engine";
export * from "./climate";
export * from "./cultures";
export * from "./features";
export * from "./heightmap";
export * from "./ixworld-template";
export * from "./marching-squares";
export * from "./rivers";
export * from "./rng";
export * from "./settlements";
export * from "./states";
export * from "./validate";
export * from "./voronoi-mesh";
export * from "./export-geojson";

// UPG v2 Engine
export * as WorldGenV2 from "./v2";
