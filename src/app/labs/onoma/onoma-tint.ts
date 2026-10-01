import type { CSSProperties } from "react";

/**
 * Onoma's own accent (Facet 3.1, spec §16.0 — v2 brand): the electric azure #0091FF as a scoped
 * tint, so `text-tint`, `bg-tint-fill`, focus, selection and the glass hero wash/border read as
 * Onoma inside the lab. It fills the tint slots the `[data-app]` scopes resolve (facet/tokens.css):
 * dark is the brand azure (6.5:1 on black) with the azure-300 step; light steps down to the Onoma
 * light primaries (#0066b8, 5.8:1 on white) so tinted text stays AA. Increase Contrast picks the
 * `-strong` slots like every app tint.
 *
 * There is no `data-app="onoma"` scope (that would live in facet/tokens.css), so the slots are set
 * inline on Onoma's `data-app="maps"` wrapper and mirrored onto <body> for portals by
 * `OnomaPortalTint`.
 */
export const ONOMA_TINT_SLOTS = {
  "--tint-light": "#0066b8",
  "--tint-light-strong": "#005599",
  "--on-tint-light": "#ffffff",
  "--tint-dark": "#0091ff",
  "--tint-dark-strong": "#33a7ff",
  "--on-tint-dark": "#0b0c0f",
} as const;

export const ONOMA_TINT = ONOMA_TINT_SLOTS as CSSProperties;
