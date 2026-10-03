/**
 * The pre-paint appearance script (src/lib/design/appearance.ts) is serialised with
 * Function#toString into an inline <script> in the root layout. Run the actual string here so a
 * refactor that breaks serialisation (outer references, imports) fails in CI, not in production.
 */
import {
  APPEARANCE_INIT_SCRIPT,
  APPEARANCE_STORAGE_KEYS as K,
  NAV_STORAGE_KEYS as NAV,
} from "~/lib/design/appearance";

function mockColorScheme(dark: boolean) {
  // setupTests defines matchMedia as writable (non-configurable), so assign rather than redefine.
  window.matchMedia = ((query: string) => ({
    matches: query.includes("light") ? !dark : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

function runScript() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(APPEARANCE_INIT_SCRIPT)();
}

describe("appearance pre-paint script", () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    for (const name of root.getAttributeNames()) root.removeAttribute(name);
    root.className = "dark";
  });

  it("follows the OS when no theme is stored (system is the default)", () => {
    mockColorScheme(false);
    runScript();
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.classList.contains("light")).toBe(true);
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.getAttribute("data-density")).toBe("regular");
    expect(root.hasAttribute("data-motion")).toBe(false);
    expect(root.hasAttribute("data-contrast")).toBe(false);
    expect(root.hasAttribute("data-transparency")).toBe(false);
    expect(root.hasAttribute("data-sound")).toBe(false);
    expect(root.hasAttribute("data-typography")).toBe(false);
    expect(root.hasAttribute("data-low-fidelity")).toBe(false);
    expect(root.style.getPropertyValue("--text-scale")).toBe("");
  });

  it("applies stored preferences and keeps legacy classes in sync", () => {
    mockColorScheme(false);
    localStorage.setItem(K.theme, "dark");
    localStorage.setItem(K.compactMode, "true");
    localStorage.setItem(K.reduceAnimations, "true");
    localStorage.setItem(K.increaseContrast, "true");
    localStorage.setItem(K.reduceTransparency, "true");
    localStorage.setItem(K.soundEnabled, "false");
    localStorage.setItem(K.textScale, "1.2");
    runScript();
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.getAttribute("data-density")).toBe("compact");
    expect(root.classList.contains("compact-mode")).toBe(true);
    expect(root.getAttribute("data-motion")).toBe("reduced");
    expect(root.classList.contains("reduce-animations")).toBe(true);
    expect(root.getAttribute("data-contrast")).toBe("more");
    expect(root.getAttribute("data-transparency")).toBe("reduced");
    expect(root.getAttribute("data-sound")).toBe("off");
    expect(root.style.getPropertyValue("--text-scale")).toBe("1.2");
  });

  it("ignores out-of-range text scale values", () => {
    mockColorScheme(true);
    localStorage.setItem(K.textScale, "3");
    runScript();
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.style.getPropertyValue("--text-scale")).toBe("");
  });

  describe("navigation shell", () => {
    it("leaves the sidebar expanded by default", () => {
      mockColorScheme(false);
      runScript();
      expect(root.hasAttribute("data-sidebar")).toBe(false);
    });

    it("applies the collapsed sidebar and still applies the appearance preferences", () => {
      mockColorScheme(true);
      localStorage.setItem(NAV.sidebarCollapsed, "true");
      runScript();
      expect(root.getAttribute("data-sidebar")).toBe("collapsed");
      expect(root.getAttribute("data-theme")).toBe("dark");
    });
  });
});
