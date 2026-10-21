/** @jest-environment node */
/**
 * Money values with one writer each, so their locks and rules cannot be skipped: every copy is minted through
 * mintCopy (its serial and capacity locks), and Card.marketValue is written in bulk only by the market-values module.
 *
 * Folds cards-phase1-removals and cards-economy-removals (their single-writer guards; the rest were tombstones).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === join(SRC, "tests") ? [] : walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const sources = walk(SRC).map((file) => ({ file: relative(ROOT, file), text: readFileSync(file, "utf8") }));

/** `file:line` of every match of `pattern`, across line breaks. */
const hits = (pattern: RegExp) =>
  sources.flatMap(({ file, text }) =>
    Array.from(
      text.matchAll(new RegExp(pattern.source, "g")),
      (m) => `${file}:${text.slice(0, m.index).split("\n").length}`
    )
  );

describe("money values with one writer", () => {
  it("mints every copy through mintCopy", () => {
    const writes = hits(/cardOwnership\s*\.\s*(create\w*|upsert)\b|INSERT INTO "CardOwnership"/);
    expect(writes.filter((hit) => !hit.startsWith("src/lib/cards/mint.ts:"))).toEqual([]);
  });

  it("writes Card.marketValue in bulk only in the market-values module", () => {
    const writers = new Set(hits(/UPDATE cards c SET "marketValue"/).map((hit) => hit.split(":")[0]));
    expect([...writers]).toEqual(["src/server/modules/cards/market-values.ts"]);
  });
});
