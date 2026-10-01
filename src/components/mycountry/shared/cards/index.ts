/**
 * MyCountry card vocabulary.
 *
 * - PanelCard   — themed workhorse surface (bg-surface + optional accent tint/texture)
 * - GlassPanel  — frosted glass hero surface (Facet 3.1 `variant="glass"`) in the section accent
 * - CutoutPanel — textured "cutout" framing for nav rails & sidebar widgets
 *
 * All three are theme-compliant (token-based, light + dark) and accept a section
 * accent from `accents.ts`.
 */
export { PanelCard } from "./PanelCard";
export { GlassPanel } from "./GlassPanel";
export { CutoutPanel } from "./CutoutPanel";
export {
  ACCENT_CLASSES,
  FACET_ACCENT,
  SECTION_ACCENT,
  accentForSection,
  type MyCountryAccent,
  type AccentTokens,
} from "./accents";
