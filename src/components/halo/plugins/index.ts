/**
 * Halo Plugins Registry & Barrel Exports
 *
 * Each plugin lives in its own isolated domain directory with a standard template structure:
 * - `<Name>Halo.tsx` (plugin component that registers via `useDIPlugin`)
 * - `views/` (expanded modal views supplied by this plugin)
 * - `components/` (optional domain-specific widgets/subcomponents)
 * - `types.ts` (optional domain-specific types)
 * - `index.ts` (public barrel export)
 */

export * from "./mycountry";
export * from "./forum";
export * from "./wiki";
export * from "./builder";
export * from "./sports";
export * from "./_template";
