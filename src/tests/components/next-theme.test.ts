import {
  DEFAULT_PREFS,
  nextTheme,
  parseStoredPrefs,
  themeReducer,
  type ThemeState,
} from "~/context/theme-context";
import { APPEARANCE_STORAGE_KEYS } from "~/lib/design/appearance";

describe("nextTheme", () => {
  it("cycles light, dark, system", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
    expect(nextTheme("system")).toBe("light");
  });
});

describe("parseStoredPrefs", () => {
  it("reads set keys, skips unset and malformed ones, clamps the text scale", () => {
    const store: Record<string, string> = {
      [APPEARANCE_STORAGE_KEYS.theme]: "light",
      [APPEARANCE_STORAGE_KEYS.compactMode]: "true",
      [APPEARANCE_STORAGE_KEYS.enableTextures]: "false",
      [APPEARANCE_STORAGE_KEYS.textScale]: "9",
      [APPEARANCE_STORAGE_KEYS.soundEnabled]: "false",
    };
    expect(parseStoredPrefs((key) => store[key] ?? null)).toEqual({
      theme: "light",
      compactMode: true,
      enableTextures: false,
      textScale: 1.3,
      soundOff: true,
    });
  });

  it("ignores an unknown theme", () => {
    expect(parseStoredPrefs(() => "sepia").theme).toBeUndefined();
  });
});

describe("themeReducer", () => {
  const initial: ThemeState = { prefs: DEFAULT_PREFS, systemTheme: "dark", loaded: false };

  it("marks loaded only on the load action", () => {
    const set = themeReducer(initial, { type: "set", prefs: { compactMode: true } });
    expect(set.loaded).toBe(false);
    expect(set.prefs.compactMode).toBe(true);
    expect(themeReducer(set, { type: "loaded", prefs: {} }).loaded).toBe(true);
  });

  it("tracks the OS theme apart from the chosen one", () => {
    const next = themeReducer(initial, { type: "system", theme: "light" });
    expect(next.systemTheme).toBe("light");
    expect(next.prefs.theme).toBe("system");
  });
});
