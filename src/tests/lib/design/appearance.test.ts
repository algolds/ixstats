/**
 * The pre-paint appearance script (src/lib/design/appearance.ts) is serialised with
 * Function#toString into an inline <script> in the root layout. Run the actual string here so a
 * refactor that breaks serialisation (outer references, imports) fails in CI, not in production.
 */
import {
  APPEARANCE_INIT_SCRIPT,
  MEDIA_THEME_KEY
} from "~/lib/design/appearance";
describe("appearance pre-paint script", () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    for (const name of root.getAttributeNames()) root.removeAttribute(name);
    root.className = "dark";
  });
  describe("WikiOS media mode (data-media-theme, for a plinth reader's first frame)", () => {
    it("puts nothing a reader stored into the script text: it is a constant", () => {
      localStorage.setItem(MEDIA_THEME_KEY, "plinth-marker-9f2c");
      expect(APPEARANCE_INIT_SCRIPT).not.toContain("plinth-marker-9f2c");
      expect(APPEARANCE_INIT_SCRIPT).toContain(JSON.stringify(MEDIA_THEME_KEY));
    });
  });
});
