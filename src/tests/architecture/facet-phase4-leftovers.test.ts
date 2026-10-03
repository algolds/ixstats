/** @jest-environment node */
/**
 * Facet 3 Phase 4 leftovers (docs/specs/2026-09-30-facet-3-design-system.md §14) for the Builder,
 * the public pages, the country profile and the dashboard / achievements / passport / ThinkPages /
 * Messages / Halo apps: pins the closed items so they cannot regrow.
 */
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../..");

/** Areas whose x.5 spacing steps were retired (spec §4). */
const AREAS = [
  "app/builder",
  "app/countries",
  "components/country-profile",
  "app/explore",
  "app/leaderboards",
  "app/id",
  "app/r",
  "app/realms",
  "app/feed",
  "app/hashtags",
  "app/changelog",
  "app/stashes",
  "app/setup",
  "app/privacy",
  "app/terms",
  "app/page.tsx",
  "app/_components/splash",
  "app/_components/IxStatsSplashPage.tsx",
  "lib/splash",
  "components/dashboard",
  "app/dashboard",
  "components/achievements",
  "app/achievements",
  "components/passport",
  "components/thinkpages",
  "components/thinktanks",
  "app/thinkpages",
  "app/thinktanks",
  "components/messages",
  "app/messages",
  "components/halo",
  "app/settings/_components/SettingsSidebarNav.tsx",
];

// The ThinkPages account hub belongs to the navigation-shell pass.
const EXCLUDED = ["ThinkPagesAccountHub.tsx"];

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

const sources = AREAS.flatMap(listFiles)
  .filter((file) => !EXCLUDED.some((name) => file.endsWith(name)))
  .map((file) => ({
    file: path.relative(srcDir, file),
    content: fs.readFileSync(file, "utf-8"),
  }));

function hits(pattern: RegExp, filter: (file: string) => boolean = () => true): string[] {
  return sources
    .filter(({ file }) => filter(file))
    .flatMap(({ file, content }) => (content.match(pattern) ?? []).map((m) => `${file}: ${m}`));
}

const inDir = (dir: string) => (file: string) => file.startsWith(dir.split("/").join(path.sep));

describe("Facet 3 Phase 4 leftovers", () => {
  it("found the areas it guards", () => {
    expect(sources.length).toBeGreaterThan(300);
  });

  it("uses only the allowed spacing steps (no 1.5 / 2.5 / 3.5 spacing utilities)", () => {
    const retired =
      /(?<![\w\-/[])-?(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|top|left|right|bottom|inset|inset-x|inset-y)-[123]\.5(?![\w.\]%/])/g;
    expect(hits(retired)).toEqual([]);
  });

  it("lays builder text over images only through the shared image-scrim roles", () => {
    const scrimFile = path.join("app", "builder", "lib", "image-scrim.ts");
    expect(
      hits(
        /\b(?:text-white|bg-black\/\d+)\b/g,
        (file) => file.startsWith(path.join("app", "builder")) && file !== scrimFile
      )
    ).toEqual([]);
  });

  it("animates Halo with the named Facet springs, not its own constants", () => {
    expect(hits(/\bstiffness\s*[:=]/g, inDir("components/halo"))).toEqual([]);
  });

  it("keeps per-control sound ticks out of Halo (spec §9)", () => {
    expect(hits(/data-cuelume-(?:hover|press)/g, inDir("components/halo"))).toEqual([]);
  });

  it("shows no made-up Diplomatic Standing on the Factbook sidebar", () => {
    expect(hits(/diplomaticStanding\s*=\s*\d+/g, inDir("app/countries"))).toEqual([]);
  });

  it("renders the settings sidebar tier with a Badge variant, not hand-rolled classes", () => {
    expect(hits(/badgeClass/g, (file) => file.endsWith("SettingsSidebarNav.tsx"))).toEqual([]);
  });
});
