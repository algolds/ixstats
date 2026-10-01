/** @jest-environment node */
/**
 * Facet 3 Phase 4 re-check of MyCountry and maps (docs/specs/2026-09-30-facet-3-design-system.md
 * §14): pins what the re-check closed so it cannot regrow — retired x.5 spacing, the deprecated
 * `FacetContainer`, native form fields (Select / Checkbox / Switch / Slider instead), per-control
 * Cuelume ticks, the `.dynamic-island-shell` acrylic and `dark:` prose inversion.
 */
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../..");

const AREAS = [
  "components/mycountry",
  "app/mycountry",
  "components/maps",
  "app/maps",
  "components/executive",
  "components/shared/atomic",
  "components/shared/atomic-picker",
];

function listFiles(target: string): string[] {
  const full = path.join(srcDir, target);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [full];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) return listFiles(child);
    return /\.tsx?$/.test(entry.name) ? [path.join(srcDir, child)] : [];
  });
}

const sources = AREAS.flatMap(listFiles).map((file) => ({
  file: path.relative(srcDir, file),
  content: fs.readFileSync(file, "utf-8"),
}));

function hits(pattern: RegExp): string[] {
  return sources.flatMap(({ file, content }) =>
    (content.match(pattern) ?? []).map((m) => `${file}: ${m}`)
  );
}

describe("Facet 3 re-check: MyCountry and maps", () => {
  it("found the areas it guards", () => {
    expect(sources.length).toBeGreaterThan(400);
  });

  it("uses only the allowed spacing steps (no 1.5 / 2.5 / 3.5 spacing utilities)", () => {
    const retired =
      /(?<![\w\-/[])-?(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|top|left|right|bottom|inset|inset-x|inset-y)-[123]\.5(?![\w.\]%/])/g;
    expect(hits(retired)).toEqual([]);
  });

  it("uses FacetCard / FacetMaterial instead of the deprecated FacetContainer", () => {
    expect(hits(/<FacetContainer\b/g)).toEqual([]);
  });

  it("uses the Select, Checkbox, Switch and Slider primitives instead of native fields", () => {
    expect(hits(/<select\b/g)).toEqual([]);
    expect(hits(/type="(?:checkbox|range)"/g)).toEqual([]);
  });

  it("keeps per-control sound ticks out (spec §9)", () => {
    expect(hits(/data-cuelume-(?:hover|press)/g)).toEqual([]);
  });

  it("styles the map island with Facet materials, not the retired acrylic shell", () => {
    expect(hits(/dynamic-island-shell/g)).toEqual([]);
  });

  it("binds rich text to role colours instead of prose inversion", () => {
    expect(hits(/\bprose-invert\b/g)).toEqual([]);
  });
});
