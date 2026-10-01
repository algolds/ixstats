/**
 * The pre-paint appearance script (src/lib/design/appearance.ts) is serialised with
 * Function#toString into an inline <script> in the root layout. Run the actual string here so a
 * refactor that breaks serialisation (outer references, imports) fails in CI, not in production.
 */
import {
  APPEARANCE_INIT_SCRIPT,
  APPEARANCE_STORAGE_KEYS as K,
  MEDIA_THEME_KEY,
  NAV_STORAGE_KEYS as NAV,
} from "~/lib/design/appearance";
import {
  MEDIA_THEME_STORAGE_KEY,
  normalizeMediaMode,
} from "~/lib/wiki-os/transformers/media-theme";

function mockColorScheme(dark: boolean) {
  // setupTests defines matchMedia as writable (non-configurable), so assign rather than redefine.
  window.matchMedia = ((query: string) => ({
    matches: query.includes("dark") ? dark : false,
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
    expect(root.getAttribute("data-typography")).toBe("swiss");
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

  describe("navigation shell (facet-nav)", () => {
    it("leaves the legacy shell on by default (NEXT_PUBLIC_FACET_NAV unset)", () => {
      mockColorScheme(false);
      runScript();
      expect(root.hasAttribute("data-nav")).toBe(false);
      expect(root.hasAttribute("data-sidebar")).toBe(false);
    });

    it("applies the per-user preview toggle and the collapsed sidebar", () => {
      mockColorScheme(false);
      localStorage.setItem(NAV.facetNav, "true");
      localStorage.setItem(NAV.sidebarCollapsed, "true");
      runScript();
      expect(root.getAttribute("data-nav")).toBe("facet");
      expect(root.getAttribute("data-sidebar")).toBe("collapsed");
    });

    it("honours an opt-out and still applies the appearance preferences", () => {
      mockColorScheme(true);
      localStorage.setItem(NAV.facetNav, "false");
      runScript();
      expect(root.getAttribute("data-theme")).toBe("dark");
      expect(root.hasAttribute("data-nav")).toBe(false);
    });
  });
  describe("WikiOS media mode (data-media-theme, for a plinth reader's first frame)", () => {
    it("reads the key the media theme owns", () => {
      expect(MEDIA_THEME_KEY).toBe(MEDIA_THEME_STORAGE_KEY);
    });

    it("is auto when nothing is stored", () => {
      mockColorScheme(true);
      runScript();
      expect(root.getAttribute("data-media-theme")).toBe("auto");
    });

    it.each(["plinth", "plate"])("is plinth for a stored %s", (stored) => {
      mockColorScheme(true);
      localStorage.setItem(MEDIA_THEME_KEY, stored);
      runScript();
      expect(root.getAttribute("data-media-theme")).toBe("plinth");
    });

    it("reads a stored value as normalizeMediaMode does: anything but plinth and plate is auto", () => {
      for (const stored of [
        "auto",
        "",
        "adaptive",
        "raw",
        "original",
        "invert",
        "PLINTH",
        " plinth",
        "plinth;alert(1)",
        '"><script>alert(1)</script>',
      ]) {
        mockColorScheme(true);
        localStorage.setItem(MEDIA_THEME_KEY, stored);
        runScript();
        expect(root.getAttribute("data-media-theme")).toBe(normalizeMediaMode(stored));
        expect(root.getAttribute("data-media-theme")).toBe("auto");
      }
    });

    it("is auto when the browser will not let the script read storage, and the rest still applies", () => {
      mockColorScheme(false);
      const read = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      try {
        runScript();
      } finally {
        read.mockRestore();
      }
      expect(root.getAttribute("data-media-theme")).toBe("auto");
      expect(root.getAttribute("data-theme")).toBe("light");
    });

    it("puts nothing a reader stored into the script text: it is a constant", () => {
      localStorage.setItem(MEDIA_THEME_KEY, "plinth-marker-9f2c");
      expect(APPEARANCE_INIT_SCRIPT).not.toContain("plinth-marker-9f2c");
      expect(APPEARANCE_INIT_SCRIPT).toContain(JSON.stringify(MEDIA_THEME_KEY));
    });
  });
});
