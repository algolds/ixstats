/**
 * Maps the Tailwind palette names stored in builder data (`"emerald"`, `"amber"`, `"rose"`…) onto
 * Facet 3 system colours (spec §2.1). Classes are spelled out in full so Tailwind generates them.
 */

export type SystemColor =
  "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "indigo" | "purple" | "pink";

const PALETTE_TO_SYSTEM: Record<string, SystemColor> = {
  red: "red",
  rose: "red",
  orange: "orange",
  amber: "yellow",
  yellow: "yellow",
  gold: "yellow",
  lime: "green",
  green: "green",
  emerald: "green",
  teal: "teal",
  cyan: "teal",
  sky: "blue",
  blue: "blue",
  indigo: "indigo",
  violet: "purple",
  purple: "purple",
  fuchsia: "purple",
  pink: "pink",
};

export function toSystemColor(name: string | undefined | null): SystemColor | null {
  if (!name) return null;
  return PALETTE_TO_SYSTEM[name.toLowerCase()] ?? null;
}

/** `text-<colour>` for icons and values; `label-secondary` for neutral or unknown names. */
export const SYSTEM_TEXT: Record<SystemColor, string> = {
  red: "text-red",
  orange: "text-orange",
  yellow: "text-yellow",
  green: "text-green",
  teal: "text-teal",
  blue: "text-blue",
  indigo: "text-indigo",
  purple: "text-purple",
  pink: "text-pink",
};

/** A 10% wash of the colour, for icon tiles. */
export const SYSTEM_FILL: Record<SystemColor, string> = {
  red: "bg-red/10",
  orange: "bg-orange/10",
  yellow: "bg-yellow/10",
  green: "bg-green/10",
  teal: "bg-teal/10",
  blue: "bg-blue/10",
  indigo: "bg-indigo/10",
  purple: "bg-purple/10",
  pink: "bg-pink/10",
};

/** Solid background, e.g. for bars and dots. */
export const SYSTEM_BG: Record<SystemColor, string> = {
  red: "bg-red",
  orange: "bg-orange",
  yellow: "bg-yellow",
  green: "bg-green",
  teal: "bg-teal",
  blue: "bg-blue",
  indigo: "bg-indigo",
  purple: "bg-purple",
  pink: "bg-pink",
};

export function systemTextClass(name: string | undefined | null): string {
  const c = toSystemColor(name);
  return c ? SYSTEM_TEXT[c] : "text-label-secondary";
}

export function systemFillClass(name: string | undefined | null): string {
  const c = toSystemColor(name);
  return c ? SYSTEM_FILL[c] : "bg-fill-3";
}

export function systemBgClass(name: string | undefined | null): string {
  const c = toSystemColor(name);
  return c ? SYSTEM_BG[c] : "bg-label-tertiary";
}
