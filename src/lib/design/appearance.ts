/**
 * Appearance & accessibility preferences on <html>.
 *
 * One code path for both writers:
 *  - the blocking inline script in `src/app/layout.tsx` (`APPEARANCE_INIT_SCRIPT`), which runs
 *    before first paint so there is no theme flash, and
 *  - `ThemeProvider` (`src/context/theme-context.tsx`), which re-applies on every change.
 *
 * Attributes written: `data-theme` (+ legacy `.light`/`.dark` class), `data-density`
 * (+ legacy `.compact-mode` / `data-compact`), `data-motion="reduced"` (+ legacy
 * `.reduce-animations` / `data-reduce-animations`), `data-contrast="more"`,
 * `data-transparency="reduced"`, `data-sound="off"`, `--text-scale`, and `data-enable-textures`.
 *
 * `applyAppearance` and `initAppearanceFromStorage` are serialised with Function#toString into
 * the inline script, so they must stay self-contained: no imports, no outer references, ES5-ish.
 */

export const APPEARANCE_STORAGE_KEYS = {
  theme: "ixstats-theme",
  compactMode: "ixstats-compact-mode",
  reduceAnimations: "ixstats-reduce-animations",
  enableTextures: "ixstats-enable-textures",
  increaseContrast: "ixstats-increase-contrast",
  reduceTransparency: "ixstats-reduce-transparency",
  textScale: "ixstats-text-scale",
  /** Owned by src/lib/sound/cuelume.ts (SOUND_STORAGE_KEYS.ENABLED). */
  soundEnabled: "ixstates:sound-enabled",
} as const;

type AppearanceStorageKeys = typeof APPEARANCE_STORAGE_KEYS;

interface AppearanceState {
  /** Effective (resolved) theme. */
  theme: "light" | "dark";
  compact: boolean;
  reduceMotion: boolean;
  enableTextures: boolean;
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

  root.setAttribute("data-enable-textures", String(s.enableTextures));
}

/**
 * Reads stored preferences and applies them. With no stored theme it follows the OS and falls
 * back to dark when the OS states no light preference.
 * Self-contained (serialised into the pre-paint script).
 */
function initAppearanceFromStorage(
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
      : window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
  const scale = parseFloat(read(keys.textScale) ?? "");
  apply(document.documentElement, {
    theme,
    compact: bool(keys.compactMode, false),
    reduceMotion: bool(keys.reduceAnimations, false),
    enableTextures: bool(keys.enableTextures, true),
    increaseContrast: bool(keys.increaseContrast, false),
    reduceTransparency: bool(keys.reduceTransparency, false),
    soundOff: read(keys.soundEnabled) === "false",
    textScale: scale >= 0.9 && scale <= 1.3 ? scale : 1,
  });
}

/* ─── Navigation shell ───────────────────────────────────────────────────────────────────────── */

/** Storage key for the AppSidebar's collapsed state; `use-sidebar-collapsed.ts` reads and writes it. */
export const NAV_STORAGE_KEYS = {
  /** "true" when the AppSidebar is collapsed to icons. */
  sidebarCollapsed: "ixstats-sidebar-collapsed",
  /** JSON array of app and admin-group ids the user opened in the source list. */
  expanded: "ixstats-nav-expanded",
} as const;

type NavStorageKeys = typeof NAV_STORAGE_KEYS;

interface NavPreferences {
  sidebarCollapsed: boolean;
}

/**
 * Writes `data-sidebar="collapsed"` onto the root element; the shell's CSS keys off it, so the
 * server markup and the first paint agree. Self-contained (serialised).
 */
export function applyNavPreferences(root: HTMLElement, p: NavPreferences): void {
  if (p.sidebarCollapsed) root.setAttribute("data-sidebar", "collapsed");
  else root.removeAttribute("data-sidebar");
}

/** Resolves the stored navigation preferences. Self-contained (serialised). */
export function readNavPreferences(keys: NavStorageKeys): NavPreferences {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(keys.sidebarCollapsed);
  } catch {
    // Storage blocked: the sidebar starts expanded.
  }
  return { sidebarCollapsed: stored === "true" };
}

/** Inline, render-blocking `<head>` script body. Must carry the CSP nonce. */
export const APPEARANCE_INIT_SCRIPT =
  `try{(${initAppearanceFromStorage.toString()})(${JSON.stringify(
    APPEARANCE_STORAGE_KEYS
  )},${applyAppearance.toString()})}catch(e){}` +
  `try{(${applyNavPreferences.toString()})(document.documentElement,(${readNavPreferences.toString()})(${JSON.stringify(
    NAV_STORAGE_KEYS
  )}))}catch(e){}`;
