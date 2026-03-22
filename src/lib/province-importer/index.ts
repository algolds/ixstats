/**
 * Province Importer — Barrel exports.
 */

export * from "./types";
export * from "./alignment";
export * from "./topology";
export * from "./svg-element-converter";
export * from "./svg-transform";
export * from "./svg-layer-detector";
export * from "./svg-text-matcher";

// parse-provinces.ts and png-tracer.ts are conditionally imported
// since parse-provinces is server-only (uses @xmldom/xmldom)
// and png-tracer is client-only (uses Canvas API)
