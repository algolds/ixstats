/** @jest-environment node */
/** Cards refresh §5.2: card stats are gone, with every module, component, prop and type that computed or drew them. */
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../..");

function sources(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Lines of `files` matching `pattern`, as `path:line`. */
function hits(files: string[], pattern: RegExp): string[] {
  return files.flatMap((file) =>
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) => (pattern.test(line) ? [`${path.relative(srcDir, file)}:${i + 1}`] : []))
  );
}

// Card code only: `HoverStats` and `loreStats` also name unrelated country and Loreward code.
const CARD_CODE = [
  "components/cards",
  "lib/cards",
  "types",
  "components/passport",
  "components/vault",
].flatMap((dir) => sources(path.join(srcDir, dir)));
const ALL_CODE = sources(srcDir).filter((file) => !file.startsWith(path.join(srcDir, "tests")));

const STAT_SYMBOLS =
  /\b(formatCardStats|resolveCardStats|formatSpecialStats|computeSpecialStats|getSpecialStatsForType|getBaseStatDefs|StatBars|HoverStats|hideStats|showStatsOnHover|CardStatsTab|CardCompareTab|FormattedStats|FormattedStatEntry|FormattedSpecialStatEntry|CardStatDef|getOwnerCount)\b/;

describe("card stats are removed", () => {
  it("deletes the stat modules and tabs", () => {
    for (const gone of [
      "lib/cards/stat-config.ts",
      "lib/country-geo/special-stats-populator.ts",
      "components/cards/display/modal/CardStatsTab.tsx",
      "components/cards/display/modal/CardCompareTab.tsx",
    ])
      expect(fs.existsSync(path.join(srcDir, gone))).toBe(false);
  });

  it("leaves no import of a stat module anywhere in src", () => {
    expect(hits(ALL_CODE, /stat-config|special-stats-populator/)).toEqual([]);
  });

  it("leaves no stat symbol, prop or type in card code", () => {
    expect(hits(CARD_CODE, STAT_SYMBOLS)).toEqual([]);
  });
});
