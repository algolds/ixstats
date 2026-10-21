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
  text: fs.readFileSync(file, "utf8"),
}));

/** `file:line` of every match of `pattern` (across line breaks), outside the `allowed` files. */
function hits(pattern: RegExp, allowed: readonly string[] = []): string[] {
  const global = new RegExp(pattern.source, "g");
  return sources
    .filter(({ file }) => !allowed.includes(file))
    .flatMap(({ file, text }) =>
      Array.from(
        text.matchAll(global),
        (m) => `${file}:${text.slice(0, m.index).split("\n").length}`
      )
    );
}

describe("cards refresh Phase 1 removals", () => {
  it("mints every copy through mintCopy", () => {
    expect(
      hits(/cardOwnership\s*\.\s*(create\w*|upsert)\b|INSERT INTO "CardOwnership"/, [
        "src/lib/cards/mint.ts",
      ])
    ).toEqual([]);
  });
});
