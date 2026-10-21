/** @jest-environment node */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { evaluate } from "../../../scripts/verification/check-entrypoints";
import {
  findGrowth,
  loadQuarantine,
  QUARANTINE_PATH,
  toIgnorePattern,
  validateQuarantine,
  type QuarantineEntry,
  type QuarantineFile,
} from "../../../scripts/verification/run-jest-with-quarantine";

const rootDir = path.resolve(__dirname, "../../..");
const thisFile = path.relative(rootDir, __filename);

function entry(entryPath: string, owner = "plan 326"): QuarantineEntry {
  return { path: entryPath, reason: "pre-existing failure", owner };
}

function quarantine(tests: QuarantineEntry[], entrypoints: QuarantineEntry[] = []): QuarantineFile {
  return { ceiling: tests.length, tests, entrypoints };
}

describe("run-jest-with-quarantine", () => {
  describe("validateQuarantine", () => {
    it("flags a ceiling that does not match the number of tests", () => {
      const q = { ...quarantine([entry(thisFile)]), ceiling: 2 };
      expect(validateQuarantine(q, rootDir)).toEqual([
        "ceiling is 2 but tests has 1 entries; they must match",
      ]);
    });
    it("flags a path that does not exist on disk", () => {
      const q = quarantine([entry("src/tests/does-not-exist.test.ts")]);
      expect(validateQuarantine(q, rootDir)).toEqual([
        "path does not exist: src/tests/does-not-exist.test.ts",
      ]);
    });
    it("accepts the checked-in test-quarantine.json", () => {
      const q = loadQuarantine(path.join(rootDir, QUARANTINE_PATH));
      expect(validateQuarantine(q, rootDir)).toEqual([]);
    });
  });
  describe("findGrowth", () => {
    it("reports a path added relative to the base", () => {
      const base = quarantine([entry("a.test.ts")]);
      const current = quarantine([entry("a.test.ts"), entry("b.test.ts")]);
      expect(findGrowth(current, base)).toEqual([
        "b.test.ts is not quarantined on the base branch; the quarantine may only shrink",
      ]);
    });
  });

  describe("toIgnorePattern", () => {
    it("matches only the quarantined file, not a sibling with a longer name", () => {
      const pattern = new RegExp(toIgnorePattern("src/a.test.ts").replace("<rootDir>", "/repo"));
      expect(pattern.test("/repo/src/a.test.ts")).toBe(true);
      expect(pattern.test("/repo/src/a.test.tsx")).toBe(false);
      expect(pattern.test("/repo/src/aXtest.ts")).toBe(false);
    });
  });
});

describe("check-entrypoints evaluate", () => {
  const knownBroken = new Map([["server.mjs", "plan 330"]]);

  it("errors when an unlisted entrypoint fails to parse", () => {
    const result = evaluate(
      [{ file: "cron-runner.mjs", ok: false, output: "SyntaxError" }],
      knownBroken
    );
    expect(result.errors).toEqual(["cron-runner.mjs fails node --check:\nSyntaxError"]);
    expect(result.warnings).toEqual([]);
  });
  it("errors when a quarantined entrypoint parses again", () => {
    const result = evaluate([{ file: "server.mjs", ok: true, output: "" }], knownBroken);
    expect(result).toEqual({
      errors: ["server.mjs now parses — remove it from test-quarantine.json entrypoints"],
      warnings: [],
    });
  });
  it("the real check passes against the checked-in quarantine", () => {
    const script = path.join(rootDir, "scripts/verification/check-entrypoints.ts");
    const result = spawnSync("bun", [script], { cwd: rootDir, encoding: "utf-8" });
    expect(result.status).toBe(0);
  });
});
