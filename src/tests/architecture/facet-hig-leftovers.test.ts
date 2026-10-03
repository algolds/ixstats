/** @jest-environment node */
/**
 * Facet 3.1 HIG pass leftovers (docs/specs/2026-09-30-facet-3-design-system.md §16.8): pins the
 * closed items so they cannot regrow — touch-visible builder image actions, the builder heading
 * outline, the passport ribbon's tabs pattern, the always-present achievements h1, the map island
 * popovers' inset focus rings and GlassPanel's hero card.
 */
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(srcDir, rel), "utf8");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx$/.test(entry.name) ? [full] : [];
  });
}

describe("Facet 3.1 HIG leftovers", () => {
  it("keeps builder hover-reveal image actions visible on touch screens", () => {
    // Every hover-revealed image overlay (opacity-0 until group-hover) carries a coarse-pointer
    // variant from image-scrim.ts, so touch screens (no hover) still see the action.
    const offenders: string[] = [];
    for (const file of walk(path.join(srcDir, "app/builder"))) {
      const source = fs.readFileSync(file, "utf8");
      const overlay =
        /className=\{cn\(\s*"absolute inset-0[^"]*opacity-0[^"]*group-hover[^"]*",([^)]*)\)/g;
      for (const match of source.matchAll(overlay)) {
        if (!/IMAGE_SCRIM_TOUCH_(?:CLUSTER|BAND)/.test(match[1] ?? "")) {
          offenders.push(`${path.relative(srcDir, file)}: ${match[0].slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("gives the builder's pages one h1: the studio header, foundation sub-steps and import", () => {
    const h1 = /<h1\b/g;
    for (const rel of [
      "app/builder/components/BuilderStudioHeader.tsx",
      "app/builder/components/FoundationHero.tsx",
      "app/builder/components/enhanced/steps/foundation/FoundationPathSelector.tsx",
      "app/builder/components/enhanced/steps/foundation/ArchetypeGrid.tsx",
      "app/builder/components/sections/ImportSection.tsx",
      "app/builder/components/editor/EditorHeader.tsx",
    ]) {
      expect([rel, (read(rel).match(h1) ?? []).length]).toEqual([rel, 1]);
    }
    // Step content starts at h2: no h5/h6 anywhere in the builder.
    const deep = walk(path.join(srcDir, "app/builder")).filter((file) =>
      /<h[56]\b/.test(fs.readFileSync(file, "utf8"))
    );
    expect(deep).toEqual([]);
  });

  it("switches passport sections with the tabs pattern, not pressed buttons", () => {
    const ribbon = read("components/passport/document/PassportTabRibbon.tsx");
    expect(ribbon).not.toMatch(/aria-pressed/);
    expect(ribbon).toMatch(/role="tablist"/);
    expect(ribbon).toMatch(/role="tab"/);
    expect(ribbon).toMatch(/aria-selected=/);
    expect(read("components/passport/MidRibbonPassportDocument.tsx")).toMatch(/role="tabpanel"/);
  });

  it("always renders an h1 on /achievements, not only with a profile", () => {
    expect(read("app/achievements/page.tsx")).toMatch(
      /!\(isMounted && userProfile\) && <h1 className="sr-only">Achievements<\/h1>/
    );
  });

  it("draws the map island popover triggers' focus rings inside the clipping pill", () => {
    for (const rel of [
      "components/maps/core/components/MapSettingsPopover.tsx",
      "components/maps/core/components/AuthSection.tsx",
    ]) {
      const source = read(rel);
      expect([rel, /focus-visible:ring/.test(source)]).toEqual([rel, false]);
      expect([rel, /focus-visible:-outline-offset-2/.test(source)]).toEqual([rel, true]);
    }
  });

  it("renders GlassPanel on the hero card", () => {
    const panel = read("components/mycountry/shared/cards/GlassPanel.tsx");
    expect(panel).toContain('variant="hero"');
  });
});
