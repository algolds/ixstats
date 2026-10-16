/** @jest-environment node */
/**
 * Cards refresh Phase 1 (docs/specs/2026-10-15-cards-refresh-design.md §5.6): the legacy card values, junk, crafting
 * and a second mint path cannot come back. The stat modules have their own guard (cards-no-stats.test.ts).
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "src");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return full === path.join(SRC, "tests") ? [] : walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const sources = walk(SRC).map((file) => ({
  file: path.relative(ROOT, file),
  lines: fs.readFileSync(file, "utf8").split("\n"),
}));

/** `file:line` of every source line matching `pattern`, outside the `allowed` files. */
function hits(pattern: RegExp, allowed: readonly string[] = []): string[] {
  return sources
    .filter(({ file }) => !allowed.includes(file))
    .flatMap(({ file, lines }) =>
      lines.flatMap((line, i) => (pattern.test(line) ? [`${file}:${i + 1}`] : []))
    );
}

const REMOVED = [
  "src/server/api/routers/crafting",
  "src/lib/cards/crafting-rules.ts",
  "prisma/seeds/crafting-recipes.ts",
  "src/components/cards/ns-import/ImportWizard.tsx",
  "src/tests/lib/pack-junk-ev.test.ts",
  "src/tests/server/api/routers/cards-junk-batch.test.ts",
];

describe("cards refresh Phase 1 removals", () => {
  it.each(REMOVED)("%s is gone", (file) => {
    expect(fs.existsSync(path.join(ROOT, file))).toBe(false);
  });

  it("keeps the legacy type and rarity literals in the legacy mapping only", () => {
    expect(
      hits(/["'`](MYTHIC|DIVINE|LORE_BATCH|WIKI_LORE|COMMONS_IMPORT|USER_CUSTOM|NS_IMPORT)["'`]/, [
        "src/lib/cards/legacy-mapping.ts",
      ])
    ).toEqual([]);
  });

  it("has no junk payout left", () => {
    expect(hits(/\bjunkCards\b|\bjunkValue\b|\bjunkRate\b|maxJunkBatchSize|JUNK_RATE_MAX/)).toEqual(
      []
    );
  });

  it("mints every copy through mintCopy", () => {
    expect(
      hits(/cardOwnership\.(create|createMany|upsert)\(|INSERT INTO "CardOwnership"/, [
        "src/lib/cards/mint.ts",
      ])
    ).toEqual([]);
  });
});
