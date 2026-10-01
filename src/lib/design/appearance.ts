/**
 * Facet 3 appearance & accessibility preferences on <html> (spec §1, §10).
 *
 * One code path for both writers:
 *  - the blocking inline script (`APPEARANCE_INIT_SCRIPT`), which `AppearanceInitScript` writes into
 *    the server's HTML head (`useServerInsertedHTML`, with the CSP nonce) and which runs before first
 *    paint so there is no theme flash, and
 *  - `ThemeProvider` (`src/context/theme-context.tsx`), which re-applies on every change.
 *
 * Attributes written: `data-theme` (+ legacy `.light`/`.dark` class), `data-density`
 * (+ legacy `.compact-mode` / `data-compact`), `data-motion="reduced"` (+ legacy
 * `.reduce-animations` / `data-reduce-animations`), `data-contrast="more"`,
 * `data-transparency="reduced"`, `data-sound="off"`, `--text-scale`, plus the existing
 * `data-typography`, `data-low-fidelity`, `data-enable-textures`, `data-interactive-hover`.
 *
 * `applyAppearance` and `initAppearanceFromStorage` are serialised with Function#toString into
 * the inline script, so they must stay self-contained: no imports, no outer references, ES5-ish.
 */

export const APPEARANCE_STORAGE_KEYS = {
  theme: "ixstats-theme",
  typography: "ixstats-typography",
  compactMode: "ixstats-compact-mode",
  reduceAnimations: "ixstats-reduce-animations",
  lowFidelity: "ixstats-low-fidelity",
  enableTextures: "ixstats-enable-textures",
  interactiveHover: "ixstats-interactive-hover",
  increaseContrast: "ixstats-increase-contrast",
  reduceTransparency: "ixstats-reduce-transparency",
  textScale: "ixstats-text-scale",
  /** Owned by src/lib/sound/cuelume.ts (SOUND_STORAGE_KEYS.ENABLED). */
  soundEnabled: "ixstates:sound-enabled",
} as const;

export type AppearanceStorageKeys = typeof APPEARANCE_STORAGE_KEYS;

export interface AppearanceState {
  /** Effective (resolved) theme. */
  theme: "light" | "dark";
  typography: string;
  compact: boolean;
  reduceMotion: boolean;
  lowFidelity: boolean;
  enableTextures: boolean;
  interactiveHover: boolean;
  increaseContrast: boolean;
  reduceTransparency: boolean;
  soundOff: boolean;
  /** 0.9–1.3; 1 removes the inline property. */
  textScale: number;
}

export const TEXT_SCALE_MIN = 0.9;
export const TEXT_SCALE_MAX = 1.3;

export function clampTextScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, value));
}

/** Writes the preference attributes onto the root element. Self-contained (serialised). */
export function applyAppearance(root: HTMLElement, s: AppearanceState): void {
  function flag(name: string, on: boolean, value: string): void {
    if (on) root.setAttribute(name, value);
    else root.removeAttribute(name);
  }
  root.setAttribute("data-theme", s.theme);
  root.classList.remove(s.theme === "dark" ? "light" : "dark");
  root.classList.add(s.theme);
  root.style.colorScheme = s.theme;

  root.setAttribute("data-density", s.compact ? "compact" : "regular");
  root.setAttribute("data-compact", String(s.compact));
  root.classList.toggle("compact-mode", s.compact);

  flag("data-motion", s.reduceMotion, "reduced");
  root.setAttribute("data-reduce-animations", String(s.reduceMotion));
  root.classList.toggle("reduce-animations", s.reduceMotion);

  flag("data-contrast", s.increaseContrast, "more");
  flag("data-transparency", s.reduceTransparency, "reduced");
  flag("data-sound", s.soundOff, "off");

  if (s.textScale !== 1) root.style.setProperty("--text-scale", String(s.textScale));
  else root.style.removeProperty("--text-scale");

  root.setAttribute("data-typography", s.typography);
  root.setAttribute("data-low-fidelity", String(s.lowFidelity));
  root.classList.toggle("low-fidelity", s.lowFidelity);
  root.setAttribute("data-enable-textures", String(s.enableTextures));
  root.setAttribute("data-interactive-hover", String(s.interactiveHover));
}

/**
 * Reads stored preferences (falling back to the OS for "system" theme) and applies them.
 * Self-contained (serialised into the pre-paint script).
 */
export function initAppearanceFromStorage(
  keys: AppearanceStorageKeys,
  apply: (root: HTMLElement, s: AppearanceState) => void
): void {
  function read(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function bool(key: string, fallback: boolean): boolean {
    const v = read(key);
    return v === null ? fallback : v === "true";
  }
  const stored = read(keys.theme);
  const theme: "light" | "dark" =
    stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  const typography = read(keys.typography);
  const scale = parseFloat(read(keys.textScale) ?? "");
  apply(document.documentElement, {
    theme,
    typography:
      typography === "sovereign" ||
      typography === "national" ||
      typography === "swiss" ||
      typography === "apple"
        ? typography
        : "swiss",
    compact: bool(keys.compactMode, false),
    reduceMotion: bool(keys.reduceAnimations, false),
    lowFidelity: bool(keys.lowFidelity, false),
    enableTextures: bool(keys.enableTextures, true),
    interactiveHover: bool(keys.interactiveHover, true),
    increaseContrast: bool(keys.increaseContrast, false),
    reduceTransparency: bool(keys.reduceTransparency, false),
    soundOff: read(keys.soundEnabled) === "false",
    textScale: scale >= 0.9 && scale <= 1.3 ? scale : 1,
  });
}

/* ─── Navigation shell (Facet 3 spec §7.4, Phase 3) ──────────────────────────────────────────── */

/**
 * Storage keys for the navigation shell. Kept apart from `APPEARANCE_STORAGE_KEYS` because
 * `ThemeProvider` does not own them: `src/lib/navigation/use-facet-nav.ts` reads and writes them.
 */
export const NAV_STORAGE_KEYS = {
  /** "true" | "false"; absent = the deployment default (`NEXT_PUBLIC_FACET_NAV`). */
  facetNav: "ixstats-facet-nav",
  /** "true" when the AppSidebar is collapsed to icons. */
  sidebarCollapsed: "ixstats-sidebar-collapsed",
} as const;

export type NavStorageKeys = typeof NAV_STORAGE_KEYS;

/**
 * Deployment default for the `facet-nav` flag: `NEXT_PUBLIC_FACET_NAV=1` turns the new shell on
 * for everyone who has not chosen otherwise in Settings. Inlined at build time on the client.
 */
export const FACET_NAV_DEFAULT: boolean =
  process.env.NEXT_PUBLIC_FACET_NAV === "1" || process.env.NEXT_PUBLIC_FACET_NAV === "true";

export interface NavPreferences {
  /** The `facet-nav` flag: AppSidebar/TabBar instead of the top navigation bar. */
  facetNav: boolean;
  sidebarCollapsed: boolean;
}

/**
 * Writes `data-nav="facet"` and `data-sidebar="collapsed"` onto the root element. CSS keys the shell
 * off these attributes, so the server markup and the first paint agree. Self-contained (serialised).
 */
export function applyNavPreferences(root: HTMLElement, p: NavPreferences): void {
  if (p.facetNav) root.setAttribute("data-nav", "facet");
  else root.removeAttribute("data-nav");
  if (p.sidebarCollapsed) root.setAttribute("data-sidebar", "collapsed");
  else root.removeAttribute("data-sidebar");
}

/** Resolves the stored navigation preferences. Self-contained (serialised). */
export function readNavPreferences(keys: NavStorageKeys, facetNavDefault: boolean): NavPreferences {
  function read(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  const stored = read(keys.facetNav);
  return {
    facetNav: stored === "true" ? true : stored === "false" ? false : facetNavDefault,
    sidebarCollapsed: read(keys.sidebarCollapsed) === "true",
  };
}

/** Inline, render-blocking `<head>` script body. Must carry the CSP nonce. */
export const APPEARANCE_INIT_SCRIPT =
  `try{(${initAppearanceFromStorage.toString()})(${JSON.stringify(
    APPEARANCE_STORAGE_KEYS
  )},${applyAppearance.toString()})}catch(e){}` +
  `try{(${applyNavPreferences.toString()})(document.documentElement,(${readNavPreferences.toString()})(${JSON.stringify(
    NAV_STORAGE_KEYS
  )},${JSON.stringify(FACET_NAV_DEFAULT)}))}catch(e){}`;
